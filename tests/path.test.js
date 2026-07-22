import { describe, expect, it } from 'vitest';
import { encodeRepositoryPath, getParentPath, joinPath, normalizePath } from '@/utils/path.js';

describe('path utilities', () => {
  it('normalizes repository paths without losing unicode', () => {
    expect(normalizePath('/资料\\Java//Spring.pdf')).toBe('资料/Java/Spring.pdf');
    expect(joinPath('/资料/', 'Java', 'Spring.pdf')).toBe('资料/Java/Spring.pdf');
    expect(getParentPath('资料/Java/Spring.pdf')).toBe('资料/Java');
  });

  it('encodes every path segment', () => {
    expect(encodeRepositoryPath('资料/a #?.md')).toBe('%E8%B5%84%E6%96%99/a%20%23%3F.md');
  });

  it('rejects traversal segments', () => {
    expect(() => normalizePath('../secret')).toThrow(TypeError);
  });
});
