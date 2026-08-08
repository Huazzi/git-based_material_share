import { reactive } from 'vue';
import { AppError } from '@/errors/AppError.js';
import { ZipArchiveService } from '@/services/archive/ZipArchiveService.js';
import { planBatchDownload } from '@/services/batch/BatchDownloadPlanner.js';
import { downloadBlob } from '@/utils/download.js';

export function useBatchDownload(getProvider, { archiveService = new ZipArchiveService() } = {}) {
  const state = reactive({
    visible: false,
    plan: null,
    phase: 'idle',
    completedFiles: 0,
    totalFiles: 0,
    loadedBytes: 0,
    totalBytes: 0,
    activePath: '',
    error: null,
  });
  let controller = null;
  let epoch = 0;

  function invalidateRun() {
    epoch += 1;
    const previous = controller;
    controller = null;
    previous?.abort();
  }

  function prepare(entries) {
    invalidateRun();
    const provider = getProvider();
    const plan = planBatchDownload({ snapshot: provider.snapshot, selectedEntries: entries });
    Object.assign(state, {
      visible: true,
      plan,
      phase: 'ready',
      completedFiles: 0,
      totalFiles: plan.totalFiles,
      loadedBytes: 0,
      totalBytes: plan.totalBytes,
      activePath: '',
      error: null,
    });
    return plan;
  }

  async function start() {
    if (!state.plan) return { status: 'unavailable', error: null };
    if (state.phase === 'running' || state.phase === 'finalizing') return { status: 'busy', error: null };
    const runEpoch = ++epoch;
    const runController = new AbortController();
    const runPlan = state.plan;
    controller = runController;
    const isCurrent = () => runEpoch === epoch && controller === runController;
    state.phase = 'running';
    state.error = null;
    try {
      const result = await archiveService.create({
        plan: runPlan,
        provider: getProvider(),
        signal: runController.signal,
        onProgress: (progress) => {
          if (isCurrent()) Object.assign(state, progress);
        },
      });
      if (!isCurrent()) return { status: 'stale', error: null };
      if (result.blob) downloadBlob(result.blob, runPlan.archiveName);
      state.phase = 'complete';
      return { status: 'complete', error: null };
    } catch (error) {
      if (!isCurrent()) return { status: 'stale', error: null };
      state.error = error;
      const status = error?.code === 'ABORTED' ? 'cancelled' : 'error';
      state.phase = status;
      return { status, error };
    } finally {
      if (isCurrent()) controller = null;
    }
  }

  function cancel() {
    if (state.phase === 'running') controller?.abort();
  }

  function close() {
    if (state.phase === 'running' || state.phase === 'finalizing') {
      throw new AppError('DOWNLOAD_IN_PROGRESS', 'Cancel the batch download before closing.');
    }
    invalidateRun();
    Object.assign(state, { visible: false, plan: null, phase: 'idle', error: null, activePath: '' });
  }

  function dispose() {
    invalidateRun();
    Object.assign(state, {
      visible: false, plan: null, phase: 'idle', error: null, activePath: '',
      completedFiles: 0, totalFiles: 0, loadedBytes: 0, totalBytes: 0,
    });
  }

  return { state, prepare, start, cancel, close, dispose };
}
