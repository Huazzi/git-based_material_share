export class RateLimitTracker {
  constructor() {
    this.limit = null;
    this.remaining = null;
    this.resetAt = null;
    this.retryAfter = null;
  }

  update(headers = {}) {
    const limit = Number(headers['x-ratelimit-limit']);
    const remaining = Number(headers['x-ratelimit-remaining']);
    const reset = Number(headers['x-ratelimit-reset']);
    const retryAfter = Number(headers['retry-after']);
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
