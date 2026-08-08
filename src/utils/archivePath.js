import { getParentPath, normalizePath } from '@/utils/path.js';

export function commonParentPath(entries = []) {
  if (!entries.length) return '';
  const parents = entries.map((entry) => getParentPath(entry.path).split('/').filter(Boolean));
  const common = [];
  const shortest = Math.min(...parents.map((parts) => parts.length));
  for (let index = 0; index < shortest; index += 1) {
    const value = parents[0][index];
    if (!parents.every((parts) => parts[index] === value)) break;
    common.push(value);
  }
  return common.join('/');
}

export function toArchivePath(repositoryPath, rootPath = '', { directory = false } = {}) {
  const normalized = normalizePath(repositoryPath);
  const root = normalizePath(rootPath);
  if (root && normalized !== root && !normalized.startsWith(`${root}/`)) {
    throw new TypeError('Archive entry is outside the selected root.');
  }
  let relative = root ? normalized.slice(root.length).replace(/^\//, '') : normalized;
  if (!relative) relative = normalized.split('/').pop() || 'archive';
  const safe = normalizePath(relative);
  if (!safe || safe.startsWith('/') || safe.includes('\0')) {
    throw new TypeError('Archive path is invalid.');
  }
  return directory ? `${safe}/` : safe;
}

export function createArchiveName(rootPath = '') {
  const normalized = normalizePath(rootPath);
  const base = normalized.split('/').pop() || 'repository-files';
  return `${base}.zip`;
}
