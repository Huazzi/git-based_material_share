import { arrayBufferToBase64 } from '@/utils/base64.js';
import { encodeRefPath, encodeRepositoryPath } from '@/utils/path.js';

function mutationType(entry) {
  return entry.kind === 'submodule' ? 'commit' : 'blob';
}

export class GitHubMutationService {
  constructor({ request, basePath, branch }) {
    this.request = request;
    this.basePath = basePath;
    this.branch = branch;
  }

  async upload({ path, file, name, message, existing, conflict }) {
    const payload = {
      message: message?.trim() || `上传 ${name}`,
      content: arrayBufferToBase64(await file.arrayBuffer()),
      branch: this.branch,
    };
    if (existing && conflict === 'overwrite') payload.sha = existing.sha;
    const response = await this.request('put', `${this.basePath}/contents/${encodeRepositoryPath(path)}`, {
      data: payload,
    }, { operation: 'upload', mutation: true });
    return response.data.commit.sha;
  }

  async uploadBatch({ snapshot, files, message, onProgress }) {
    const treeEntries = [];
    for (let index = 0; index < files.length; index += 1) {
      const item = files[index];
      onProgress?.({ phase: 'blob', current: index + 1, total: files.length, name: item.targetName });
      const blob = await this.request('post', `${this.basePath}/git/blobs`, {
        data: {
          content: arrayBufferToBase64(await item.file.arrayBuffer()),
          encoding: 'base64',
        },
      }, { operation: 'create-upload-blob' });
      treeEntries.push({
        path: item.targetPath,
        mode: item.mode || '100644',
        type: 'blob',
        sha: blob.data.sha,
      });
    }

    onProgress?.({ phase: 'tree', current: files.length, total: files.length });
    const tree = await this.request('post', `${this.basePath}/git/trees`, {
      data: { base_tree: snapshot.treeSha, tree: treeEntries },
    }, { operation: 'create-upload-tree' });
    onProgress?.({ phase: 'commit', current: files.length, total: files.length });
    const commit = await this.request('post', `${this.basePath}/git/commits`, {
      data: {
        message,
        tree: tree.data.sha,
        parents: [snapshot.commitSha],
      },
    }, { operation: 'create-upload-commit' });
    onProgress?.({ phase: 'ref', current: files.length, total: files.length });
    await this.request('patch', `${this.basePath}/git/refs/heads/${encodeRefPath(this.branch)}`, {
      data: { sha: commit.data.sha, force: false },
    }, { operation: 'update-ref', mutation: true });
    return commit.data.sha;
  }

  async createDirectory({ keepPath, directoryPath, message }) {
    const response = await this.request('put', `${this.basePath}/contents/${encodeRepositoryPath(keepPath)}`, {
      data: {
        message: message?.trim() || `创建目录 ${directoryPath}`,
        content: '',
        branch: this.branch,
      },
    }, { operation: 'create-directory', mutation: true });
    return response.data.commit.sha;
  }

  async deleteFile({ path, entry, message }) {
    const response = await this.request('delete', `${this.basePath}/contents/${encodeRepositoryPath(path)}`, {
      data: {
        message: message?.trim() || `删除 ${entry.name}`,
        sha: entry.sha,
        branch: this.branch,
      },
    }, { operation: 'delete-file', mutation: true });
    return response.data.commit.sha;
  }

  async deleteDirectory({ snapshot, path, leaves, message }) {
    const newTree = await this.request('post', `${this.basePath}/git/trees`, {
      data: {
        base_tree: snapshot.treeSha,
        tree: leaves.map((entry) => ({
          path: entry.path,
          mode: entry.mode,
          type: mutationType(entry),
          sha: null,
        })),
      },
    }, { operation: 'create-delete-tree' });
    const commit = await this.request('post', `${this.basePath}/git/commits`, {
      data: {
        message: message?.trim() || `删除目录 ${path}`,
        tree: newTree.data.sha,
        parents: [snapshot.commitSha],
      },
    }, { operation: 'create-delete-commit' });
    await this.request('patch', `${this.basePath}/git/refs/heads/${encodeRefPath(this.branch)}`, {
      data: { sha: commit.data.sha, force: false },
    }, { operation: 'update-ref', mutation: true });
    return commit.data.sha;
  }
}
