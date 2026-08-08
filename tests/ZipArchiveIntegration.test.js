import { describe, expect, it } from 'vitest';
import { ZipArchiveService } from '@/services/archive/ZipArchiveService.js';

describe('ZipArchiveService with real Zip.js', () => {
  it('creates a readable ZIP blob through the memory fallback', async () => {
    const snapshot = { commitSha: 'commit-1' };
    const plan = {
      snapshot,
      archiveName: 'docs.zip',
      directories: ['docs/', 'docs/empty/'],
      totalBytes: 5,
      totalFiles: 1,
      files: [{ entry: { path: 'docs/a.txt', size: 5 }, archivePath: 'docs/a.txt' }],
    };
    const provider = {
      readFile: async (_path, options) => {
        expect(options.snapshot).toBe(snapshot);
        return { blob: new Blob(['hello'], { type: 'text/plain' }) };
      },
    };
    const service = new ZipArchiveService({ saveFilePicker: null });

    const result = await service.create({ plan, provider });
    const signature = new Uint8Array(await result.blob.slice(0, 4).arrayBuffer());

    expect(result.streamed).toBe(false);
    expect(result.blob.type).toBe('application/zip');
    expect([...signature]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });
});
