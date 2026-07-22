export function getFileExtension(filename = '') {
  const name = String(filename);
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}

export function splitFileName(filename) {
  const extension = getFileExtension(filename);
  if (!extension) return { stem: filename, extension: '' };
  return {
    stem: filename.slice(0, -(extension.length + 1)),
    extension,
  };
}

export function createAvailableFileName(filename, exists) {
  if (!exists(filename)) return filename;
  const { stem, extension } = splitFileName(filename);
  let counter = 1;
  let candidate;
  do {
    candidate = `${stem} (${counter})${extension ? `.${extension}` : ''}`;
    counter += 1;
  } while (exists(candidate));
  return candidate;
}
