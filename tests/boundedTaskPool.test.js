import { describe, expect, it, vi } from 'vitest';
import { createOrderedPrefetch, mapWithConcurrency } from '@/utils/boundedTaskPool.js';

function abortableWait(signal) {
  if (signal.aborted) return Promise.reject(signal.reason || new Error('aborted'));
  return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason || new Error('aborted')), { once: true }));
}

describe('bounded task utilities', () => {
  it('preserves result order and never exceeds the concurrency limit', async () => {
    let active = 0;
    let maximum = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return value * 2;
    });
    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(maximum).toBe(2);
  });

  it('prefetches concurrently while exposing and releasing results in caller order', async () => {
    let active = 0;
    let maximum = 0;
    const prefetch = createOrderedPrefetch([1, 2, 3, 4], 3, async (value) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, value === 1 ? 5 : 1));
      active -= 1;
      return value * 10;
    });
    const results = [];
    for (let index = 0; index < 4; index += 1) {
      results.push(await prefetch.get(index));
      prefetch.release(index);
    }
    await prefetch.settle();
    expect(results).toEqual([10, 20, 30, 40]);
    expect(maximum).toBe(3);
  });

  it('counts a leased result against capacity until archive consumption releases it', async () => {
    const started = [];
    const prefetch = createOrderedPrefetch([0, 1, 2, 3], 3, async (value) => {
      started.push(value);
      return { value };
    });
    const first = await prefetch.get(0);
    await Promise.resolve();
    expect(first).toEqual({ value: 0 });
    expect(started).toEqual([0, 1, 2]);

    prefetch.release(0);
    await Promise.resolve();
    expect(started).toEqual([0, 1, 2, 3]);
    for (let index = 1; index < 4; index += 1) {
      await prefetch.get(index);
      prefetch.release(index);
    }
    await prefetch.settle();
  });

  it('propagates the first prefetched failure immediately and starts no later work', async () => {
    const controller = new AbortController();
    const started = [];
    const onError = vi.fn((error) => controller.abort(error));
    const failure = new Error('read failed');
    const prefetch = createOrderedPrefetch([0, 1, 2, 3], 3, async (value) => {
      started.push(value);
      if (value === 1) throw failure;
      return abortableWait(controller.signal);
    }, { signal: controller.signal, onError });

    await expect(prefetch.get(0)).rejects.toBe(failure);
    await prefetch.settle();
    expect(onError).toHaveBeenCalledWith(failure);
    expect(started).toEqual([0, 1, 2]);
  });
});
