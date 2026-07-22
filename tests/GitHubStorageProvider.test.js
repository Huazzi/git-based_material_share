import { describe, expect, it, vi } from 'vitest';
import { GitHubStorageProvider } from '@/services/storage/GitHubStorageProvider.js';

function treeResponses(tree) {
  return [
    { data: { object: { sha: 'commit-1' } } },
    { data: { tree: { sha: 'tree-1' } } },
    { data: { tree, truncated: false } },
  ];
}

function createClient(responses) {
  const next = vi.fn(async () => {
    const response = responses.shift();
    if (response instanceof Error) throw response;
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
];

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
});
