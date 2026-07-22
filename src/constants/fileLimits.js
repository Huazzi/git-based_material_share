export const MIB = 1024 * 1024;

export const FILE_LIMITS = Object.freeze({
  upload: 25 * MIB,
  preview: 25 * MIB,
  download: 100 * MIB,
});

export function getFilePolicy(size) {
  if (!Number.isFinite(size) || size < 0) {
    return { preview: false, download: false, reason: 'UNKNOWN_SIZE' };
  }

  if (size <= FILE_LIMITS.preview) {
    return { preview: true, download: true, reason: null };
  }

  if (size <= FILE_LIMITS.download) {
    return { preview: false, download: true, reason: 'DOWNLOAD_ONLY' };
  }

  return { preview: false, download: false, reason: 'UNSUPPORTED_SIZE' };
}
