import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/errors/AppError.js';
import { useBatchDownload } from '@/composables/useBatchDownload.js';
import { RepositorySnapshot } from '@/services/storage/RepositorySnapshot.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function provider(commitSha, path) {
  const snapshot = new RepositorySnapshot({
    commitSha, treeSha: `tree-${commitSha}`, tree: [
      { path, type: 'blob', mode: '100644', sha: `${commitSha}-blob`, size: 1 },
    ],
  });
  return { snapshot };
}

describe('useBatchDownload', () => {
  it('ignores stale progress and completion after dispose and preserves the newer controller', async () => {
    const runs = [];
    const archiveService = {
      create: vi.fn((options) => {
        const pending = deferred();
        runs.push({ ...pending, options });
        return pending.promise;
      }),
    };
    let activeProvider = provider('commit-a', 'a.txt');
    const batch = useBatchDownload(() => activeProvider, { archiveService });

    batch.prepare([activeProvider.snapshot.stat('a.txt')]);
    const runA = batch.start();
    await Promise.resolve();

    batch.dispose();
    activeProvider = provider('commit-b', 'b.txt');
    batch.prepare([activeProvider.snapshot.stat('b.txt')]);
    const planB = batch.state.plan;
    const runB = batch.start();
    await Promise.resolve();

    runs[0].options.onProgress({ activePath: 'stale.txt', completedFiles: 99 });
    runs[0].resolve({ streamed: true, blob: null });
    await expect(runA).resolves.toEqual({ status: 'stale', error: null });
    expect(batch.state.plan).toBe(planB);
    expect(batch.state.phase).toBe('running');
    expect(batch.state.activePath).toBe('');
    expect(batch.state.completedFiles).toBe(0);

    batch.cancel();
    expect(runs[1].options.signal.aborted).toBe(true);
    runs[1].reject(new AppError('ABORTED', 'cancelled'));
    await expect(runB).resolves.toMatchObject({ status: 'cancelled', error: { code: 'ABORTED' } });
    expect(batch.state.phase).toBe('cancelled');
  });

  it('treats finalization as non-cancellable and completes only from the invocation result', async () => {
    const pending = deferred();
    let runOptions;
    const archiveService = {
      create: vi.fn((options) => {
        runOptions = options;
        options.onProgress({ phase: 'finalizing', completedFiles: 1, totalFiles: 1 });
        return pending.promise;
      }),
    };
    const activeProvider = provider('commit-final', 'final.txt');
    const batch = useBatchDownload(() => activeProvider, { archiveService });
    batch.prepare([activeProvider.snapshot.stat('final.txt')]);

    const running = batch.start();
    await Promise.resolve();
    expect(batch.state.phase).toBe('finalizing');
    batch.cancel();
    expect(runOptions.signal.aborted).toBe(false);

    pending.resolve({ streamed: true, blob: null });
    await expect(running).resolves.toEqual({ status: 'complete', error: null });
    expect(batch.state.phase).toBe('complete');
  });
});
