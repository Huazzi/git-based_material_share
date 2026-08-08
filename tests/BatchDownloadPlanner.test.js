import { describe, expect, it } from 'vitest';
import { FILE_LIMITS } from '@/constants/fileLimits.js';
import { planBatchDownload } from '@/services/batch/BatchDownloadPlanner.js';
import { RepositorySnapshot } from '@/services/storage/RepositorySnapshot.js';

function makeSnapshot(extra = []) {
  return new RepositorySnapshot({
    commitSha: 'commit-1', treeSha: 'tree-1', tree: [
      { path: 'docs', type: 'tree', mode: '040000', sha: 'docs' },
      { path: 'docs/.gitkeep', type: 'blob', mode: '100644', sha: 'keep', size: 0 },
      { path: 'docs/a.txt', type: 'blob', mode: '100644', sha: 'a', size: 4 },
      { path: 'docs/sub', type: 'tree', mode: '040000', sha: 'sub' },
      { path: 'docs/sub/b.txt', type: 'blob', mode: '100644', sha: 'b', size: 6 },
      { path: 'docs/link', type: 'blob', mode: '120000', sha: 'link', size: 3 },
      { path: 'readme.md', type: 'blob', mode: '100644', sha: 'readme', size: 2 },
      ...extra,
    ],
  });
}

describe('BatchDownloadPlanner', () => {
  it('expands folders, deduplicates overlap and excludes system/special nodes', () => {
    const snapshot = makeSnapshot();
    const plan = planBatchDownload({ snapshot, selectedEntries: [snapshot.stat('docs'), snapshot.stat('docs/a.txt')] });
    expect(plan.files.map((item) => item.archivePath)).toEqual(['docs/a.txt', 'docs/sub/b.txt']);
    expect(plan.directories).toEqual(['docs/', 'docs/sub/']);
    expect(plan.excluded.map((item) => item.entry.path)).toEqual(['docs/.gitkeep', 'docs/link']);
    expect(plan.totalBytes).toBe(10);
  });

  it('uses the shortest common parent for selected files', () => {
    const snapshot = makeSnapshot();
    const plan = planBatchDownload({ snapshot, selectedEntries: [snapshot.stat('docs/a.txt'), snapshot.stat('docs/sub/b.txt')] });
    expect(plan.rootPath).toBe('docs');
    expect(plan.files.map((item) => item.archivePath)).toEqual(['a.txt', 'sub/b.txt']);
  });

  it('rejects per-file, expanded-count and aggregate limit violations', () => {
    const oversized = makeSnapshot([{ path: 'large.bin', type: 'blob', mode: '100644', sha: 'large', size: FILE_LIMITS.download + 1 }]);
    expect(() => planBatchDownload({ snapshot: oversized, selectedEntries: [oversized.stat('large.bin')] }))
      .toThrowError(expect.objectContaining({ code: 'DOWNLOAD_TOO_LARGE' }));

    const manyTree = Array.from({ length: 51 }, (_, index) => ({ path: `many/${index}.txt`, type: 'blob', mode: '100644', sha: `${index}`, size: 1 }));
    manyTree.unshift({ path: 'many', type: 'tree', mode: '040000', sha: 'many' });
    const many = new RepositorySnapshot({ commitSha: 'c', treeSha: 't', tree: manyTree });
    expect(() => planBatchDownload({ snapshot: many, selectedEntries: [many.stat('many')] }))
      .toThrowError(expect.objectContaining({ code: 'BATCH_DOWNLOAD_COUNT_EXCEEDED' }));
  });
});
