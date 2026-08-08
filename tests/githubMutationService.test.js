import { describe, expect, it, vi } from 'vitest';
import { GitHubMutationService } from '@/services/github/githubMutationService.js';

describe('GitHubMutationService', () => {
  it('marks only branch-changing requests as uncertain mutations', async () => {
    const request = vi.fn(async (_method, _url, _options, metadata) => {
      if (metadata.operation === 'create-delete-tree') return { data: { sha: 'new-tree' } };
      if (metadata.operation === 'create-delete-commit') return { data: { sha: 'new-commit' } };
      return { data: { commit: { sha: `${metadata.operation}-commit` } } };
    });
    const service = new GitHubMutationService({
      request, basePath: '/repos/octo/notes', branch: 'feature/x',
    });
    const file = {
      arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode('x').buffer),
    };

    await service.upload({ path: 'docs/x.txt', file, name: 'x.txt' });
    await service.createDirectory({ keepPath: 'new/.gitkeep', directoryPath: 'new' });
    await service.deleteFile({ path: 'docs/x.txt', entry: { name: 'x.txt', sha: 'blob' } });
    await service.deleteDirectory({
      snapshot: { treeSha: 'tree', commitSha: 'head' },
      path: 'docs',
      leaves: [
        { path: 'docs/x.txt', mode: '100644', kind: 'file' },
        { path: 'docs/vendor', mode: '160000', kind: 'submodule' },
      ],
    });

    const metadata = request.mock.calls.map((call) => call[3]);
    expect(metadata.filter((item) => item.mutation).map((item) => item.operation)).toEqual([
      'upload', 'create-directory', 'delete-file', 'update-ref',
    ]);
    expect(request).toHaveBeenLastCalledWith(
      'patch',
      '/repos/octo/notes/git/refs/heads/feature/x',
      { data: { sha: 'new-commit', force: false } },
      { operation: 'update-ref', mutation: true },
    );
    expect(request.mock.calls.find((call) => call[3].operation === 'create-delete-tree')[2].data.tree)
      .toEqual([
        { path: 'docs/x.txt', mode: '100644', type: 'blob', sha: null },
        { path: 'docs/vendor', mode: '160000', type: 'commit', sha: null },
      ]);
  });

  it('creates blobs before one tree, one commit and one non-forced ref update for a batch', async () => {
    let blobCounter = 0;
    const request = vi.fn(async (_method, _url, _options, metadata) => {
      if (metadata.operation === 'create-upload-blob') return { data: { sha: `blob-${++blobCounter}` } };
      if (metadata.operation === 'create-upload-tree') return { data: { sha: 'batch-tree' } };
      if (metadata.operation === 'create-upload-commit') return { data: { sha: 'batch-commit' } };
      return { data: { object: { sha: 'batch-commit' } } };
    });
    const service = new GitHubMutationService({ request, basePath: '/repos/octo/notes', branch: 'main' });
    const makeFile = (text) => ({ arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode(text).buffer) });

    const sha = await service.uploadBatch({
      snapshot: { treeSha: 'base-tree', commitSha: 'head' },
      files: [
        { file: makeFile('a'), targetName: 'a.txt', targetPath: 'docs/a.txt', mode: '100644' },
        { file: makeFile('b'), targetName: 'b.txt', targetPath: 'docs/b.txt', mode: '100644' },
      ],
      message: 'batch',
    });

    expect(sha).toBe('batch-commit');
    expect(request.mock.calls.map((call) => call[3].operation)).toEqual([
      'create-upload-blob', 'create-upload-blob', 'create-upload-tree', 'create-upload-commit', 'update-ref',
    ]);
    expect(request.mock.calls[2][2].data).toEqual({
      base_tree: 'base-tree',
      tree: [
        { path: 'docs/a.txt', mode: '100644', type: 'blob', sha: 'blob-1' },
        { path: 'docs/b.txt', mode: '100644', type: 'blob', sha: 'blob-2' },
      ],
    });
    expect(request.mock.calls.filter((call) => call[3].mutation)).toHaveLength(1);
    expect(request).toHaveBeenLastCalledWith('patch', '/repos/octo/notes/git/refs/heads/main', {
      data: { sha: 'batch-commit', force: false },
    }, { operation: 'update-ref', mutation: true });
  });
});
