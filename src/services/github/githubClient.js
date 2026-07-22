import axios from 'axios';
import { mapGitHubError } from './githubError.js';
import { RateLimitTracker } from './rateLimitTracker.js';

export function createGitHubClient({ token = '', onRateLimit } = {}) {
  const tracker = new RateLimitTracker();
  const client = axios.create({
    baseURL: 'https://api.github.com',
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
    },
  });

  if (token) client.defaults.headers.common.Authorization = `Bearer ${token}`;

  const updateRateLimit = (response) => {
    const state = tracker.update(response?.headers);
    onRateLimit?.(state);
  };

  client.interceptors.response.use(
    (response) => {
      updateRateLimit(response);
      return response;
    },
    (error) => {
      updateRateLimit(error?.response);
      return Promise.reject(mapGitHubError(error, error?.config?.metadata));
    },
  );

  client.rateLimitTracker = tracker;
  return client;
}
