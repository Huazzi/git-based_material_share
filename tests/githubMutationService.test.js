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
});
