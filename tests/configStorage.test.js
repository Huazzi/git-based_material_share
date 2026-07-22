import { beforeEach, describe, expect, it } from 'vitest';
import {
  STORAGE_KEYS,
  loadToken,
  migrateLegacyStorage,
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
});
