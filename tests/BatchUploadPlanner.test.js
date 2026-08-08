import { describe, expect, it } from 'vitest';
import { FILE_LIMITS } from '@/constants/fileLimits.js';
import { createBatchUploadDraft, planBatchUpload } from '@/services/batch/BatchUploadPlanner.js';
import { RepositorySnapshot } from '@/services/storage/RepositorySnapshot.js';

function file(name, size = 4) {
  return { name, size, arrayBuffer: async () => new ArrayBuffer(size) };
}

function snapshot(tree = []) {
  return new RepositorySnapshot({ commitSha: 'commit-1', treeSha: 'tree-1', tree });
}

const remoteTree = [
  { path: 'docs', type: 'tree', mode: '040000', sha: 'docs-tree' },
  { path: 'docs/a.txt', type: 'blob', mode: '100644', sha: 'a-sha', size: 4 },
  { path: 'docs/folder', type: 'tree', mode: '040000', sha: 'folder-tree' },
];

describe('BatchUploadPlanner', () => {
  it('enforces count, per-file and aggregate limits', () => {
    expect(() => createBatchUploadDraft(Array.from({ length: 21 }, (_, i) => file(`${i}.txt`)), { snapshot: snapshot() }))
      .toThrowError(expect.objectContaining({ code: 'BATCH_UPLOAD_COUNT_EXCEEDED' }));
    expect(() => createBatchUploadDraft([file('large.bin', FILE_LIMITS.upload + 1)], { snapshot: snapshot() }))
      .toThrowError(expect.objectContaining({ code: 'UPLOAD_TOO_LARGE' }));
    expect(() => createBatchUploadDraft(Array.from({ length: 5 }, (_, i) => file(`${i}.bin`, FILE_LIMITS.upload)), { snapshot: snapshot() }))
      .toThrowError(expect.objectContaining({ code: 'BATCH_UPLOAD_TOTAL_EXCEEDED' }));
  });

  it('requires explicit remote conflict decisions and records overwrite sha', () => {
    const current = snapshot(remoteTree);
    const draft = createBatchUploadDraft([file('a.txt')], { directory: 'docs', snapshot: current });
    expect(() => planBatchUpload({ draft, snapshot: current }))
      .toThrowError(expect.objectContaining({ code: 'BATCH_CONFLICT_UNRESOLVED' }));
    draft.files[0].action = 'overwrite';
    const plan = planBatchUpload({ draft, snapshot: current });
    expect(plan.activeFiles[0]).toMatchObject({ targetPath: 'docs/a.txt', disposition: 'overwrite', expectedSha: 'a-sha' });
  });

  it('allows later local duplicates to rename or skip but never overwrite', () => {
    const current = snapshot();
    const draft = createBatchUploadDraft([file('same.txt'), file('same.txt')], { snapshot: current });
    draft.files[1].action = 'overwrite';
    expect(() => planBatchUpload({ draft, snapshot: current }))
      .toThrowError(expect.objectContaining({ code: 'BATCH_DUPLICATE_TARGET' }));
    draft.files[1].action = 'rename';
    expect(planBatchUpload({ draft, snapshot: current }).activeFiles.map((item) => item.targetPath))
      .toEqual(['same.txt', 'same (1).txt']);
  });

  it('keeps the first duplicate path reserved even when the first item is skipped', () => {
    const current = snapshot(remoteTree);
    const draft = createBatchUploadDraft([file('a.txt'), file('a.txt')], { directory: 'docs', snapshot: current });
    draft.files[0].action = 'skip';
    draft.files[1].action = 'overwrite';
    expect(() => planBatchUpload({ draft, snapshot: current }))
      .toThrowError(expect.objectContaining({ code: 'BATCH_DUPLICATE_TARGET' }));
    draft.files[1].action = 'rename';
    expect(planBatchUpload({ draft, snapshot: current }).activeFiles[0].targetPath).toBe('docs/a (1).txt');
  });

  it.each([
    ['missing', []],
    ['file', [{ path: 'docs', type: 'blob', mode: '100644', sha: 'docs-file', size: 1 }]],
    ['symlink', [{ path: 'docs', type: 'blob', mode: '120000', sha: 'docs-link', size: 1 }]],
    ['submodule', [{ path: 'docs', type: 'commit', mode: '160000', sha: 'docs-submodule' }]],
  ])('rejects a %s upload destination before mutation planning', (_label, freshTree) => {
    const approvedSnapshot = snapshot(remoteTree);
    const draft = createBatchUploadDraft([file('new.txt')], { directory: 'docs', snapshot: approvedSnapshot });
    const approved = planBatchUpload({ draft, snapshot: approvedSnapshot });
    expect(() => planBatchUpload({ draft, snapshot: snapshot(freshTree), expectedFingerprint: approved.fingerprint }))
      .toThrowError(expect.objectContaining({ code: 'BATCH_UPLOAD_STALE' }));
  });

  it('allows unrelated changes while the destination remains a directory', () => {
    const approvedSnapshot = snapshot(remoteTree);
    const draft = createBatchUploadDraft([file('new.txt')], { directory: 'docs', snapshot: approvedSnapshot });
    const approved = planBatchUpload({ draft, snapshot: approvedSnapshot });
    const changed = snapshot([...remoteTree, { path: 'docs/other.txt', type: 'blob', mode: '100644', sha: 'other', size: 2 }]);
    expect(planBatchUpload({ draft, snapshot: changed, expectedFingerprint: approved.fingerprint }).activeFiles[0].targetPath)
      .toBe('docs/new.txt');
  });

  it('detects a stale approved plan before creating Git objects', () => {
    const current = snapshot(remoteTree);
    const draft = createBatchUploadDraft([file('a.txt')], { directory: 'docs', snapshot: current });
    draft.files[0].action = 'overwrite';
    const approved = planBatchUpload({ draft, snapshot: current });
    const changed = snapshot(remoteTree.map((entry) => entry.path === 'docs/a.txt' ? { ...entry, sha: 'new-sha' } : entry));
    expect(() => planBatchUpload({ draft, snapshot: changed, expectedFingerprint: approved.fingerprint }))
      .toThrowError(expect.objectContaining({ code: 'BATCH_UPLOAD_STALE' }));
  });
});
