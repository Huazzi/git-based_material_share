import { describe, expect, it } from 'vitest';
import { FILE_LIMITS, getFilePolicy } from '@/constants/fileLimits.js';

describe('file policy', () => {
  it('applies the approved 25 MiB and 100 MiB boundaries', () => {
    expect(getFilePolicy(FILE_LIMITS.preview)).toEqual({ preview: true, download: true, reason: null });
    expect(getFilePolicy(FILE_LIMITS.preview + 1)).toEqual({ preview: false, download: true, reason: 'DOWNLOAD_ONLY' });
    expect(getFilePolicy(FILE_LIMITS.download + 1)).toEqual({ preview: false, download: false, reason: 'UNSUPPORTED_SIZE' });
  });
});
