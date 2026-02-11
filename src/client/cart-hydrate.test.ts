import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';

describe('cart-hydrate product index fetch', () => {
  const originalFetch = globalThis.fetch;
  let fetchSpy: ReturnType<typeof mock>;

  beforeEach(() => {
    // Clean up any existing meta tags
    document.head.innerHTML = '';
    document.body.innerHTML = '';

    // Mock fetch globally
    fetchSpy = mock(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mock.restore();
  });

  it('reads base-path from meta tag', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'base-path');
    meta.setAttribute('content', '/my-project');
    document.head.appendChild(meta);

    const result = document.querySelector('meta[name="base-path"]')?.getAttribute('content') || '';
    expect(result).toBe('/my-project');
  });

  it('returns empty string when no base-path meta exists', () => {
    const result = document.querySelector('meta[name="base-path"]')?.getAttribute('content') || '';
    expect(result).toBe('');
  });

  it('constructs correct product index URL with base path', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'base-path');
    meta.setAttribute('content', '/Kimi2.5-test');
    document.head.appendChild(meta);

    const basePath = document.querySelector('meta[name="base-path"]')?.getAttribute('content') || '';
    const url = `${basePath}/static/products/index.json`;
    expect(url).toBe('/Kimi2.5-test/static/products/index.json');
  });

  it('constructs correct product index URL without base path', () => {
    const basePath = document.querySelector('meta[name="base-path"]')?.getAttribute('content') || '';
    const url = `${basePath}/static/products/index.json`;
    expect(url).toBe('/static/products/index.json');
  });
});
