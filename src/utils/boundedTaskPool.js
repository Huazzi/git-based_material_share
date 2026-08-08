import { AppError } from '@/errors/AppError.js';

export async function mapWithConcurrency(items, limit, worker, { signal, onSettled } = {}) {
  if (!Number.isInteger(limit) || limit < 1) throw new TypeError('Concurrency limit must be positive.');
  const results = new Array(items.length);
  let cursor = 0;
  let firstError = null;

  async function run() {
    while (!firstError) {
      if (signal?.aborted) {
        firstError = new AppError('ABORTED', 'Operation aborted.');
        return;
      }
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      try {
        results[index] = await worker(items[index], index);
        onSettled?.(items[index], index, results[index]);
      } catch (error) {
        firstError = error;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  if (firstError) throw firstError;
  return results;
}

export function createOrderedPrefetch(items, limit, worker, { signal, onError } = {}) {
  if (!Number.isInteger(limit) || limit < 1) throw new TypeError('Concurrency limit must be positive.');
  const slots = new Map();
  const activeCompletions = new Set();
  let cursor = 0;
  let firstError = null;
  let resolveFailure;
  const failure = new Promise((resolve) => { resolveFailure = resolve; });

  function fail(error, { notify = true } = {}) {
    if (firstError) return;
    firstError = error;
    resolveFailure({ ok: false, error });
    if (notify) onError?.(error);
  }

  const abort = () => fail(new AppError('ABORTED', 'Operation aborted.'), { notify: false });
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });

  function fill() {
    while (slots.size < limit && cursor < items.length && !firstError && !signal?.aborted) {
      const index = cursor;
      cursor += 1;
      const settled = Promise.resolve()
        .then(() => worker(items[index], index))
        .then((value) => ({ ok: true, value }), (error) => {
          fail(error);
          return { ok: false, error };
        });
      const completion = settled.then(() => undefined);
      activeCompletions.add(completion);
      completion.finally(() => activeCompletions.delete(completion));
      slots.set(index, { task: settled, leased: false });
    }
  }

  async function get(index) {
    if (firstError) throw firstError;
    fill();
    const slot = slots.get(index);
    if (!slot) throw new RangeError('Prefetch index is unavailable.');
    const result = await Promise.race([slot.task, failure]);
    if (firstError) throw firstError;
    if (!result.ok) throw result.error;
    slot.leased = true;
    return result.value;
  }

  function release(index) {
    const slot = slots.get(index);
    if (!slot?.leased) throw new RangeError('Prefetch slot is not leased.');
    slots.delete(index);
    fill();
  }

  async function settle() {
    while (activeCompletions.size) await Promise.all([...activeCompletions]);
    signal?.removeEventListener('abort', abort);
  }

  fill();
  return { get, release, settle };
}
