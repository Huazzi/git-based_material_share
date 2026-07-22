export class RateLimitTracker {
  constructor() {
    this.limit = null;
    this.remaining = null;
    this.resetAt = null;
    this.retryAfter = null;
  }

  update(headers = {}) {
    const read = (name) => headers?.get?.(name) ?? headers?.[name] ?? headers?.[name.toLowerCase()];
    const number = (name) => {
      const value = read(name);
      return value === null || value === undefined || value === '' ? Number.NaN : Number(value);
    };
    const limit = number('x-ratelimit-limit');
    const remaining = number('x-ratelimit-remaining');
    const reset = number('x-ratelimit-reset');
    const retryAfter = number('retry-after');
    if (Number.isFinite(limit)) this.limit = limit;
    if (Number.isFinite(remaining)) this.remaining = remaining;
    if (Number.isFinite(reset)) this.resetAt = new Date(reset * 1000);
    if (Number.isFinite(retryAfter)) this.retryAfter = retryAfter;
    return this.snapshot();
  }

  snapshot() {
    return {
      limit: this.limit,
      remaining: this.remaining,
      resetAt: this.resetAt,
      retryAfter: this.retryAfter,
    };
  }
}
