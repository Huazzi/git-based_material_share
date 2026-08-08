import { FILE_LIMITS } from '@/constants/fileLimits.js';
import { AppError } from '@/errors/AppError.js';
import { createAvailableFileName } from '@/utils/file.js';
import { getFileName, joinPath, normalizePath } from '@/utils/path.js';

function fail(code, message) {
  throw new AppError(code, message);
}

function validateFiles(files) {
  if (!files?.length) fail('BATCH_EMPTY', 'No files selected.');
  if (files.length > FILE_LIMITS.batchUploadCount) fail('BATCH_UPLOAD_COUNT_EXCEEDED', 'Too many files selected.');
  let totalBytes = 0;
  files.forEach((file) => {
    if (!Number.isFinite(file?.size) || file.size < 0) fail('BATCH_FILE_SIZE_UNKNOWN', 'File size is unknown.');
    if (file.size > FILE_LIMITS.upload) fail('UPLOAD_TOO_LARGE', 'A file exceeds the upload limit.');
    totalBytes += file.size;
  });
  if (totalBytes > FILE_LIMITS.batchUploadTotal) fail('BATCH_UPLOAD_TOTAL_EXCEEDED', 'Batch upload exceeds the aggregate limit.');
  return totalBytes;
}

export function createBatchUploadDraft(files, { directory = '', snapshot } = {}) {
  const source = Array.from(files || []);
  const totalBytes = validateFiles(source);
  const normalizedDirectory = normalizePath(directory);
  const reserved = new Set();
  const items = source.map((file, index) => {
    const originalName = getFileName(file.name);
    if (!originalName) fail('VALIDATION_FAILED', 'File name is required.');
    const targetPath = joinPath(normalizedDirectory, originalName);
    const remote = snapshot?.stat(targetPath) || null;
    const duplicate = reserved.has(targetPath);
    reserved.add(targetPath);
    return {
      id: `${index}:${originalName}:${file.size}`,
      index,
      file,
      originalName,
      targetName: originalName,
      action: remote || duplicate ? '' : 'create',
      conflictType: duplicate ? 'batch-duplicate' : remote ? `remote-${remote.kind}` : null,
      existingSha: remote?.kind === 'file' ? remote.sha : null,
    };
  });
  return { directory: normalizedDirectory, files: items, totalBytes, snapshotCommitSha: snapshot?.commitSha || null };
}

export function planBatchUpload({ draft, snapshot, message = '', expectedFingerprint = null } = {}) {
  if (!draft?.files?.length) fail('BATCH_EMPTY', 'No files selected.');
  validateFiles(draft.files.map((item) => item.file));
  const directory = normalizePath(draft.directory);
  if (directory) {
    const parts = directory.split('/');
    for (let index = 0; index < parts.length; index += 1) {
      const ancestor = parts.slice(0, index + 1).join('/');
      if (snapshot.stat(ancestor)?.kind !== 'directory') {
        fail('BATCH_UPLOAD_STALE', 'Upload destination is no longer a directory.');
      }
    }
  }
  const occupied = new Set();
  const sourceReservations = new Set();
  const planned = [];

  for (const item of draft.files) {
    const requestedName = getFileName(item.targetName || item.originalName);
    if (!requestedName) fail('VALIDATION_FAILED', 'Target file name is required.');
    let action = item.action || '';
    let targetName = requestedName;
    let targetPath = joinPath(directory, targetName);
    let existing = snapshot.stat(targetPath);
    const internalConflict = sourceReservations.has(targetPath) || occupied.has(targetPath);
    sourceReservations.add(targetPath);

    if ((existing || internalConflict) && !action) fail('BATCH_CONFLICT_UNRESOLVED', 'Every conflict requires a decision.');
    if (!existing && !internalConflict && !action) action = 'create';
    if (action === 'skip') {
      planned.push({ ...item, action, targetName, targetPath, disposition: 'skip', expectedSha: existing?.sha || null });
      continue;
    }
    if (action === 'overwrite') {
      if (internalConflict) fail('BATCH_DUPLICATE_TARGET', 'A later duplicate cannot overwrite an earlier local file.');
      if (!existing || existing.kind !== 'file') fail('BATCH_UPLOAD_STALE', 'Overwrite target is no longer the expected file.');
    } else if (action === 'rename') {
      targetName = createAvailableFileName(targetName, (candidate) => {
        const candidatePath = joinPath(directory, candidate);
        return sourceReservations.has(candidatePath) || occupied.has(candidatePath) || Boolean(snapshot.stat(candidatePath));
      });
      targetPath = joinPath(directory, targetName);
      existing = null;
    } else if (action === 'create') {
      if (existing || internalConflict) fail('BATCH_UPLOAD_STALE', 'Create target is no longer available.');
    } else {
      fail('BATCH_CONFLICT_UNRESOLVED', 'Unsupported or missing conflict decision.');
    }

    occupied.add(targetPath);
    planned.push({
      ...item,
      action,
      targetName,
      targetPath,
      disposition: action === 'overwrite' ? 'overwrite' : 'create',
      expectedSha: existing?.sha || null,
      mode: existing?.mode || '100644',
    });
  }

  const active = planned.filter((item) => item.disposition !== 'skip');
  if (!active.length) fail('BATCH_EMPTY', 'Every selected file was skipped.');
  const fingerprint = JSON.stringify(active.map((item) => [item.index, item.targetPath, item.disposition, item.expectedSha]));
  if (expectedFingerprint && fingerprint !== expectedFingerprint) {
    fail('BATCH_UPLOAD_STALE', 'Remote state changed after conflict review.');
  }
  return {
    directory,
    files: planned,
    activeFiles: active,
    totalBytes: draft.totalBytes,
    message: message.trim() || `批量上传 ${active.length} 个文件`,
    snapshotCommitSha: snapshot.commitSha,
    fingerprint,
  };
}
