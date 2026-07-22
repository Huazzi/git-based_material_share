import { AppError, isAppError } from '@/errors/AppError.js';

function header(headers, name) {
  return headers?.[name] ?? headers?.[name.toLowerCase()] ?? null;
}

function retryAtFrom(headers) {
  const retryAfterHeader = header(headers, 'retry-after');
  const retryAfter = retryAfterHeader === null ? Number.NaN : Number(retryAfterHeader);
  if (Number.isFinite(retryAfter)) return new Date(Date.now() + retryAfter * 1000);
  const resetHeader = header(headers, 'x-ratelimit-reset');
  const reset = resetHeader === null ? Number.NaN : Number(resetHeader);
  return Number.isFinite(reset) ? new Date(reset * 1000) : null;
}

export function mapGitHubError(error, context = {}) {
  if (isAppError(error)) return error;
  const operation = context.operation || null;
  if (error?.code === 'ERR_CANCELED' || error?.name === 'AbortError') {
    return new AppError('ABORTED', 'Request aborted.', { operation, recoverable: true });
  }

  const status = error?.response?.status ?? null;
  const headers = error?.response?.headers || {};
  const remainingHeader = header(headers, 'x-ratelimit-remaining');
  const options = {
    status,
    operation,
    requestId: header(headers, 'x-github-request-id'),
  };

  if (!status && context.mutation) {
    return new AppError('MUTATION_RESULT_UNKNOWN', 'Mutation outcome is unknown.', {
      ...options, uncertain: true, recoverable: false,
    });
  }
  if (!status) return new AppError('NETWORK_ERROR', 'Network request failed.', { ...options, recoverable: true });
  if (status === 401) return new AppError('AUTH_INVALID', 'GitHub rejected the token.', options);
  if ((status === 403 || status === 429) && remainingHeader !== null && Number(remainingHeader) === 0) {
    return new AppError('RATE_LIMITED', 'GitHub rate limit exceeded.', {
      ...options, retryAt: retryAtFrom(headers), recoverable: true,
    });
  }
  if ((status === 403 || status === 429) && header(headers, 'retry-after')) {
    return new AppError('SECONDARY_RATE_LIMITED', 'GitHub secondary rate limit exceeded.', {
      ...options, retryAt: retryAtFrom(headers), recoverable: true,
    });
  }
  if (status === 403) return new AppError('PERMISSION_DENIED', 'GitHub permission denied.', options);
  if (status === 404 && context.anonymousInitialize) {
    return new AppError('REPOSITORY_NOT_FOUND_OR_PRIVATE', 'Repository was not found or is private.', options);
  }
  if (status === 404) return new AppError('RESOURCE_NOT_FOUND', 'GitHub resource was not found.', options);
  if (status === 409 && operation === 'load-ref') {
    return new AppError('EMPTY_REPOSITORY_UNSUPPORTED', 'Repository has no initialized branch.', options);
  }
  if (status === 409) return new AppError('GIT_CONFLICT', 'GitHub reported a conflict.', options);
  if (status === 422 && operation === 'update-ref') {
    return new AppError('GIT_CONFLICT', 'Branch changed before the reference update.', options);
  }
  if (status === 422) return new AppError('VALIDATION_FAILED', 'GitHub rejected the request.', options);
  if (status >= 500) {
    return new AppError('GITHUB_UNAVAILABLE', 'GitHub is temporarily unavailable.', {
      ...options, recoverable: true,
    });
  }
  return new AppError('UNKNOWN', 'Unexpected GitHub error.', options);
}
