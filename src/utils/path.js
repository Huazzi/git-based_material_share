function assertSafePart(part) {
  if (part === '.' || part === '..') {
    throw new TypeError('Path traversal segments are not allowed.');
  }
  return part;
}

export function normalizePath(path = '') {
  if (typeof path !== 'string') {
    throw new TypeError('Path must be a string.');
  }

  return path
    .replaceAll('\\', '/')
    .split('/')
    .filter(Boolean)
    .map(assertSafePart)
    .join('/');
}

export function joinPath(...parts) {
  return normalizePath(parts.filter(Boolean).join('/'));
}

export function getParentPath(path) {
  const normalized = normalizePath(path);
  const separator = normalized.lastIndexOf('/');
  return separator === -1 ? '' : normalized.slice(0, separator);
}

export function getFileName(path) {
  const normalized = normalizePath(path);
  const separator = normalized.lastIndexOf('/');
  return separator === -1 ? normalized : normalized.slice(separator + 1);
}

export function encodeRepositoryPath(path) {
  return normalizePath(path).split('/').map(encodeURIComponent).join('/');
}

export function encodeRefPath(branch) {
  const normalized = normalizePath(branch);
  if (!normalized) {
    throw new TypeError('Branch is required.');
  }
  return normalized.split('/').map(encodeURIComponent).join('/');
}
