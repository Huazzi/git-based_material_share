import { describe, expect, it } from 'vitest';
import { useFilePreview } from '@/composables/useFilePreview.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

describe('useFilePreview', () => {
  it('ignores a stale response after another file is opened', async () => {
    const first = deferred();
    const second = deferred();
    const provider = {
      readFile: (path) => path === 'a.md' ? first.promise : second.promise,
    };
    const preview = useFilePreview(() => provider);
    const openFirst = preview.open({ kind: 'file', name: 'a.md', path: 'a.md', size: 1 });
    const openSecond = preview.open({ kind: 'file', name: 'b.md', path: 'b.md', size: 1 });
    second.resolve({ path: 'b.md', blob: new Blob(['b']) });
    await openSecond;
    first.resolve({ path: 'a.md', blob: new Blob(['a']) });
    await openFirst;
    expect(preview.state.rawFile.path).toBe('b.md');
  });

  it('allows only one active download and aborts it when the session is disposed', async () => {
    const pending = deferred();
    const provider = {
      readFile: (_path, { signal }) => {
        signal.addEventListener('abort', () => pending.reject(Object.assign(new Error('aborted'), { code: 'ABORTED' })));
        return pending.promise;
      },
    };
    const preview = useFilePreview(() => provider);
    const entry = { kind: 'file', name: 'large.bin', path: 'large.bin', size: 1 };
    const first = preview.download(entry);
    expect(preview.state.downloadBusy).toBe(true);
    await expect(preview.download(entry)).rejects.toMatchObject({ code: 'DOWNLOAD_IN_PROGRESS' });
    preview.dispose();
    await expect(first).rejects.toMatchObject({ code: 'ABORTED' });
    expect(preview.state.downloadBusy).toBe(false);
  });
});
