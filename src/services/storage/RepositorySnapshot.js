import { SYSTEM_FILES } from '@/constants/systemFiles.js';
import { AppError } from '@/errors/AppError.js';
import { getFileName, getParentPath, normalizePath } from '@/utils/path.js';

function toKind(item) {
  if (item.type === 'tree') return 'directory';
  if (item.type === 'commit' && item.mode === '160000') return 'submodule';
  if (item.type === 'blob' && item.mode === '120000') return 'symlink';
  if (item.type === 'blob') return 'file';
  return null;
}

function compareEntries(left, right) {
  const leftDirectory = left.kind === 'directory';
  const rightDirectory = right.kind === 'directory';
  if (leftDirectory !== rightDirectory) return leftDirectory ? -1 : 1;
  return left.name.localeCompare(right.name, 'zh-CN', { numeric: true, sensitivity: 'base' });
}

export class RepositorySnapshot {
  constructor({ commitSha, treeSha, tree, truncated = false }) {
    if (truncated) {
      throw new AppError('TREE_TRUNCATED', 'Recursive Git tree response was truncated.');
    }

    this.commitSha = commitSha;
    this.treeSha = treeSha;
    this.loadedAt = Date.now();
    this.entriesByPath = new Map();
    this.childrenByPath = new Map();
    this.searchableFiles = [];

    for (const item of tree || []) {
      const kind = toKind(item);
      if (!kind) continue;
      const path = normalizePath(item.path);
      const entry = Object.freeze({
        id: `${kind}:${path}`,
        name: getFileName(path),
        path,
        kind,
        sha: item.sha,
        size: Number.isFinite(item.size) ? item.size : null,
        mode: item.mode || null,
      });
      this.entriesByPath.set(path, entry);

      if (!SYSTEM_FILES.has(entry.name)) {
        const parent = getParentPath(path);
        const children = this.childrenByPath.get(parent) || [];
        children.push(entry);
        this.childrenByPath.set(parent, children);
        if (kind === 'file') this.searchableFiles.push(entry);
      }
    }

    for (const children of this.childrenByPath.values()) {
      children.sort(compareEntries);
      Object.freeze(children);
    }
    Object.freeze(this.searchableFiles);
  }

  list(path = '') {
    return this.childrenByPath.get(normalizePath(path)) || [];
  }

  stat(path) {
    return this.entriesByPath.get(normalizePath(path)) || null;
  }

  search(query) {
    const normalized = String(query || '').trim().toLocaleLowerCase('zh-CN');
    if (!normalized) return [];
    return this.searchableFiles.filter((entry) => entry.path.toLocaleLowerCase('zh-CN').includes(normalized));
  }

  descendantLeaves(directoryPath) {
    const directory = normalizePath(directoryPath);
    const prefix = `${directory}/`;
    return [...this.entriesByPath.values()].filter((entry) => (
      entry.path.startsWith(prefix) && entry.kind !== 'directory'
    ));
  }
}
