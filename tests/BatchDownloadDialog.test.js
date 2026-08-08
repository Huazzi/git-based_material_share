import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import BatchDownloadDialog from '@/components/download/BatchDownloadDialog.vue';

function state(phase) {
  return {
    visible: true,
    phase,
    plan: {
      archiveName: 'docs.zip', totalFiles: 1, totalBytes: 1,
      directories: [], excluded: [],
    },
    completedFiles: 1,
    totalFiles: 1,
    loadedBytes: 1,
    totalBytes: 1,
    activePath: '',
    error: null,
  };
}

describe('BatchDownloadDialog', () => {
  it('disables cancellation and closing while the ZIP is finalizing', async () => {
    const wrapper = mount(BatchDownloadDialog, { props: { state: state('finalizing') } });
    const button = wrapper.find('.dialog-actions button');
    expect(wrapper.text()).toContain('正在完成 ZIP 文件…');
    expect(button.text()).toBe('正在完成…');
    expect(button.attributes('disabled')).toBeDefined();
    await wrapper.find('.modal-backdrop').trigger('click');
    expect(wrapper.emitted('cancel')).toBeUndefined();
    expect(wrapper.emitted('close')).toBeUndefined();
  });
});
