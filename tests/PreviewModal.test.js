import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import PreviewModal from '@/components/preview/PreviewModal.vue';

describe('PreviewModal', () => {
  it('offers download-only handling above the preview limit', async () => {
    const entry = {
      kind: 'file',
      name: 'large.pdf',
      path: 'docs/large.pdf',
      size: 25 * 1024 * 1024 + 1,
    };
    const wrapper = mount(PreviewModal, {
      props: {
        state: {
          visible: true,
          loading: false,
          error: null,
          entry,
          descriptor: { kind: 'pdf', extension: 'pdf' },
          rawFile: null,
        },
      },
      global: { stubs: { AppIcon: true } },
    });

    expect(wrapper.text()).toContain('文件超过 25 MiB，可下载后在本地查看。');
    const downloadButtons = wrapper.findAll('button').filter((button) => button.text().includes('下载'));
    expect(downloadButtons).toHaveLength(2);
    await downloadButtons[0].trigger('click');
    expect(wrapper.emitted('download')?.[0]).toEqual([entry]);
  });
});
