import DOMPurify from 'dompurify';

export function sanitizeRepositoryHtml(html) {
  const sanitized = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['style', 'srcset'],
  });
  const document = new DOMParser().parseFromString(sanitized, 'text/html');
  document.querySelectorAll('a').forEach((link) => {
    link.setAttribute('rel', 'noopener noreferrer');
    if (/^https?:/i.test(link.getAttribute('href') || '')) link.setAttribute('target', '_blank');
  });
  return document.body.innerHTML;
}

export function sanitizeCodeHtml(html) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['span'],
    ALLOWED_ATTR: ['class'],
  });
}

export function sanitizeSvg(svg) {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: false },
    FORBID_TAGS: ['script', 'foreignObject', 'a'],
    FORBID_ATTR: ['style'],
  });
}
