import { describe, expect, it, vi } from 'vitest';
import { useFilePreview } from '@/composables/useFilePreview.js';
import { useRepositoryBrowser } from '@/composables/useRepositoryBrowser.js';
import { useRepositorySession } from '@/composables/useRepositorySession.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function fakeProvider(name, readFile = vi.fn()) {
  const entry = { id: `file:${name}.md`, kind: 'file', name: `${name}.md`, path: `${name}.md`, size: 1 };
  return {
    name,
    snapshot: { commitSha: `${name}-commit` },
    queue: { isBusy: false, subscribe: (listener) => { listener({ isBusy: false }); return vi.fn(); } },
    initialize: vi.fn().mockResolvedValue(undefined),
    list: vi.fn(() => [entry]),
    search: vi.fn(() => [entry]),
    readFile,
    dispose: vi.fn(),
  };
}

describe('useRepositorySession', () => {
  it('invalidates a delayed preview before replacing the repository provider', async () => {
    const pending = deferred();
    const providerA = fakeProvider('a', vi.fn((_path, { signal }) => {
      signal.addEventListener('abort', () => pending.reject({ code: 'ABORTED' }));
      return pending.promise;
    }));
    const providerB = fakeProvider('b');
    const providers = [providerA, providerB];
    const browser = useRepositoryBrowser();
    const session = useRepositorySession({ browser, providerFactory: () => providers.shift() });
    const preview = useFilePreview(() => session.activeProvider.value);
    session.setInvalidator(preview.dispose);

    await session.connect({ config: {}, token: '' });
    const opening = preview.open(providerA.list()[0]);
    await session.connect({ config: {}, token: '' });
    await opening;

    expect(preview.state.visible).toBe(false);
    expect(preview.state.rawFile).toBeNull();
    expect(providerA.dispose).toHaveBeenCalled();
    expect(session.activeProvider.value).toBe(providerB);
  });

  it('restores the previous runtime session when configuration commit fails', async () => {
    const providerA = fakeProvider('a');
    const providerB = fakeProvider('b');
    const providers = [providerA, providerB];
    const browser = useRepositoryBrowser();
    const session = useRepositorySession({ browser, providerFactory: () => providers.shift() });
    const invalidator = vi.fn();
    session.setInvalidator(invalidator);
    await session.connect({ config: {}, token: '' });
    invalidator.mockClear();

    await expect(session.connect({
      config: {}, token: '', commit: () => { throw new Error('storage failed'); },
    })).rejects.toThrow('storage failed');

    expect(session.activeProvider.value).toBe(providerA);
    expect(browser.provider.value).toBe(providerA);
    expect(providerA.dispose).not.toHaveBeenCalled();
    expect(providerB.dispose).toHaveBeenCalled();
    expect(invalidator).not.toHaveBeenCalled();
  });
});
