import { getFileExtension } from '@/utils/file.js';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogg', 'mov']);
const CODE_EXTENSIONS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'json', 'html', 'css', 'xml', 'py', 'rb', 'java', 'c', 'cpp',
  'cs', 'php', 'sh', 'go', 'swift', 'kt', 'sql', 'vue',
]);
const TEXT_EXTENSIONS = new Set(['txt', 'log', 'csv', 'ini', 'yaml', 'yml', 'toml', 'properties']);

export function resolvePreview(entry) {
  if (!entry || entry.kind !== 'file') return { kind: 'unsupported', supported: false };
  const extension = getFileExtension(entry.name);
  if (extension === 'pdf') return { kind: 'pdf', supported: true };
  if (extension === 'docx') return { kind: 'docx', supported: true };
  if (extension === 'md' || extension === 'markdown') return { kind: 'markdown', supported: true };
  if (IMAGE_EXTENSIONS.has(extension)) return { kind: 'image', supported: true, extension };
  if (VIDEO_EXTENSIONS.has(extension)) return { kind: 'video', supported: true, extension };
  if (CODE_EXTENSIONS.has(extension)) return { kind: 'code', supported: true, extension };
  if (TEXT_EXTENSIONS.has(extension)) return { kind: 'text', supported: true, extension };
  return { kind: 'unsupported', supported: false, extension };
}
