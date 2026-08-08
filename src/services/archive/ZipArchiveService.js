import { FILE_LIMITS } from '@/constants/fileLimits.js';
import { AppError, isAppError } from '@/errors/AppError.js';
import { createOrderedPrefetch } from '@/utils/boundedTaskPool.js';

function aborted() { return new AppError('ABORTED', 'Batch download aborted.'); }

export class ZipArchiveService {
  constructor({ saveFilePicker = globalThis.showSaveFilePicker?.bind(globalThis) } = {}) {
    this.saveFilePicker = saveFilePicker;
  }

  async create({ plan, provider, signal, onProgress } = {}) {
    if (signal?.aborted) throw aborted();
    const canStream = typeof this.saveFilePicker === 'function';
    if (!canStream && plan.totalBytes > FILE_LIMITS.batchDownloadBlobFallback) {
      throw new AppError('BATCH_DOWNLOAD_STREAM_REQUIRED', 'Writable file stream is required for this archive size.');
    }

    const controller = new AbortController();
    const forwardAbort = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', forwardAbort, { once: true });
    let writable = null;
    let writer = null;
    let prefetch = null;
    try {
      const { BlobReader, BlobWriter, ZipWriter } = await import('@zip.js/zip.js');
      let target;
      if (canStream) {
        const handle = await this.saveFilePicker({
          suggestedName: plan.archiveName,
          types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
        });
        if (controller.signal.aborted) throw aborted();
        writable = await handle.createWritable();
        if (controller.signal.aborted) throw aborted();
        target = writable;
      } else {
        target = new BlobWriter('application/zip');
      }
      writer = new ZipWriter(target, { keepOrder: true, bufferedWrite: false });
      for (const path of plan.directories) {
        if (controller.signal.aborted) throw aborted();
        await writer.add(path, null, { directory: true, signal: controller.signal });
      }

      const progressByPath = new Map();
      prefetch = createOrderedPrefetch(plan.files, 3, (file, index) => (
        provider.readFile(file.entry.path, {
            purpose: 'download',
            snapshot: plan.snapshot,
            signal: controller.signal,
            onProgress: ({ loaded }) => {
              progressByPath.set(file.entry.path, loaded);
              onProgress?.({
                phase: 'download',
                completedFiles: index,
                totalFiles: plan.totalFiles,
                loadedBytes: [...progressByPath.values()].reduce((sum, value) => sum + value, 0),
                totalBytes: plan.totalBytes,
                activePath: file.entry.path,
              });
            },
          })
      ), {
        signal: controller.signal,
        onError: (error) => controller.abort(error),
      });

      for (let index = 0; index < plan.files.length; index += 1) {
        if (controller.signal.aborted) throw aborted();
        const file = plan.files[index];
        let raw = await prefetch.get(index);
        await writer.add(file.archivePath, new BlobReader(raw.blob), {
          signal: controller.signal,
          level: 6,
          onprogress: (loaded, total) => onProgress?.({
            phase: 'archive',
            completedFiles: index,
            totalFiles: plan.totalFiles,
            archiveLoaded: loaded,
            archiveTotal: total,
            activePath: file.entry.path,
          }),
        });
        raw = null;
        prefetch.release(index);
        progressByPath.set(file.entry.path, file.entry.size);
        onProgress?.({
          phase: 'archive', completedFiles: index + 1, totalFiles: plan.totalFiles,
          loadedBytes: [...progressByPath.values()].reduce((sum, value) => sum + value, 0),
          totalBytes: plan.totalBytes, activePath: file.entry.path,
        });
      }

      await prefetch.settle();
      if (controller.signal.aborted) throw aborted();
      onProgress?.({
        phase: 'finalizing', completedFiles: plan.totalFiles, totalFiles: plan.totalFiles,
        loadedBytes: plan.totalBytes, totalBytes: plan.totalBytes, activePath: '',
      });
      let output;
      if (canStream) {
        output = await writer.close(undefined, { preventClose: true });
        writer = null;
        if (controller.signal.aborted) throw aborted();
        await writable.close();
      } else {
        output = await writer.close();
      }
      writer = null;
      if (controller.signal.aborted) throw aborted();
      onProgress?.({ phase: 'complete', completedFiles: plan.totalFiles, totalFiles: plan.totalFiles });
      return canStream ? { streamed: true, blob: null } : { streamed: false, blob: output };
    } catch (error) {
      controller.abort();
      await prefetch?.settle();
      try { await writable?.abort?.(error); } catch { /* best effort */ }
      if (error?.name === 'AbortError' || error?.code === 'ABORTED' || signal?.aborted) throw aborted();
      if (isAppError(error)) throw error;
      throw new AppError('ARCHIVE_FAILED', 'ZIP archive creation failed.', { cause: error });
    } finally {
      signal?.removeEventListener('abort', forwardAbort);
    }
  }
}
