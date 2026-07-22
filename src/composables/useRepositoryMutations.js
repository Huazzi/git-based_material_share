import { ref } from 'vue';

export function useRepositoryMutations({ getProvider, browser }) {
  const status = ref('');
  const error = ref(null);

  function clearError() {
    error.value = null;
  }

  async function reconcile(caught) {
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
      browser.sync();
      return { ok: true, result };
    } catch (caught) {
      error.value = caught;
      return reconcile(caught);
    }
  }

  return { status, error, clearError, upload, createDirectory, remove };
}
