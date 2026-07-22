import { AppError } from '@/errors/AppError.js';

export class MutationQueue {
  #tail = Promise.resolve();
  #closed = false;
  #listeners = new Set();

  constructor() {
    this.pendingCount = 0;
    this.activeLabel = '';
  }

  get isBusy() {
    return this.pendingCount > 0;
  }

  subscribe(listener) {
    this.#listeners.add(listener);
    listener(this.getState());
    return () => this.#listeners.delete(listener);
  }

  getState() {
    return { pendingCount: this.pendingCount, activeLabel: this.activeLabel, isBusy: this.isBusy };
  }

  #notify() {
    const state = this.getState();
    this.#listeners.forEach((listener) => listener(state));
  }

  enqueue(label, operation) {
    if (this.#closed) {
      return Promise.reject(new AppError('QUEUE_CLOSED', 'Mutation queue is closed.'));
    }
    this.pendingCount += 1;
    this.#notify();

    const result = this.#tail.then(async () => {
      if (this.#closed) throw new AppError('QUEUE_CLOSED', 'Mutation queue is closed.');
      this.activeLabel = label;
      this.#notify();
      return operation();
    });

    this.#tail = result
      .catch(() => undefined)
      .finally(() => {
        this.pendingCount -= 1;
        this.activeLabel = '';
        this.#notify();
      });

    return result;
  }

  close() {
    this.#closed = true;
  }
}
