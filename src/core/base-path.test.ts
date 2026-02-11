import { describe, it, expect } from 'bun:test';
import { rewriteAbsolutePaths } from './base-path.js';

describe('rewriteAbsolutePaths', () => {
  it('should return content unchanged when basePath is empty', () => {
    const html = '<button hx-get="/fragments/greeting.html">Load</button>';
    expect(rewriteAbsolutePaths(html, '')).toBe(html);
  });

  it('should prefix hx-get absolute paths', () => {
    const html = '<button hx-get="/fragments/greeting.html">Load</button>';
    const result = rewriteAbsolutePaths(html, '/Flint');
    expect(result).toBe('<button hx-get="/Flint/fragments/greeting.html">Load</button>');
  });

  it('should prefix hx-post absolute paths', () => {
    const html = '<form hx-post="/api/submit">...</form>';
    const result = rewriteAbsolutePaths(html, '/Flint');
    expect(result).toContain('hx-post="/Flint/api/submit"');
  });

  it('should prefix hx-put, hx-delete, hx-patch', () => {
    const html = '<div hx-put="/a" hx-delete="/b" hx-patch="/c"></div>';
    const result = rewriteAbsolutePaths(html, '/Flint');
    expect(result).toContain('hx-put="/Flint/a"');
    expect(result).toContain('hx-delete="/Flint/b"');
    expect(result).toContain('hx-patch="/Flint/c"');
  });

  it('should prefix href absolute paths in content', () => {
    const html = '<a href="/about">About</a>';
    const result = rewriteAbsolutePaths(html, '/Flint');
    expect(result).toBe('<a href="/Flint/about">About</a>');
  });

  it('should prefix src absolute paths', () => {
    const html = '<img src="/images/logo.png">';
    const result = rewriteAbsolutePaths(html, '/Flint');
    expect(result).toBe('<img src="/Flint/images/logo.png">');
  });

  it('should not double-prefix paths that already start with basePath', () => {
    const html = '<a href="/Flint/about">About</a>';
    const result = rewriteAbsolutePaths(html, '/Flint');
    expect(result).toBe('<a href="/Flint/about">About</a>');
  });

  it('should not modify relative paths', () => {
    const html = '<a href="about">About</a>';
    const result = rewriteAbsolutePaths(html, '/Flint');
    expect(result).toBe('<a href="about">About</a>');
  });

  it('should not modify external URLs', () => {
    const html = '<a href="https://example.com/page">Link</a>';
    const result = rewriteAbsolutePaths(html, '/Flint');
    expect(result).toBe('<a href="https://example.com/page">Link</a>');
  });

  it('should not modify protocol-relative URLs', () => {
    const html = '<a href="//cdn.example.com/lib.js">CDN</a>';
    const result = rewriteAbsolutePaths(html, '/Flint');
    expect(result).toBe('<a href="//cdn.example.com/lib.js">CDN</a>');
  });

  it('should handle single-quoted attributes', () => {
    const html = "<button hx-get='/fragments/greeting.html'>Load</button>";
    const result = rewriteAbsolutePaths(html, '/Flint');
    expect(result).toContain("/Flint/fragments/greeting.html");
  });

  it('should handle multiple attributes on the same element', () => {
    const html = '<button hx-get="/fragments/a.html" hx-target="#result" hx-swap="innerHTML">Go</button>';
    const result = rewriteAbsolutePaths(html, '/Flint');
    expect(result).toContain('hx-get="/Flint/fragments/a.html"');
    expect(result).toContain('hx-target="#result"');
  });

  it('should handle multiple elements', () => {
    const html = '<a href="/about">About</a><button hx-get="/fragments/data.html">Load</button>';
    const result = rewriteAbsolutePaths(html, '/Flint');
    expect(result).toContain('href="/Flint/about"');
    expect(result).toContain('hx-get="/Flint/fragments/data.html"');
  });
});
