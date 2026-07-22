import { reactive, ref } from 'vue';
import {
  clearStoredConfiguration,
  loadPreferences,
  loadRepositoryConfig,
  loadToken,
  migrateLegacyStorage,
  savePreferences,
  saveRepositoryConfig,
  saveToken,
} from '@/services/config/configStorage.js';

export function useRepositoryConfig() {
  const repository = ref(null);
  const token = ref('');
  const rememberToken = ref(false);
  const preferences = reactive({ view: 'list' });
  const migrationMessage = ref('');
  const storageError = ref(null);

  function initialize() {
    try {
      const migration = migrateLegacyStorage(localStorage);
      migrationMessage.value = migration.message;
      repository.value = loadRepositoryConfig(localStorage);
      Object.assign(preferences, loadPreferences(localStorage));
      const auth = loadToken(localStorage, sessionStorage);
      token.value = auth.token;
      rememberToken.value = auth.remember;
    } catch (error) {
      storageError.value = error;
      repository.value = null;
      token.value = '';
    }
  }

  function persist({ config, nextToken, remember }) {
    repository.value = saveRepositoryConfig(localStorage, config);
    saveToken(localStorage, sessionStorage, nextToken, remember);
    token.value = nextToken.trim();
    rememberToken.value = remember;
  }

  function setView(view) {
    Object.assign(preferences, savePreferences(localStorage, { view }));
  }

  function reset() {
    clearStoredConfiguration(localStorage, sessionStorage);
    repository.value = null;
    token.value = '';
    rememberToken.value = false;
  }

  return {
    repository,
    token,
    rememberToken,
    preferences,
    migrationMessage,
    storageError,
    initialize,
    persist,
    setView,
    reset,
  };
}
