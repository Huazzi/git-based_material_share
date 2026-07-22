import { describe, expect, it } from 'vitest';
import { RepositorySnapshot } from '@/services/storage/RepositorySnapshot.js';

const tree = [
  { path: 'docs', type: 'tree', mode: '040000', sha: 'tree-docs' },
  { path: 'docs/.gitkeep', type: 'blob', mode: '100644', sha: 'keep', size: 0 },
  { path: 'docs/Guide.md', type: 'blob', mode: '100644', sha: 'guide', size: 42 },
  { path: 'code', type: 'tree', mode: '040000', sha: 'tree-code' },
  { path: 'code/app.js', type: 'blob', mode: '100644', sha: 'app', size: 7 },
  { path: 'vendor', type: 'commit', mode: '160000', sha: 'submodule' },
];

describe('RepositorySnapshot', () => {
  it('maps, sorts, filters and searches a complete tree locally', () => {
    const snapshot = new RepositorySnapshot({ commitSha: 'commit', treeSha: 'root', tree });
    expect(snapshot.list('').map((entry) => entry.path)).toEqual(['code', 'docs', 'vendor']);
    expect(snapshot.list('docs').map((entry) => entry.name)).toEqual(['Guide.md']);
    expect(snapshot.search('guide')).toHaveLength(1);
    expect(snapshot.stat('vendor').kind).toBe('submodule');
  });

  it('fails closed when GitHub truncates the recursive tree', () => {
    expect(() => new RepositorySnapshot({ commitSha: 'c', treeSha: 't', tree, truncated: true }))
      .toThrowError(expect.objectContaining({ code: 'TREE_TRUNCATED' }));
  });

  it('uses an exact directory prefix for deletion leaves', () => {
    const snapshot = new RepositorySnapshot({ commitSha: 'commit', treeSha: 'root', tree });
    expect(snapshot.descendantLeaves('docs').map((entry) => entry.path))
      .toEqual(['docs/.gitkeep', 'docs/Guide.md']);
  });
});
