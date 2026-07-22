import { FILE_LIMITS, getFilePolicy } from '@/constants/fileLimits.js';
import { AppError, isAppError } from '@/errors/AppError.js';
import { createAvailableFileName } from '@/utils/file.js';
import { encodeRefPath, encodeRepositoryPath, getFileName, joinPath, normalizePath } from '@/utils/path.js';
import { createGitHubClient } from '@/services/github/githubClient.js';
import { mapGitHubError } from '@/services/github/githubError.js';
import { GitHubMutationService } from '@/services/github/githubMutationService.js';
import { MutationQueue } from '@/services/mutation/MutationQueue.js';
import { RepositorySnapshot } from './RepositorySnapshot.js';
import { StorageProvider } from './StorageProvider.js';

function responseHeader(headers, name) {
  return headers?.get?.(name) ?? headers?.[name] ?? headers?.[name.toLowerCase()] ?? null;
}

export class GitHubStorageProvider extends StorageProvider {
  constructor({ config, token = '', client, onRateLimit } = {}) {
    super();
    this.config = Object.freeze({ owner: config.owner, repo: config.repo, branch: config.branch });
    this.token = token;
    this.client = client || createGitHubClient({ token, onRateLimit });
    this.snapshot = null;
    this.queue = new MutationQueue();
    this.disposed = false;
    this.activeReadControllers = new Set();
    this.mutations = new GitHubMutationService({
      request: (...args) => this.#request(...args),
      basePath: this.basePath,
      branch: this.config.branch,
    });
  }

  get basePath() {
    return `/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repo)}`;
  }

  get capabilities() {
    return Object.freeze({
      canRead: true,
      canMutate: Boolean(this.token),
      maxUploadBytes: FILE_LIMITS.upload,
      maxPreviewBytes: FILE_LIMITS.preview,
      maxDownloadBytes: FILE_LIMITS.download,
    });
  }

  async initialize({ signal } = {}) {
    return this.refresh({ signal, anonymousInitialize: !this.token });
  }

  async #request(method, url, options = {}, metadata = {}) {
    try {
      const { data, ...config } = options;
      const requestConfig = { ...config, metadata };
      if (method === 'get' || method === 'delete') {
        if (method === 'delete' && data !== undefined) requestConfig.data = data;
        return await this.client[method](url, requestConfig);
      }
      return await this.client[method](url, data, requestConfig);
    } catch (error) {
      throw isAppError(error) ? error : mapGitHubError(error, metadata);
    }
  }

  async #loadSnapshot({ signal, anonymousInitialize = false } = {}) {
    const refPath = encodeRefPath(this.config.branch);
    const ref = await this.#request('get', `${this.basePath}/git/ref/heads/${refPath}`, { signal }, {
      operation: 'load-ref', anonymousInitialize,
    });
    const commitSha = ref.data.object.sha;
    const commit = await this.#request('get', `${this.basePath}/git/commits/${commitSha}`, { signal }, {
      operation: 'load-commit', anonymousInitialize,
    });
    const treeSha = commit.data.tree.sha;
    const tree = await this.#request('get', `${this.basePath}/git/trees/${treeSha}`, {
      signal,
      params: { recursive: '1' },
    }, { operation: 'load-tree', anonymousInitialize });
    return new RepositorySnapshot({
      commitSha,
      treeSha,
      tree: tree.data.tree,
      truncated: tree.data.truncated,
    });
  }

  async refresh(options = {}) {
    if (this.disposed) throw new AppError('SESSION_CHANGED', 'Provider has been disposed.');
    const snapshot = await this.#loadSnapshot(options);
    if (this.disposed) throw new AppError('SESSION_CHANGED', 'Provider changed while loading.');
    this.snapshot = snapshot;
    return snapshot;
  }

  #requireSnapshot() {
    if (this.disposed) throw new AppError('SESSION_CHANGED', 'Provider has been disposed.');
    if (!this.snapshot) throw new AppError('SESSION_CHANGED', 'Repository is not initialized.');
    return this.snapshot;
  }

  #requireMutation() {
    if (!this.token) throw new AppError('AUTH_REQUIRED', 'A token is required for mutations.');
    if (this.disposed) throw new AppError('SESSION_CHANGED', 'Provider has been disposed.');
  }

  list(path = '') { return this.#requireSnapshot().list(path); }
  search(query) { return this.#requireSnapshot().search(query); }
  stat(path) { return this.#requireSnapshot().stat(path); }

  #createReadController(externalSignal) {
    const controller = new AbortController();
    const abort = () => controller.abort(externalSignal?.reason);
    if (externalSignal?.aborted) abort();
    else externalSignal?.addEventListener('abort', abort, { once: true });
    this.activeReadControllers.add(controller);
    return {
      controller,
      release: () => {
        externalSignal?.removeEventListener('abort', abort);
        this.activeReadControllers.delete(controller);
      },
    };
  }

  async readFile(path, { purpose = 'preview', signal, snapshot = this.#requireSnapshot() } = {}) {
    const normalized = normalizePath(path);
    const entry = snapshot.stat(normalized);
    if (!entry || entry.kind !== 'file') throw new AppError('RESOURCE_NOT_FOUND', 'File does not exist.');
    const policy = getFilePolicy(entry.size);
    if (purpose === 'preview' && !policy.preview) {
      throw new AppError(policy.download ? 'PREVIEW_TOO_LARGE' : 'DOWNLOAD_TOO_LARGE', 'Preview size policy rejected the file.');
    }
    if (purpose === 'download' && !policy.download) {
      throw new AppError('DOWNLOAD_TOO_LARGE', 'Download size policy rejected the file.');
    }

    const maximum = purpose === 'preview' ? FILE_LIMITS.preview : FILE_LIMITS.download;
    const { controller, release } = this.#createReadController(signal);
    let exceeded = false;
    let response;
    try {
      response = await this.#request('get', `${this.basePath}/contents/${encodeRepositoryPath(normalized)}`, {
        signal: controller.signal,
        params: { ref: snapshot.commitSha },
        responseType: 'blob',
        headers: { Accept: 'application/vnd.github.raw+json' },
        onDownloadProgress: ({ loaded = 0, total }) => {
          if (loaded > maximum || (Number.isFinite(total) && total > maximum)) {
            exceeded = true;
            controller.abort();
          }
        },
      }, { operation: `read-${purpose}` });
    } catch (error) {
      if (exceeded) {
        throw new AppError(purpose === 'preview' ? 'PREVIEW_TOO_LARGE' : 'DOWNLOAD_TOO_LARGE',
          'Transfer exceeded size policy.');
      }
      throw error;
    } finally {
      release();
    }
    if (this.disposed) throw new AppError('SESSION_CHANGED', 'Provider changed while reading.');
    const contentLengthHeader = responseHeader(response.headers, 'content-length');
    const contentLength = contentLengthHeader === null ? Number.NaN : Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > maximum) {
      throw new AppError(purpose === 'preview' ? 'PREVIEW_TOO_LARGE' : 'DOWNLOAD_TOO_LARGE',
        'Content-Length exceeds size policy.');
    }
    const blob = response.data instanceof Blob
      ? response.data
      : new Blob([response.data], { type: responseHeader(response.headers, 'content-type') || 'application/octet-stream' });
    if (blob.size > maximum) {
      throw new AppError(purpose === 'preview' ? 'PREVIEW_TOO_LARGE' : 'DOWNLOAD_TOO_LARGE', 'Received file exceeds size policy.');
    }
    return {
      blob,
      path: normalized,
      name: entry.name,
      size: blob.size,
      contentType: blob.type || responseHeader(response.headers, 'content-type') || 'application/octet-stream',
    };
  }

  async #refreshAfterMutation(commitSha, affectedPath) {
    try {
      const snapshot = await this.refresh();
      return { commitSha, affectedPath, snapshot };
    } catch {
      throw new AppError('MUTATION_APPLIED_REFRESH_FAILED', 'Mutation applied but refresh failed.', {
        applied: true, commitSha, operation: 'refresh-after-mutation', recoverable: true,
      });
    }
  }

  upload({ directory = '', file, name = file?.name, message, conflict = 'rename' }) {
    this.#requireMutation();
    if (!file || file.size > FILE_LIMITS.upload) {
      return Promise.reject(new AppError('UPLOAD_TOO_LARGE', 'Upload exceeds 25 MiB.'));
    }
    return this.queue.enqueue(`upload:${name}`, async () => {
      this.#requireMutation();
      await this.refresh();
      const normalizedDirectory = normalizePath(directory);
      let targetName = getFileName(name);
      let targetPath = joinPath(normalizedDirectory, targetName);
      let existing = this.snapshot.stat(targetPath);
      if (existing && conflict === 'rename') {
        targetName = createAvailableFileName(targetName, (candidate) => (
          Boolean(this.snapshot.stat(joinPath(normalizedDirectory, candidate)))
        ));
        targetPath = joinPath(normalizedDirectory, targetName);
        existing = null;
      }
      if (existing?.kind !== 'file' && existing) throw new AppError('GIT_CONFLICT', 'Target path is not a file.');
      const commitSha = await this.mutations.upload({
        path: targetPath, file, name: targetName, message, existing, conflict,
      });
      return this.#refreshAfterMutation(commitSha, targetPath);
    });
  }

  createDirectory({ path, message }) {
    this.#requireMutation();
    const normalized = normalizePath(path);
    return this.queue.enqueue(`mkdir:${normalized}`, async () => {
      this.#requireMutation();
      await this.refresh();
      if (this.snapshot.stat(normalized)) throw new AppError('GIT_CONFLICT', 'Directory already exists.');
      const keepPath = joinPath(normalized, '.gitkeep');
      const commitSha = await this.mutations.createDirectory({
        keepPath, directoryPath: normalized, message,
      });
      return this.#refreshAfterMutation(commitSha, normalized);
    });
  }

  deleteFile({ path, message }) {
    this.#requireMutation();
    const normalized = normalizePath(path);
    return this.queue.enqueue(`delete-file:${normalized}`, async () => {
      this.#requireMutation();
      await this.refresh();
      const entry = this.snapshot.stat(normalized);
      if (!entry || entry.kind !== 'file') throw new AppError('RESOURCE_NOT_FOUND', 'File no longer exists.');
      const commitSha = await this.mutations.deleteFile({ path: normalized, entry, message });
      return this.#refreshAfterMutation(commitSha, normalized);
    });
  }

  deleteDirectory({ path, message }) {
    this.#requireMutation();
    const normalized = normalizePath(path);
    if (!normalized) return Promise.reject(new AppError('VALIDATION_FAILED', 'Root directory cannot be deleted.'));
    return this.queue.enqueue(`delete-directory:${normalized}`, async () => {
      this.#requireMutation();
      const fresh = await this.#loadSnapshot();
      const directory = fresh.stat(normalized);
      if (!directory || directory.kind !== 'directory') {
        throw new AppError('RESOURCE_NOT_FOUND', 'Directory no longer exists.');
      }
      const leaves = fresh.descendantLeaves(normalized);
      if (!leaves.length) throw new AppError('VALIDATION_FAILED', 'Directory contains no deletable entries.');
      const commitSha = await this.mutations.deleteDirectory({
        snapshot: fresh, path: normalized, leaves, message,
      });
      return this.#refreshAfterMutation(commitSha, normalized);
    });
  }

  dispose() {
    this.disposed = true;
    this.activeReadControllers.forEach((controller) => controller.abort());
    this.activeReadControllers.clear();
    this.queue.close();
    this.snapshot = null;
  }
}
