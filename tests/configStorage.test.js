import { beforeEach, describe, expect, it } from 'vitest';
import {
  STORAGE_KEYS,
  loadToken,
  migrateLegacyStorage,
  persistRepositoryConfiguration,
  saveToken,
} from '@/services/config/configStorage.js';

describe('configuration storage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('migrates non-sensitive repository data and destroys the legacy token', () => {
    localStorage.setItem(STORAGE_KEYS.legacyConfig, JSON.stringify({
      platform: 'github', owner: 'octo', repo: 'notes', branch: 'dev', token: 'secret',
    }));
    const result = migrateLegacyStorage(localStorage);
    expect(result.repository).toMatchObject({ owner: 'octo', repo: 'notes', branch: 'dev' });
    expect(localStorage.getItem(STORAGE_KEYS.legacyConfig)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.repository)).not.toContain('secret');
  });

  it('keeps session and remembered token storage mutually exclusive', () => {
    saveToken(localStorage, sessionStorage, 'session-token', false);
    expect(loadToken(localStorage, sessionStorage)).toEqual({ token: 'session-token', remember: false });
    saveToken(localStorage, sessionStorage, 'remembered-token', true);
    expect(sessionStorage.getItem(STORAGE_KEYS.sessionToken)).toBeNull();
    expect(loadToken(localStorage, sessionStorage)).toEqual({ token: 'remembered-token', remember: true });
  });

  it('blocks initialization when a legacy token cannot be removed or overwritten', () => {
    const blockedStorage = {
      getItem: (key) => key === STORAGE_KEYS.legacyConfig
        ? JSON.stringify({ platform: 'github', owner: 'o', repo: 'r', token: 'secret' })
        : null,
      removeItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    expect(() => migrateLegacyStorage(blockedStorage)).toThrowError(
      expect.objectContaining({ code: 'CONFIG_STORAGE_BLOCKED' }),
    );
  });

  it('scrubs a legacy token even after migration was previously completed', () => {
    localStorage.setItem(STORAGE_KEYS.migration, 'complete');
    localStorage.setItem(STORAGE_KEYS.legacyConfig, JSON.stringify({ token: 'returned-secret' }));
    migrateLegacyStorage(localStorage);
    expect(localStorage.getItem(STORAGE_KEYS.legacyConfig)).toBeNull();
  });

  it('rolls back repository and token values when transactional persistence fails', () => {
    localStorage.setItem(STORAGE_KEYS.repository, JSON.stringify({
      schemaVersion: 2, owner: 'old', repo: 'repo', branch: 'main',
    }));
    localStorage.setItem(STORAGE_KEYS.localToken, 'old-token');
    let failOnce = true;
    const flakySessionStorage = {
      values: new Map([[STORAGE_KEYS.sessionToken, 'old-session']]),
      getItem(key) { return this.values.get(key) ?? null; },
      setItem(key, value) {
        if (failOnce) { failOnce = false; throw new Error('quota'); }
        this.values.set(key, value);
      },
      removeItem(key) { this.values.delete(key); },
    };

    expect(() => persistRepositoryConfiguration(
      localStorage,
      flakySessionStorage,
      { owner: 'new', repo: 'repo', branch: 'dev' },
      'new-session',
      false,
    )).toThrowError(expect.objectContaining({ code: 'CONFIG_STORAGE_UNAVAILABLE' }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.repository)).owner).toBe('old');
    expect(localStorage.getItem(STORAGE_KEYS.localToken)).toBe('old-token');
    expect(flakySessionStorage.getItem(STORAGE_KEYS.sessionToken)).toBe('old-session');
  });
});
