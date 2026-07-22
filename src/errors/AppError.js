export class AppError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'AppError';
    this.code = code;
    this.status = options.status ?? null;
    this.operation = options.operation ?? null;
    this.retryAt = options.retryAt ?? null;
    this.recoverable = options.recoverable ?? false;
    this.applied = options.applied ?? false;
    this.commitSha = options.commitSha ?? null;
    this.requestId = options.requestId ?? null;
  }
}

export function isAppError(error) {
  return error instanceof AppError;
}
