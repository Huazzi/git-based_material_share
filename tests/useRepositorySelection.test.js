import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { useRepositorySelection } from '@/composables/useRepositorySelection.js';

describe('useRepositorySelection', () => {
  it('preserves selection until the browser view revision changes', async () => {
    const browser = { entries: ref([{ path: 'a', id: 'a' }, { path: 'b', id: 'b' }]), viewRevision: ref(0) };
    const selection = useRepositorySelection(browser);
    selection.toggle(browser.entries.value[0]);
    expect(selection.count.value).toBe(1);
    browser.viewRevision.value += 1;
    await Promise.resolve();
    expect(selection.count.value).toBe(0);
  });
});
