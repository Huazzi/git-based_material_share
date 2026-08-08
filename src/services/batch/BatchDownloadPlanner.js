import { FILE_LIMITS } from '@/constants/fileLimits.js';
import { SYSTEM_FILES } from '@/constants/systemFiles.js';
import { AppError } from '@/errors/AppError.js';
import { commonParentPath, createArchiveName, toArchivePath } from '@/utils/archivePath.js';
import { normalizePath } from '@/utils/path.js';

function fail(code, message) { throw new AppError(code, message); }

export function planBatchDownload({ snapshot, selectedEntries } = {}) {
  if (!snapshot || !selectedEntries?.length) fail('BATCH_EMPTY', 'No repository entries selected.');
  const selected = selectedEntries.map((entry) => snapshot.stat(entry.path)).filter(Boolean);
  if (!selected.length) fail('BATCH_EMPTY', 'Selected entries no longer exist.');
  const rootPath = commonParentPath(selected);
  const filesByPath = new Map();
  const directories = new Set();
  const excluded = [];

  function include(entry, selectedRoot = false) {
    if (entry.kind === 'directory') {
      directories.add(toArchivePath(entry.path, rootPath, { directory: true }));
      const prefix = `${normalizePath(entry.path)}/`;
      for (const descendant of snapshot.allEntries()) {
        if (!descendant.path.startsWith(prefix)) continue;
        if (descendant.kind === 'directory') {
          directories.add(toArchivePath(descendant.path, rootPath, { directory: true }));
        } else if (descendant.kind === 'file' && !SYSTEM_FILES.has(descendant.name)) {
          filesByPath.set(descendant.path, {
            entry: descendant,
            archivePath: toArchivePath(descendant.path, rootPath),
          });
        } else {
          excluded.push({ entry: descendant, reason: SYSTEM_FILES.has(descendant.name) ? 'system' : 'special' });
        }
      }
      return;
    }
    if (entry.kind === 'file' && !SYSTEM_FILES.has(entry.name)) {
      filesByPath.set(entry.path, { entry, archivePath: toArchivePath(entry.path, rootPath) });
    } else {
      excluded.push({ entry, reason: SYSTEM_FILES.has(entry.name) ? 'system' : 'special' });
    }
  }

  selected.forEach((entry) => include(entry, true));
  const files = [...filesByPath.values()].sort((a, b) => a.archivePath.localeCompare(b.archivePath));
  if (files.length > FILE_LIMITS.batchDownloadCount) fail('BATCH_DOWNLOAD_COUNT_EXCEEDED', 'Expanded selection contains too many files.');
  let totalBytes = 0;
  files.forEach(({ entry }) => {
    if (!Number.isFinite(entry.size) || entry.size < 0) fail('BATCH_FILE_SIZE_UNKNOWN', 'A selected file has unknown size.');
    if (entry.size > FILE_LIMITS.download) fail('DOWNLOAD_TOO_LARGE', 'A selected file exceeds the download limit.');
    totalBytes += entry.size;
  });
  if (totalBytes > FILE_LIMITS.batchDownloadTotal) fail('BATCH_DOWNLOAD_TOTAL_EXCEEDED', 'Batch download exceeds the aggregate limit.');
  if (!files.length && !directories.size) fail('BATCH_EMPTY', 'Selection contains no downloadable entries.');

  return {
    snapshot,
    commitSha: snapshot.commitSha,
    rootPath,
    files,
    directories: [...directories].sort(),
    excluded,
    totalFiles: files.length,
    totalBytes,
    archiveName: createArchiveName(rootPath || (selected.length === 1 ? selected[0].path : '')),
  };
}
