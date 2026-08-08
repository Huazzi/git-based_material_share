import { ref } from 'vue';

export function useRepositoryMutations({ getProvider, browser }) {
  const status = ref('');
  const error = ref(null);

  function clearError() {
    error.value = null;
  }

  async function reconcile(caught) {
    if (caught?.code === 'BATCH_UPLOAD_STALE') {
      browser.invalidateView();
      browser.sync();
      return { ok: false, error: caught, requiresAudit: false, refreshFailed: false, reviewUpdated: true };
    }
    const requiresAudit = Boolean(caught?.applied || caught?.uncertain);
    let refreshFailed = false;
    if (requiresAudit) {
      try {
        await browser.refresh();
      } catch {
        refreshFailed = true;
      }
    }
    return { ok: false, error: caught, requiresAudit, refreshFailed };
  }

  async function upload(command, directory) {
    clearError();
    status.value = '正在读取文件并创建 GitHub commit…';
    try {
      const result = await getProvider().upload({ ...command, directory });
      browser.invalidateView();
      browser.sync();
      return { ok: true, result };
    } catch (caught) {
      error.value = caught;
      return reconcile(caught);
    } finally {
      status.value = '';
    }
  }

  async function uploadBatch(command) {
    clearError();
    status.value = '正在准备批量提交…';
    try {
      const result = await getProvider().uploadBatch({
        ...command,
        onProgress: ({ phase, current, total, name }) => {
          if (phase === 'blob') status.value = `正在上传 ${current}/${total}：${name}`;
          else if (phase === 'tree') status.value = '正在创建 Git tree…';
          else if (phase === 'commit') status.value = '正在创建原子 commit…';
          else status.value = '正在更新远端分支…';
        },
      });
      browser.invalidateView();
      browser.sync();
      return { ok: true, result };
    } catch (caught) {
      error.value = caught;
      return reconcile(caught);
    } finally {
      status.value = '';
    }
  }

  async function createDirectory(command) {
    clearError();
    try {
      const result = await getProvider().createDirectory(command);
      browser.invalidateView();
      browser.sync();
      return { ok: true, result };
    } catch (caught) {
      error.value = caught;
      return reconcile(caught);
    }
  }

  async function remove(entry, message) {
    clearError();
    try {
      const provider = getProvider();
      const result = entry.kind === 'directory'
        ? await provider.deleteDirectory({ path: entry.path, message })
        : await provider.deleteFile({ path: entry.path, message });
      browser.invalidateView();
      browser.sync();
      return { ok: true, result };
    } catch (caught) {
      error.value = caught;
      return reconcile(caught);
    }
  }

  return { status, error, clearError, upload, uploadBatch, createDirectory, remove };
}
