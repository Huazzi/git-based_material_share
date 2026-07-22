import { describe, expect, it } from 'vitest';
import { mapGitHubError } from '@/services/github/githubError.js';

function responseError(status, headers = {}) {
  return { response: { status, headers } };
}

describe('GitHub error mapping', () => {
  it('distinguishes permission and rate-limit responses', () => {
    expect(mapGitHubError(responseError(403), {}).code).toBe('PERMISSION_DENIED');
    expect(mapGitHubError(responseError(403, { 'x-ratelimit-remaining': '0' }), {}).code).toBe('RATE_LIMITED');
    expect(mapGitHubError(responseError(429, { 'retry-after': '30' }), {}).code).toBe('SECONDARY_RATE_LIMITED');
  });

  it('uses safe anonymous and ref-conflict errors', () => {
    expect(mapGitHubError(responseError(404), { anonymousInitialize: true }).code)
      .toBe('REPOSITORY_NOT_FOUND_OR_PRIVATE');
    expect(mapGitHubError(responseError(422), { operation: 'update-ref' }).code).toBe('GIT_CONFLICT');
  });
});
