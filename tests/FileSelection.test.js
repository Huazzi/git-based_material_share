import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import FileList from '@/components/repository/FileList.vue';

const entry = { id: 'file:a.txt', path: 'a.txt', name: 'a.txt', kind: 'file', size: 1 };

describe('FileList selection', () => {
  it('emits selection without opening the row', async () => {
    const wrapper = mount(FileList, {
      props: { entries: [entry], selectedPaths: new Set() },
      global: { stubs: { AppIcon: true, FileItemActions: true } },
    });
    await wrapper.find('input[type="checkbox"]').trigger('change');
    expect(wrapper.emitted('toggle-selection')).toEqual([[entry]]);
    expect(wrapper.emitted('open')).toBeUndefined();
  });
});
