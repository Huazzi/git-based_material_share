import { beforeEach, describe, expect, it, vi } from 'vitest';

const axiosHarness = vi.hoisted(() => {
  const handlers = {};
  const client = {
    defaults: { headers: { common: {} } },
    interceptors: {
      response: {
        use: vi.fn((success, failure) => {
          handlers.success = success;
          handlers.failure = failure;
        }),
      },
    },
  };
  return { handlers, client, create: vi.fn(() => client) };
});

vi.mock('axios', () => ({ default: { create: axiosHarness.create } }));

import { createGitHubClient } from '@/services/github/githubClient.js';

describe('GitHub client rate-limit tracking', () => {
  beforeEach(() => {
    axiosHarness.create.mockClear();
    axiosHarness.client.interceptors.response.use.mockClear();
  });

  it('updates rate-limit state from error response headers', async () => {
    const onRateLimit = vi.fn();
    createGitHubClient({ onRateLimit });
    const error = {
      response: {
        status: 403,
        headers: { 'x-ratelimit-limit': '60', 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '100' },
      },
      config: { metadata: {} },
    };

    await expect(axiosHarness.handlers.failure(error)).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    expect(onRateLimit).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 60, remaining: 0 }));
  });

  it('supports AxiosHeaders-style getters without inventing zero values', () => {
    const onRateLimit = vi.fn();
    createGitHubClient({ onRateLimit });
    axiosHarness.handlers.success({
      headers: { get: (name) => (name === 'x-ratelimit-remaining' ? '42' : null) },
    });
    expect(onRateLimit).toHaveBeenLastCalledWith(expect.objectContaining({
      limit: null, remaining: 42, resetAt: null,
    }));
  });
});
