import { describe, expect, it, vi } from 'vitest';
import { FILE_LIMITS } from '@/constants/fileLimits.js';
import { createBatchUploadDraft, planBatchUpload } from '@/services/batch/BatchUploadPlanner.js';
import { GitHubStorageProvider } from '@/services/storage/GitHubStorageProvider.js';

function treeResponses(tree, { commitSha = 'commit-1', treeSha = 'tree-1' } = {}) {
  return [
    { data: { object: { sha: commitSha } } },
    { data: { tree: { sha: treeSha } } },
    { data: { tree, truncated: false } },
  ];
}

function createClient(responses) {
  const next = vi.fn(async (method, _url, ...args) => {
    const response = responses.shift();
    if (response instanceof Error) throw response;
    const config = method === 'get' || method === 'delete' ? args[0] : args[1];
    if (response?.progress) {
      config.onDownloadProgress(response.progress);
      if (config.signal.aborted) throw Object.assign(new Error('aborted'), { code: 'ERR_CANCELED' });
      return response.response;
    }
    return response;
  });
  return {
    get: vi.fn((...args) => next('get', ...args)),
    put: vi.fn((...args) => next('put', ...args)),
    post: vi.fn((...args) => next('post', ...args)),
    patch: vi.fn((...args) => next('patch', ...args)),
    delete: vi.fn((...args) => next('delete', ...args)),
  };
}

const tree = [
  { path: 'docs', type: 'tree', mode: '040000', sha: 'docs-tree' },
  { path: 'docs/.gitkeep', type: 'blob', mode: '100644', sha: 'keep', size: 0 },
  { path: 'docs/a.md', type: 'blob', mode: '100644', sha: 'a', size: 4 },
  { path: 'docs/link', type: 'blob', mode: '120000', sha: 'link', size: 4 },
  { path: 'docs/vendor', type: 'commit', mode: '160000', sha: 'vendor' },
  { path: 'docs2', type: 'tree', mode: '040000', sha: 'docs2-tree' },
  { path: 'docs2/keep.txt', type: 'blob', mode: '100644', sha: 'keep-2', size: 1 },
];

function uploadFile(name = 'a.md') {
  return {
    name,
    size: 4,
    arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode('test').buffer),
  };
}

describe('GitHubStorageProvider', () => {
  it('loads a commit-bound snapshot and browses locally', async () => {
    const client = createClient(treeResponses(tree));
    const provider = new GitHubStorageProvider({
      config: { owner: 'octo', repo: 'notes', branch: 'feature/x' }, client,
    });
    await provider.initialize();
    expect(provider.list('docs').map((entry) => entry.name)).toEqual(['a.md', 'link', 'vendor']);
    expect(provider.search('A.MD')).toHaveLength(1);
    expect(client.get).toHaveBeenNthCalledWith(1,
      '/repos/octo/notes/git/ref/heads/feature/x', expect.any(Object));
  });

  it('reads raw content at the immutable snapshot commit', async () => {
    const client = createClient([...treeResponses(tree), {
      data: new Blob(['test'], { type: 'text/markdown' }), headers: { 'content-type': 'text/markdown' },
    }]);
    const provider = new GitHubStorageProvider({
      config: { owner: 'octo', repo: 'notes', branch: 'main' }, client,
    });
    await provider.initialize();
    const raw = await provider.readFile('docs/a.md', { purpose: 'preview' });
    expect(raw.size).toBe(4);
    expect(client.get).toHaveBeenLastCalledWith('/repos/octo/notes/contents/docs/a.md',
      expect.objectContaining({ params: { ref: 'commit-1' }, responseType: 'blob' }));
  });

  it('rejects response headers and transfer progress that exceed the purpose limit', async () => {
    const headerClient = createClient([...treeResponses(tree), {
      data: new Blob(['test']), headers: { 'content-length': String(FILE_LIMITS.preview + 1) },
    }]);
    const headerProvider = new GitHubStorageProvider({
      config: { owner: 'octo', repo: 'notes', branch: 'main' }, client: headerClient,
    });
    await headerProvider.initialize();
    await expect(headerProvider.readFile('docs/a.md')).rejects.toMatchObject({ code: 'PREVIEW_TOO_LARGE' });

    const progressClient = createClient([...treeResponses(tree), {
      progress: { loaded: FILE_LIMITS.preview + 1 },
      response: { data: new Blob(['test']), headers: {} },
    }]);
    const progressProvider = new GitHubStorageProvider({
      config: { owner: 'octo', repo: 'notes', branch: 'main' }, client: progressClient,
    });
    await progressProvider.initialize();
    await expect(progressProvider.readFile('docs/a.md')).rejects.toMatchObject({ code: 'PREVIEW_TOO_LARGE' });
  });

  it('aborts active raw reads when the provider is disposed', async () => {
    const client = createClient(treeResponses(tree));
    const provider = new GitHubStorageProvider({
      config: { owner: 'octo', repo: 'notes', branch: 'main' }, client,
    });
    await provider.initialize();
    client.get.mockImplementationOnce((_url, config) => new Promise((_resolve, reject) => {
      config.signal.addEventListener('abort', () => {
        reject(Object.assign(new Error('aborted'), { code: 'ERR_CANCELED' }));
      });
    }));
    const reading = provider.readFile('docs/a.md');
    provider.dispose();
    await expect(reading).rejects.toMatchObject({ code: 'ABORTED' });
  });

  it('rejects anonymous mutations at the provider boundary', () => {
    const provider = new GitHubStorageProvider({
      config: { owner: 'octo', repo: 'notes', branch: 'main' }, client: createClient([]),
    });
    expect(() => provider.upload({ file: uploadFile() })).toThrowError(
      expect.objectContaining({ code: 'AUTH_REQUIRED' }),
    );
  });

  it('creates renamed uploads and overwrites with the fresh blob SHA', async () => {
    const renameClient = createClient([
      ...treeResponses(tree), ...treeResponses(tree),
      { data: { commit: { sha: 'rename-commit' } } }, ...treeResponses(tree),
    ]);
    const renameProvider = new GitHubStorageProvider({
      config: { owner: 'octo', repo: 'notes', branch: 'main' }, token: 'token', client: renameClient,
    });
    await renameProvider.initialize();
    await renameProvider.upload({ directory: 'docs', file: uploadFile(), conflict: 'rename' });
    expect(renameClient.put).toHaveBeenCalledWith(
      '/repos/octo/notes/contents/docs/a%20(1).md',
      expect.not.objectContaining({ sha: expect.anything() }),
      expect.any(Object),
    );

    const overwriteClient = createClient([
      ...treeResponses(tree), ...treeResponses(tree),
      { data: { commit: { sha: 'overwrite-commit' } } }, ...treeResponses(tree),
    ]);
    const overwriteProvider = new GitHubStorageProvider({
      config: { owner: 'octo', repo: 'notes', branch: 'main' }, token: 'token', client: overwriteClient,
    });
    await overwriteProvider.initialize();
    await overwriteProvider.upload({ directory: 'docs', file: uploadFile(), conflict: 'overwrite' });
    expect(overwriteClient.put.mock.calls[0][1]).toMatchObject({ sha: 'a', branch: 'main' });
  });

  it('creates directories and deletes files with fresh-state payloads', async () => {
    const mkdirClient = createClient([
      ...treeResponses(tree), ...treeResponses(tree),
      { data: { commit: { sha: 'mkdir-commit' } } }, ...treeResponses(tree),
    ]);
    const mkdirProvider = new GitHubStorageProvider({
      config: { owner: 'octo', repo: 'notes', branch: 'main' }, token: 'token', client: mkdirClient,
    });
    await mkdirProvider.initialize();
    await mkdirProvider.createDirectory({ path: 'docs/new' });
    expect(mkdirClient.put).toHaveBeenCalledWith(
      '/repos/octo/notes/contents/docs/new/.gitkeep',
      expect.objectContaining({ content: '', branch: 'main' }),
      expect.any(Object),
    );

    const deleteClient = createClient([
      ...treeResponses(tree), ...treeResponses(tree),
      { data: { commit: { sha: 'delete-commit' } } }, ...treeResponses(tree),
    ]);
    const deleteProvider = new GitHubStorageProvider({
      config: { owner: 'octo', repo: 'notes', branch: 'main' }, token: 'token', client: deleteClient,
    });
    await deleteProvider.initialize();
    await deleteProvider.deleteFile({ path: 'docs/a.md' });
    expect(deleteClient.delete.mock.calls[0][1].data).toMatchObject({ sha: 'a', branch: 'main' });
  });

  it('marks response-less writes as uncertain and preserves applied refresh failures', async () => {
    const unknownClient = createClient([
      ...treeResponses(tree), ...treeResponses(tree), new Error('response lost'),
    ]);
    const unknownProvider = new GitHubStorageProvider({
      config: { owner: 'octo', repo: 'notes', branch: 'main' }, token: 'token', client: unknownClient,
    });
    await unknownProvider.initialize();
    await expect(unknownProvider.upload({ directory: 'docs', file: uploadFile('new.md') }))
      .rejects.toMatchObject({ code: 'MUTATION_RESULT_UNKNOWN', uncertain: true });

    const appliedClient = createClient([
      ...treeResponses(tree), ...treeResponses(tree),
      { data: { commit: { sha: 'applied-commit' } } }, new Error('refresh offline'),
    ]);
    const appliedProvider = new GitHubStorageProvider({
      config: { owner: 'octo', repo: 'notes', branch: 'main' }, token: 'token', client: appliedClient,
    });
    await appliedProvider.initialize();
    await expect(appliedProvider.upload({ directory: 'docs', file: uploadFile('new.md') }))
      .rejects.toMatchObject({ code: 'MUTATION_APPLIED_REFRESH_FAILED', applied: true, commitSha: 'applied-commit' });
  });

  it('deletes a directory through a fresh tree and force:false ref update', async () => {
    const client = createClient([
      ...treeResponses(tree),
      ...treeResponses(tree),
      { data: { sha: 'new-tree' } },
      { data: { sha: 'new-commit' } },
      { data: { object: { sha: 'new-commit' } } },
      { data: { object: { sha: 'new-commit' } } },
      { data: { tree: { sha: 'new-tree' } } },
      { data: { tree: [], truncated: false } },
    ]);
    const provider = new GitHubStorageProvider({
      config: { owner: 'octo', repo: 'notes', branch: 'main' }, token: 'token', client,
    });
    await provider.initialize();
    await provider.deleteDirectory({ path: 'docs', message: 'delete docs' });

    const treePayload = client.post.mock.calls[0][1].tree;
    expect(treePayload.map((entry) => entry.path)).toEqual([
      'docs/.gitkeep', 'docs/a.md', 'docs/link', 'docs/vendor',
    ]);
    expect(treePayload.every((entry) => entry.sha === null)).toBe(true);
    expect(client.patch).toHaveBeenCalledWith('/repos/octo/notes/git/refs/heads/main',
      { sha: 'new-commit', force: false }, expect.any(Object));
  });

  it('revalidates and applies a batch as one Git commit', async () => {
    const client = createClient([
      ...treeResponses(tree),
      ...treeResponses(tree),
      { data: { sha: 'blob-1' } },
      { data: { sha: 'blob-2' } },
      { data: { sha: 'batch-tree' } },
      { data: { sha: 'batch-commit' } },
      { data: { object: { sha: 'batch-commit' } } },
      ...treeResponses(tree),
    ]);
    const provider = new GitHubStorageProvider({
      config: { owner: 'octo', repo: 'notes', branch: 'main' }, token: 'token', client,
    });
    await provider.initialize();
    const draft = createBatchUploadDraft([uploadFile('new-1.md'), uploadFile('new-2.md')], {
      directory: 'docs', snapshot: provider.snapshot,
    });
    const approved = planBatchUpload({ draft, snapshot: provider.snapshot });
    const result = await provider.uploadBatch({ draft, fingerprint: approved.fingerprint, message: 'batch upload' });

    expect(result.commitSha).toBe('batch-commit');
    expect(client.post).toHaveBeenCalledTimes(4);
    expect(client.patch).toHaveBeenCalledTimes(1);
    expect(client.patch).toHaveBeenCalledWith('/repos/octo/notes/git/refs/heads/main',
      { sha: 'batch-commit', force: false }, expect.any(Object));
  });

  it('installs the fresh snapshot and creates no blobs when the upload destination becomes stale', async () => {
    const client = createClient([
      ...treeResponses(tree),
      ...treeResponses([], { commitSha: 'commit-2', treeSha: 'tree-2' }),
    ]);
    const provider = new GitHubStorageProvider({
      config: { owner: 'octo', repo: 'notes', branch: 'main' }, token: 'token', client,
    });
    await provider.initialize();
    const draft = createBatchUploadDraft([uploadFile('new.md')], {
      directory: 'docs', snapshot: provider.snapshot,
    });
    const approved = planBatchUpload({ draft, snapshot: provider.snapshot });

    await expect(provider.uploadBatch({ draft, fingerprint: approved.fingerprint }))
      .rejects.toMatchObject({ code: 'BATCH_UPLOAD_STALE' });
    expect(provider.snapshot.commitSha).toBe('commit-2');
    expect(client.post).not.toHaveBeenCalled();
    expect(client.patch).not.toHaveBeenCalled();
  });

  it('treats a lost ref-update response as an uncertain directory mutation', async () => {
    const client = createClient([
      ...treeResponses(tree), ...treeResponses(tree),
      { data: { sha: 'new-tree' } },
      { data: { sha: 'new-commit' } },
      new Error('ref response lost'),
    ]);
    const provider = new GitHubStorageProvider({
      config: { owner: 'octo', repo: 'notes', branch: 'main' }, token: 'token', client,
    });
    await provider.initialize();
    await expect(provider.deleteDirectory({ path: 'docs' })).rejects.toMatchObject({
      code: 'MUTATION_RESULT_UNKNOWN', uncertain: true, operation: 'update-ref',
    });
  });
});
