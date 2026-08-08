import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import UploadDialog from '@/components/upload/UploadDialog.vue';
import { RepositorySnapshot } from '@/services/storage/RepositorySnapshot.js';

function snapshot({ commitSha = 'commit-1', fileSha = 'a', extra = [] } = {}) {
  return new RepositorySnapshot({
    commitSha, treeSha: `tree-${commitSha}`, tree: [
      { path: 'docs', type: 'tree', mode: '040000', sha: 'docs' },
      { path: 'docs/a.txt', type: 'blob', mode: '100644', sha: fileSha, size: 3 },
      ...extra,
    ],
  });
}

async function chooseFiles(wrapper, files) {
  const input = wrapper.find('input[type="file"]');
  Object.defineProperty(input.element, 'files', { configurable: true, value: files });
  await input.trigger('change');
}

describe('UploadDialog', () => {
  it('accepts multiple files and requires an explicit conflict action', async () => {
    const wrapper = mount(UploadDialog, {
      props: { open: true, snapshot: snapshot(), directory: 'docs' },
      global: { stubs: { AppIcon: true } },
    });
    await chooseFiles(wrapper, [new File(['one'], 'a.txt'), new File(['two'], 'b.txt')]);

    expect(wrapper.text()).toContain('2 个文件');
    await wrapper.find('form').trigger('submit');
    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.text()).toContain('请为每个同名冲突选择重命名、覆盖或跳过。');

    await wrapper.find('select').setValue('overwrite');
    await wrapper.find('form').trigger('submit');
    const command = wrapper.emitted('submit')[0][0];
    expect(command.draft.files).toHaveLength(2);
    expect(command.draft.files[0].action).toBe('overwrite');
    expect(command.fingerprint).toContain('docs/a.txt');
  });

  it('keeps the first source path reserved after skip so later duplicates cannot overwrite', async () => {
    const wrapper = mount(UploadDialog, {
      props: { open: true, snapshot: snapshot(), directory: 'docs' },
      global: { stubs: { AppIcon: true } },
    });
    await chooseFiles(wrapper, [new File(['one'], 'a.txt'), new File(['two'], 'a.txt')]);
    const selects = wrapper.findAll('select');
    await selects[0].setValue('skip');
    expect(selects[1].findAll('option').map((option) => option.text())).toEqual([
      '请选择处理方式', '自动重命名', '跳过',
    ]);
  });

  it('preserves files and names but clears overwrite approval when the snapshot changes', async () => {
    const wrapper = mount(UploadDialog, {
      props: { open: true, snapshot: snapshot(), directory: 'docs' },
      global: { stubs: { AppIcon: true } },
    });
    await chooseFiles(wrapper, [new File(['one'], 'a.txt')]);
    await wrapper.find('select').setValue('overwrite');

    await wrapper.setProps({ snapshot: snapshot({ commitSha: 'commit-2', fileSha: 'new-a' }) });
    expect(wrapper.find('.upload-item .form-field input').element.value).toBe('a.txt');
    expect(wrapper.find('select').element.value).toBe('');
    expect(wrapper.text()).toContain('1 个文件');
  });
});
