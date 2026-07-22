import { reactive, ref, shallowRef } from 'vue';
import { AppError } from '@/errors/AppError.js';
import { GitHubStorageProvider } from '@/services/storage/GitHubStorageProvider.js';

export function useRepositorySession({ browser, providerFactory } = {}) {
  const activeProvider = shallowRef(null);
  const mutationBusy = ref(false);
  const rateLimit = reactive({ limit: null, remaining: null, resetAt: null, retryAfter: null });
  const createProvider = providerFactory || ((options) => new GitHubStorageProvider(options));
  let unsubscribeQueue = null;
  let invalidateSession = () => {};

  function setInvalidator(invalidator) {
    invalidateSession = invalidator || (() => {});
  }

  function attachQueue(provider) {
    unsubscribeQueue?.();
    unsubscribeQueue = provider?.queue.subscribe((state) => {
      mutationBusy.value = state.isBusy;
    }) || null;
    if (!provider) mutationBusy.value = false;
  }

  async function connect({ config, token, commit }) {
    if (activeProvider.value?.queue.isBusy) {
      throw new AppError('SESSION_BUSY', 'Repository mutation is in progress.');
    }
    const candidate = createProvider({
      config,
      token,
      onRateLimit: (state) => Object.assign(rateLimit, state),
    });
    try {
      await candidate.initialize();
    } catch (error) {
      candidate.dispose();
      throw error;
    }

    const previous = activeProvider.value;
    const previousBrowserState = browser.captureState();
    try {
      browser.attachInitialized(candidate);
      commit?.();
    } catch (error) {
      candidate.dispose();
      if (previous) browser.restore(previous, previousBrowserState);
      else browser.detach();
      throw error;
    }

    invalidateSession();
    activeProvider.value = candidate;
    attachQueue(candidate);
    previous?.dispose();
    return candidate;
  }

  function disconnect() {
    if (mutationBusy.value) return false;
    invalidateSession();
    const previous = activeProvider.value;
    activeProvider.value = null;
    attachQueue(null);
    browser.detach();
    previous?.dispose();
    return true;
  }

  return {
    activeProvider,
    mutationBusy,
    rateLimit,
    setInvalidator,
    connect,
    disconnect,
  };
}
