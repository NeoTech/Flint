import { describe, it, expect } from 'bun:test';
import { generateSitemap, generateRobotsTxt } from './seo.js';
import type { PageIndexEntry } from './page-index.js';

describe('generateRobotsTxt', () => {
  it('should allow all user agents', () => {
    const result = generateRobotsTxt('https://example.com');
    expect(result).toContain('User-agent: *');
    expect(result).toContain('Allow: /');
  });

  it('should include sitemap URL', () => {
    const result = generateRobotsTxt('https://example.com');
    expect(result).toContain('Sitemap: https://example.com/sitemap.xml');
  });

  it('should include sitemap with basePath', () => {
    const result = generateRobotsTxt('https://example.com', '/Flint');
    expect(result).toContain('Sitemap: https://example.com/Flint/sitemap.xml');
  });

  it('should not have double slashes when basePath is empty', () => {
    const result = generateRobotsTxt('https://example.com', '');
    expect(result).toContain('Sitemap: https://example.com/sitemap.xml');
    expect(result).not.toContain('//sitemap');
  });
});

describe('generateSitemap', () => {
  const pages: PageIndexEntry[] = [
    { url: '/about', title: 'About', description: 'About page', labels: [], category: '', date: '2024-01-20' },
    { url: '/', title: 'Home', description: 'Home page', labels: [], category: '', date: '2024-01-15' },
    { url: '/blog', title: 'Blog', description: 'Blog', labels: [], category: '', date: null },
  ];

  it('should produce valid XML declaration', () => {
    const xml = generateSitemap(pages, 'https://example.com');
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  });

  it('should include urlset with namespace', () => {
    const xml = generateSitemap(pages, 'https://example.com');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  });

  it('should include a <url> for each page', () => {
    const xml = generateSitemap(pages, 'https://example.com');
    const urlCount = (xml.match(/<url>/g) || []).length;
    expect(urlCount).toBe(3);
  });

  it('should build full <loc> from siteUrl and page url', () => {
    const xml = generateSitemap(pages, 'https://example.com');
    expect(xml).toContain('<loc>https://example.com/about</loc>');
    expect(xml).toContain('<loc>https://example.com/</loc>');
    expect(xml).toContain('<loc>https://example.com/blog</loc>');
  });

  it('should include <lastmod> when date is present', () => {
    const xml = generateSitemap(pages, 'https://example.com');
    expect(xml).toContain('<lastmod>2024-01-20</lastmod>');
    expect(xml).toContain('<lastmod>2024-01-15</lastmod>');
  });

  it('should omit <lastmod> when date is null', () => {
    const xml = generateSitemap(pages, 'https://example.com');
    // The blog entry (no date) should have <url> without <lastmod>
    const blogUrl = xml.match(/<url>\s*<loc>https:\/\/example\.com\/blog<\/loc>\s*<\/url>/);
    expect(blogUrl).not.toBeNull();
  });

  it('should handle empty page list', () => {
    const xml = generateSitemap([], 'https://example.com');
    expect(xml).toContain('<urlset');
    expect(xml).toContain('</urlset>');
    expect(xml).not.toContain('<url>');
  });

  it('should strip trailing slash from siteUrl', () => {
    const xml = generateSitemap(pages, 'https://example.com/');
    expect(xml).toContain('<loc>https://example.com/about</loc>');
    expect(xml).not.toContain('https://example.com//');
  });

  it('should not include label index pages', () => {
    const withLabel: PageIndexEntry[] = [
      ...pages,
      { url: '/label/htmx', title: 'Label: htmx', description: '', labels: [], category: '', date: null },
    ];
    const xml = generateSitemap(withLabel, 'https://example.com');
    expect(xml).not.toContain('/label/htmx');
    const urlCount = (xml.match(/<url>/g) || []).length;
    expect(urlCount).toBe(3);
  });
});
