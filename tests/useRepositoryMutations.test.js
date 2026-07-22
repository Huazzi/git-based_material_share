import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/errors/AppError.js';
import { useRepositoryMutations } from '@/composables/useRepositoryMutations.js';

describe('useRepositoryMutations', () => {
  it('refreshes for audit and never replays an uncertain upload', async () => {
    const unknown = new AppError('MUTATION_RESULT_UNKNOWN', 'unknown', { uncertain: true });
    const provider = { upload: vi.fn().mockRejectedValue(unknown) };
    const browser = { refresh: vi.fn().mockResolvedValue(undefined), sync: vi.fn() };
    const mutations = useRepositoryMutations({ getProvider: () => provider, browser });

    const result = await mutations.upload({ file: new File(['x'], 'x.txt') }, 'docs');

    expect(result).toMatchObject({ ok: false, requiresAudit: true, refreshFailed: false });
    expect(provider.upload).toHaveBeenCalledTimes(1);
    expect(browser.refresh).toHaveBeenCalledTimes(1);
    expect(browser.sync).not.toHaveBeenCalled();
  });

  it('audits applied-but-refresh-failed mutations and reports a failed audit', async () => {
    const applied = new AppError('MUTATION_APPLIED_REFRESH_FAILED', 'applied', { applied: true });
    const provider = { deleteFile: vi.fn().mockRejectedValue(applied) };
    const browser = { refresh: vi.fn().mockRejectedValue(new Error('still offline')), sync: vi.fn() };
    const mutations = useRepositoryMutations({ getProvider: () => provider, browser });
    const entry = { kind: 'file', path: 'x.txt', name: 'x.txt' };

    const result = await mutations.remove(entry, 'delete x');
    expect(result).toMatchObject({ ok: false, requiresAudit: true, refreshFailed: true });
    expect(provider.deleteFile).toHaveBeenCalledTimes(1);
  });
});
