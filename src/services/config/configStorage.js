import { AppError } from '@/errors/AppError.js';

export const STORAGE_KEYS = Object.freeze({
  repository: 'materialShare.repository.v2',
  preferences: 'materialShare.preferences.v2',
  sessionToken: 'materialShare.token.session.v2',
  localToken: 'materialShare.token.local.v2',
  migration: 'materialShare.migration.v2',
  legacyConfig: 'learningSiteConfig',
  legacyView: 'preferredView',
});

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeRepositoryConfig(value) {
  const owner = cleanString(value?.owner);
  const repo = cleanString(value?.repo);
  const branch = cleanString(value?.branch) || 'main';
  if (!owner || !repo) return null;
  return { schemaVersion: 2, owner, repo, branch };
}

function legacyKeyIsSafe(storage) {
  const value = storage.getItem(STORAGE_KEYS.legacyConfig);
  if (value === null) return true;
  const remaining = parseJson(value);
  return Boolean(remaining && typeof remaining === 'object' && !Object.hasOwn(remaining, 'token'));
}

function clearLegacyConfig(storage, safeRepository) {
  try {
    storage.removeItem(STORAGE_KEYS.legacyConfig);
    if (legacyKeyIsSafe(storage)) return true;
  } catch {
    // Fall through to overwriting the old record without a token.
  }

  try {
    storage.setItem(STORAGE_KEYS.legacyConfig, JSON.stringify(safeRepository || {}));
    return legacyKeyIsSafe(storage);
  } catch {
    return false;
  }
}

export function migrateLegacyStorage(localStorage) {
  const migrationComplete = localStorage.getItem(STORAGE_KEYS.migration) === 'complete';
  const legacyValue = localStorage.getItem(STORAGE_KEYS.legacyConfig);
  const legacy = parseJson(legacyValue);
  if (migrationComplete) {
    if (legacyValue !== null && !clearLegacyConfig(localStorage, null)) {
      throw new AppError('CONFIG_STORAGE_BLOCKED', 'Legacy token could not be removed.');
    }
    return { migrated: false, repository: null, message: '' };
  }

  const legacyView = localStorage.getItem(STORAGE_KEYS.legacyView);
  const repository = legacy?.platform === 'github' || !legacy?.platform
    ? normalizeRepositoryConfig(legacy)
    : null;

  let writeError = null;
  try {
    if (repository) {
      localStorage.setItem(STORAGE_KEYS.repository, JSON.stringify(repository));
    }
    if (legacyView === 'list' || legacyView === 'grid') {
      localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify({ view: legacyView }));
    }
  } catch (error) {
    writeError = error;
  }

  if (!clearLegacyConfig(localStorage, repository)) {
    throw new AppError('CONFIG_STORAGE_BLOCKED', 'Legacy token could not be removed.');
  }

  try {
    localStorage.setItem(STORAGE_KEYS.migration, 'complete');
  } catch (error) {
    writeError ||= error;
  }
  if (writeError) {
    throw new AppError('CONFIG_STORAGE_UNAVAILABLE', 'Browser storage is unavailable.');
  }
  return {
    migrated: Boolean(legacy),
    repository,
    message: legacy?.platform === 'gitee' ? 'V2 仅支持 GitHub，请重新配置仓库。' : '',
  };
}

export function loadRepositoryConfig(localStorage) {
  return normalizeRepositoryConfig(parseJson(localStorage.getItem(STORAGE_KEYS.repository)));
}

export function saveRepositoryConfig(localStorage, config) {
  const normalized = normalizeRepositoryConfig(config);
  if (!normalized) throw new AppError('CONFIG_INVALID', 'Repository configuration is incomplete.');
  localStorage.setItem(STORAGE_KEYS.repository, JSON.stringify(normalized));
  return normalized;
}

export function loadPreferences(localStorage) {
  const value = parseJson(localStorage.getItem(STORAGE_KEYS.preferences));
  return { view: value?.view === 'grid' ? 'grid' : 'list' };
}

export function savePreferences(localStorage, preferences) {
  const value = { view: preferences?.view === 'grid' ? 'grid' : 'list' };
  localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify(value));
  return value;
}

export function loadToken(localStorage, sessionStorage) {
  const sessionToken = sessionStorage.getItem(STORAGE_KEYS.sessionToken);
  if (sessionToken) return { token: sessionToken, remember: false };
  const localToken = localStorage.getItem(STORAGE_KEYS.localToken) || '';
  return { token: localToken, remember: Boolean(localToken) };
}

export function saveToken(localStorage, sessionStorage, token, remember) {
  const value = cleanString(token);
  const snapshots = [
    [localStorage, STORAGE_KEYS.localToken, localStorage.getItem(STORAGE_KEYS.localToken)],
    [sessionStorage, STORAGE_KEYS.sessionToken, sessionStorage.getItem(STORAGE_KEYS.sessionToken)],
  ];
  try {
    if (value && remember) localStorage.setItem(STORAGE_KEYS.localToken, value);
    if (value && !remember) sessionStorage.setItem(STORAGE_KEYS.sessionToken, value);
    if (!value || !remember) localStorage.removeItem(STORAGE_KEYS.localToken);
    if (!value || remember) sessionStorage.removeItem(STORAGE_KEYS.sessionToken);
  } catch (error) {
    if (!restoreStorageSnapshots(snapshots)) {
      throw new AppError('CONFIG_STORAGE_BLOCKED', 'Token storage rollback failed.', { cause: error });
    }
    throw new AppError('CONFIG_STORAGE_UNAVAILABLE', 'Token storage is unavailable.', { cause: error });
  }
}

function restoreStorageSnapshots(snapshots) {
  try {
    snapshots.forEach(([storage, key, value]) => {
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
    });
    return true;
  } catch {
    return false;
  }
}

export function persistRepositoryConfiguration(localStorage, sessionStorage, config, token, remember) {
  const normalized = normalizeRepositoryConfig(config);
  if (!normalized) throw new AppError('CONFIG_INVALID', 'Repository configuration is incomplete.');
  const snapshots = [
    [localStorage, STORAGE_KEYS.repository, localStorage.getItem(STORAGE_KEYS.repository)],
    [localStorage, STORAGE_KEYS.localToken, localStorage.getItem(STORAGE_KEYS.localToken)],
    [sessionStorage, STORAGE_KEYS.sessionToken, sessionStorage.getItem(STORAGE_KEYS.sessionToken)],
  ];
  try {
    localStorage.setItem(STORAGE_KEYS.repository, JSON.stringify(normalized));
    const value = cleanString(token);
    if (value && remember) localStorage.setItem(STORAGE_KEYS.localToken, value);
    if (value && !remember) sessionStorage.setItem(STORAGE_KEYS.sessionToken, value);
    if (!value || !remember) localStorage.removeItem(STORAGE_KEYS.localToken);
    if (!value || remember) sessionStorage.removeItem(STORAGE_KEYS.sessionToken);
    return { repository: normalized, token: value, remember: Boolean(value && remember) };
  } catch (error) {
    if (!restoreStorageSnapshots(snapshots)) {
      throw new AppError('CONFIG_STORAGE_BLOCKED', 'Configuration rollback failed.', { cause: error });
    }
    throw new AppError('CONFIG_STORAGE_UNAVAILABLE', 'Configuration storage is unavailable.', { cause: error });
  }
}

export function clearStoredConfiguration(localStorage, sessionStorage) {
  const snapshots = [
    [localStorage, STORAGE_KEYS.repository, localStorage.getItem(STORAGE_KEYS.repository)],
    [localStorage, STORAGE_KEYS.localToken, localStorage.getItem(STORAGE_KEYS.localToken)],
    [sessionStorage, STORAGE_KEYS.sessionToken, sessionStorage.getItem(STORAGE_KEYS.sessionToken)],
  ];
  try {
    localStorage.removeItem(STORAGE_KEYS.repository);
    localStorage.removeItem(STORAGE_KEYS.localToken);
    sessionStorage.removeItem(STORAGE_KEYS.sessionToken);
  } catch (error) {
    if (!restoreStorageSnapshots(snapshots)) {
      throw new AppError('CONFIG_STORAGE_BLOCKED', 'Configuration reset rollback failed.', { cause: error });
    }
    throw new AppError('CONFIG_STORAGE_UNAVAILABLE', 'Configuration reset failed.', { cause: error });
  }
}
