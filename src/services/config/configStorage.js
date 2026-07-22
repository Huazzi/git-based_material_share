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
  const remaining = parseJson(storage.getItem(STORAGE_KEYS.legacyConfig));
  return !remaining || !Object.hasOwn(remaining, 'token');
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
  if (localStorage.getItem(STORAGE_KEYS.migration) === 'complete') {
    return { migrated: false, repository: null, message: '' };
  }

  const legacy = parseJson(localStorage.getItem(STORAGE_KEYS.legacyConfig));
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
  localStorage.removeItem(STORAGE_KEYS.localToken);
  sessionStorage.removeItem(STORAGE_KEYS.sessionToken);
  if (!value) return;
  (remember ? localStorage : sessionStorage).setItem(
    remember ? STORAGE_KEYS.localToken : STORAGE_KEYS.sessionToken,
    value,
  );
}

export function clearStoredConfiguration(localStorage, sessionStorage) {
  localStorage.removeItem(STORAGE_KEYS.repository);
  localStorage.removeItem(STORAGE_KEYS.localToken);
  sessionStorage.removeItem(STORAGE_KEYS.sessionToken);
}
