import { describe, expect, it } from 'vitest';
import { useFilePreview } from '@/composables/useFilePreview.js';

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
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
});
