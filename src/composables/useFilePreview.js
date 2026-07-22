import { reactive } from 'vue';
import { getFilePolicy } from '@/constants/fileLimits.js';
import { resolvePreview } from '@/services/preview/previewRegistry.js';
import { downloadBlob } from '@/utils/download.js';

export function useFilePreview(getProvider) {
  const state = reactive({
    visible: false,
    entry: null,
    rawFile: null,
    descriptor: null,
    loading: false,
    error: null,
  });
  let controller = null;
  let epoch = 0;

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
    const rawFile = await getProvider().readFile(entry.path, { purpose: 'download' });
    downloadBlob(rawFile.blob, entry.name);
  }

  return { state, open, close, download };
}
