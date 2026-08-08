import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FILE_LIMITS } from '@/constants/fileLimits.js';

const zipMocks = vi.hoisted(() => ({ adds: [], closes: 0, closeImpl: null, closeArgs: [] }));
vi.mock('@zip.js/zip.js', () => ({
  BlobReader: class BlobReader { constructor(blob) { this.blob = blob; } },
  BlobWriter: class BlobWriter {},
  ZipWriter: class ZipWriter {
    async add(path, reader, options) {
      zipMocks.adds.push({ path, reader, options });
      options?.onprogress?.(reader?.blob?.size || 0, reader?.blob?.size || 0);
    }
    async close(...args) {
      zipMocks.closes += 1;
      zipMocks.closeArgs.push(args);
      if (zipMocks.closeImpl) return zipMocks.closeImpl(...args);
      return new Blob(['zip'], { type: 'application/zip' });
    }
  },
}));

import { ZipArchiveService } from '@/services/archive/ZipArchiveService.js';

function plan(totalBytes = 6) {
  const snapshot = { commitSha: 'commit' };
  return {
    snapshot,
    archiveName: 'docs.zip',
    directories: ['docs/'],
    totalBytes,
    totalFiles: 4,
    files: Array.from({ length: 4 }, (_, index) => ({
      entry: { path: `docs/${index}.txt`, size: 1 }, archivePath: `docs/${index}.txt`,
    })),
  };
}

describe('ZipArchiveService', () => {
  beforeEach(() => {
    zipMocks.adds = [];
    zipMocks.closes = 0;
    zipMocks.closeImpl = null;
    zipMocks.closeArgs = [];
  });

  it('pins every read to one snapshot, limits network concurrency to 3 and archives in stable order', async () => {
    let active = 0;
    let maximum = 0;
    const seenSnapshots = [];
    const provider = {
      readFile: vi.fn(async (path, options) => {
        active += 1;
        maximum = Math.max(maximum, active);
        seenSnapshots.push(options.snapshot);
        await new Promise((resolve) => setTimeout(resolve, path.includes('/0.') ? 5 : 1));
        active -= 1;
        options.onProgress({ loaded: 1, total: 1 });
        return { blob: new Blob([path]) };
      }),
    };
    const currentPlan = plan();
    const service = new ZipArchiveService({ saveFilePicker: null });
    const result = await service.create({ plan: currentPlan, provider });

    expect(result.streamed).toBe(false);
    expect(maximum).toBe(3);
    expect(seenSnapshots.every((item) => item === currentPlan.snapshot)).toBe(true);
    expect(zipMocks.adds.map((item) => item.path)).toEqual([
      'docs/', 'docs/0.txt', 'docs/1.txt', 'docs/2.txt', 'docs/3.txt',
    ]);
    expect(zipMocks.closes).toBe(1);
  });

  it('requires a writable file stream above the Blob fallback ceiling', async () => {
    const service = new ZipArchiveService({ saveFilePicker: null });
    await expect(service.create({ plan: plan(FILE_LIMITS.batchDownloadBlobFallback + 1), provider: {} }))
      .rejects.toMatchObject({ code: 'BATCH_DOWNLOAD_STREAM_REQUIRED' });
  });

  it('aborts in-flight reads immediately on the first prefetched failure and starts no later file', async () => {
    const failure = new Error('read failed');
    const started = [];
    const provider = {
      readFile: vi.fn((path, options) => {
        started.push(path);
        if (path === 'docs/1.txt') return Promise.reject(failure);
        if (options.signal.aborted) return Promise.reject(options.signal.reason);
        return new Promise((_, reject) => {
          options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
        });
      }),
    };
    const service = new ZipArchiveService({ saveFilePicker: null });

    await expect(service.create({ plan: plan(), provider }))
      .rejects.toMatchObject({ code: 'ARCHIVE_FAILED' });
    expect(started).toEqual(['docs/0.txt', 'docs/1.txt', 'docs/2.txt']);
    expect(zipMocks.adds.map((item) => item.path)).toEqual(['docs/']);
    expect(zipMocks.closes).toBe(0);
  });

  it('does not create a writable file after cancellation while the native picker is pending', async () => {
    let resolvePicker;
    const picker = vi.fn(() => new Promise((resolve) => { resolvePicker = resolve; }));
    const createWritable = vi.fn();
    const controller = new AbortController();
    const service = new ZipArchiveService({ saveFilePicker: picker });
    const creating = service.create({ plan: plan(), provider: {}, signal: controller.signal });
    await vi.waitFor(() => expect(picker).toHaveBeenCalledTimes(1));

    controller.abort();
    resolvePicker({ createWritable });

    await expect(creating).rejects.toMatchObject({ code: 'ABORTED' });
    expect(createWritable).not.toHaveBeenCalled();
  });

  it('rejects Blob output when the session aborts during ZIP finalization', async () => {
    let resolveClose;
    zipMocks.closeImpl = () => new Promise((resolve) => { resolveClose = resolve; });
    const controller = new AbortController();
    const phases = [];
    const provider = { readFile: vi.fn().mockResolvedValue({ blob: new Blob(['x']) }) };
    const service = new ZipArchiveService({ saveFilePicker: null });
    const creating = service.create({
      plan: plan(), provider, signal: controller.signal,
      onProgress: ({ phase }) => phases.push(phase),
    });
    await vi.waitFor(() => expect(zipMocks.closes).toBe(1));
    expect(phases).toContain('finalizing');

    controller.abort();
    resolveClose(new Blob(['zip'], { type: 'application/zip' }));

    await expect(creating).rejects.toMatchObject({ code: 'ABORTED' });
    expect(phases).not.toContain('complete');
  });

  it('keeps streamed output uncommitted until finalization succeeds', async () => {
    let resolveClose;
    zipMocks.closeImpl = () => new Promise((resolve) => { resolveClose = resolve; });
    const writable = { close: vi.fn(), abort: vi.fn() };
    const picker = vi.fn().mockResolvedValue({ createWritable: vi.fn().mockResolvedValue(writable) });
    const controller = new AbortController();
    const provider = { readFile: vi.fn().mockResolvedValue({ blob: new Blob(['x']) }) };
    const service = new ZipArchiveService({ saveFilePicker: picker });
    const creating = service.create({ plan: plan(), provider, signal: controller.signal });
    await vi.waitFor(() => expect(zipMocks.closes).toBe(1));

    controller.abort();
    resolveClose(writable);

    await expect(creating).rejects.toMatchObject({ code: 'ABORTED' });
    expect(zipMocks.closeArgs[0][1]).toEqual({ preventClose: true });
    expect(writable.close).not.toHaveBeenCalled();
    expect(writable.abort).toHaveBeenCalledTimes(1);
  });
});
