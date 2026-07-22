import { computed, ref, shallowRef } from 'vue';
import { getFileName, getParentPath, normalizePath } from '@/utils/path.js';

export function useRepositoryBrowser() {
  const provider = shallowRef(null);
  const currentPath = ref('');
  const entries = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const searchQuery = ref('');
  const searchActive = ref(false);

  const breadcrumbs = computed(() => {
    const parts = currentPath.value.split('/').filter(Boolean);
    return parts.map((name, index) => ({ name, path: parts.slice(0, index + 1).join('/') }));
  });

  function sync() {
    if (!provider.value) {
      entries.value = [];
      return;
    }
    entries.value = searchActive.value
      ? provider.value.search(searchQuery.value)
      : provider.value.list(currentPath.value);
  }

  function captureState() {
    return {
      currentPath: currentPath.value,
      searchQuery: searchQuery.value,
      searchActive: searchActive.value,
    };
  }

  function attachInitialized(nextProvider) {
    provider.value = nextProvider;
    currentPath.value = '';
    searchQuery.value = '';
    searchActive.value = false;
    error.value = null;
    loading.value = false;
    sync();
  }

  function restore(nextProvider, state) {
    provider.value = nextProvider;
    currentPath.value = state?.currentPath || '';
    searchQuery.value = state?.searchQuery || '';
    searchActive.value = Boolean(state?.searchActive);
    error.value = null;
    loading.value = false;
    sync();
  }

  function detach() {
    provider.value = null;
    currentPath.value = '';
    searchQuery.value = '';
    searchActive.value = false;
    entries.value = [];
    error.value = null;
    loading.value = false;
  }

  async function attach(nextProvider, { initialized = false } = {}) {
    if (initialized) {
      attachInitialized(nextProvider);
      return;
    }
    provider.value = nextProvider;
    currentPath.value = '';
    searchQuery.value = '';
    searchActive.value = false;
    error.value = null;
    loading.value = true;
    try {
      await nextProvider.initialize();
      sync();
    } catch (caught) {
      error.value = caught;
      throw caught;
    } finally {
      loading.value = false;
    }
  }

  async function refresh() {
    if (!provider.value) return;
    loading.value = true;
    error.value = null;
    try {
      await provider.value.refresh();
      sync();
    } catch (caught) {
      error.value = caught;
      throw caught;
    } finally {
      loading.value = false;
    }
  }

  function navigate(path) {
    currentPath.value = normalizePath(path);
    searchActive.value = false;
    searchQuery.value = '';
    sync();
  }

  function goUp() {
    navigate(getParentPath(currentPath.value));
  }

  function search() {
    searchActive.value = Boolean(searchQuery.value.trim());
    sync();
  }

  function clearSearch() {
    searchQuery.value = '';
    searchActive.value = false;
    sync();
  }

  function directoryNames() {
    return new Set(provider.value?.list(currentPath.value).map((entry) => entry.name) || []);
  }

  function describeCurrentDirectory() {
    return currentPath.value ? getFileName(currentPath.value) : '根目录';
  }

  return {
    provider,
    currentPath,
    entries,
    loading,
    error,
    searchQuery,
    searchActive,
    breadcrumbs,
    captureState,
    attachInitialized,
    restore,
    detach,
    attach,
    refresh,
    navigate,
    goUp,
    search,
    clearSearch,
    sync,
    directoryNames,
    describeCurrentDirectory,
  };
}
