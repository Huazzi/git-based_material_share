import { describe, expect, it } from 'vitest';
import { resolvePreview } from '@/services/preview/previewRegistry.js';

describe('preview registry', () => {
  it('maps supported extensions without treating HTML as an executable page', () => {
    expect(resolvePreview({ kind: 'file', name: 'README.md' }).kind).toBe('markdown');
    expect(resolvePreview({ kind: 'file', name: 'demo.html' }).kind).toBe('code');
    expect(resolvePreview({ kind: 'file', name: 'archive.zip' }).supported).toBe(false);
  });
});
