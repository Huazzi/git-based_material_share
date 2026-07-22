import { describe, expect, it } from 'vitest';
import { MutationQueue } from '@/services/mutation/MutationQueue.js';

describe('MutationQueue', () => {
  it('runs tasks in FIFO order and survives a rejection', async () => {
    const queue = new MutationQueue();
    const events = [];
    const first = queue.enqueue('first', async () => {
      events.push('first');
      throw new Error('expected');
    });
    const second = queue.enqueue('second', async () => {
      events.push('second');
      return 2;
    });
    await expect(first).rejects.toThrow('expected');
    await expect(second).resolves.toBe(2);
    expect(events).toEqual(['first', 'second']);
  });
});
