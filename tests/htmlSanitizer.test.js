import { describe, expect, it } from 'vitest';
import { sanitizeCodeHtml, sanitizeRepositoryHtml, sanitizeSvg } from '@/services/preview/htmlSanitizer.js';

describe('preview sanitizers', () => {
  it('removes executable repository HTML and hardens external links', () => {
    const html = sanitizeRepositoryHtml('<img src=x onerror=alert(1)><script>alert(1)</script><a href="javascript:alert(1)">bad</a><a href="https://example.com">safe</a>');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('restricts code markup and SVG content', () => {
    expect(sanitizeCodeHtml('<span class="token">ok</span><img src=x>')).toBe('<span class="token">ok</span>');
    const svg = sanitizeSvg('<svg><script>alert(1)</script><foreignObject>bad</foreignObject><circle cx="1" cy="1" r="1"/></svg>');
    expect(svg).not.toContain('script');
    expect(svg).not.toContain('foreignObject');
    expect(svg).toContain('circle');
  });
});
