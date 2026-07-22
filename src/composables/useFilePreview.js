import { reactive } from 'vue';
import { getFilePolicy } from '@/constants/fileLimits.js';
import { resolvePreview } from '@/services/preview/previewRegistry.js';
import { downloadBlob } from '@/utils/download.js';
import { AppError } from '@/errors/AppError.js';

export function useFilePreview(getProvider) {
  const state = reactive({
    visible: false,
    entry: null,
    rawFile: null,
    descriptor: null,
    loading: false,
    error: null,
    downloadBusy: false,
    downloadEntry: null,
  });
  let controller = null;
  let epoch = 0;
  let downloadController = null;
  let downloadEpoch = 0;

  function cancelActiveRequest() {
    controller?.abort();
    controller = null;
    epoch += 1;
  }

  async function open(entry) {
    cancelActiveRequest();
    Object.assign(state, {
      visible: true,
      entry,
      rawFile: null,
      descriptor: resolvePreview(entry),
      loading: false,
      error: null,
    });
    const policy = getFilePolicy(entry.size);
    if (!state.descriptor.supported) return;
    if (!policy.preview) return;

    const requestEpoch = epoch;
    controller = new AbortController();
    state.loading = true;
    try {
      const rawFile = await getProvider().readFile(entry.path, {
        purpose: 'preview', signal: controller.signal,
      });
      if (requestEpoch === epoch && state.visible) state.rawFile = rawFile;
    } catch (error) {
      if (requestEpoch === epoch && error.code !== 'ABORTED') state.error = error;
    } finally {
      if (requestEpoch === epoch) state.loading = false;
    }
  }

  function close() {
    cancelActiveRequest();
    Object.assign(state, {
      visible: false, entry: null, rawFile: null, descriptor: null, loading: false, error: null,
    });
  }

  async function download(entry) {
    if (state.downloadBusy) {
      throw new AppError('DOWNLOAD_IN_PROGRESS', 'Another download is already active.');
    }
    const requestEpoch = ++downloadEpoch;
    downloadController = new AbortController();
    state.downloadBusy = true;
    state.downloadEntry = entry;
    try {
      const rawFile = await getProvider().readFile(entry.path, {
        purpose: 'download', signal: downloadController.signal,
      });
      if (requestEpoch !== downloadEpoch) throw new AppError('ABORTED', 'Download aborted.');
      downloadBlob(rawFile.blob, entry.name);
    } finally {
      if (requestEpoch === downloadEpoch) {
        downloadController = null;
        state.downloadBusy = false;
        state.downloadEntry = null;
      }
    }
  }

  function cancelDownload() {
    downloadEpoch += 1;
    downloadController?.abort();
    downloadController = null;
    state.downloadBusy = false;
    state.downloadEntry = null;
  }

  function dispose() {
    close();
    cancelDownload();
  }

  return { state, open, close, download, cancelDownload, dispose };
}
