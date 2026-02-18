import { describe, it, expect } from 'bun:test';
import { generateSitemap, generateRobotsTxt, generateLlmsTxt } from './seo.js';
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

describe('generateLlmsTxt', () => {
  const pages: PageIndexEntry[] = [
    { url: '/', title: 'Home', description: 'Welcome to the site', labels: [], category: 'General', date: null, type: 'page' },
    { url: '/about', title: 'About', description: 'About us', labels: [], category: 'General', date: null, type: 'page' },
    { url: '/shop', title: 'Shop', description: 'Browse products', labels: [], category: 'Shop', date: null, type: 'section' },
    { url: '/shop/mug', title: 'Blue Mug', description: 'A ceramic mug', labels: [], category: 'Shop', date: null, type: 'product' },
    { url: '/blog/post-1', title: 'First Post', description: 'My first post', labels: [], category: 'Blog', date: '2024-01-01', type: 'post' },
    { url: '/blog/post-2', title: 'Second Post', description: 'Another post', labels: [], category: 'Blog', date: '2024-02-01', type: 'post' },
    { url: '/label/htmx', title: 'Label: htmx', description: '', labels: [], category: '', date: null },
  ];

  it('should start with an H1 site name', () => {
    const result = generateLlmsTxt(pages, 'https://example.com', '', 'My Site');
    expect(result).toMatch(/^# My Site\n/);
  });

  it('should include a blockquote description when provided', () => {
    const result = generateLlmsTxt(pages, 'https://example.com', '', 'My Site', 'A great site.');
    expect(result).toContain('> A great site.');
  });

  it('should omit blockquote when description is empty', () => {
    const result = generateLlmsTxt(pages, 'https://example.com', '', 'My Site', '');
    expect(result).not.toContain('> ');
  });

  it('should create H2 sections per category', () => {
    const result = generateLlmsTxt(pages, 'https://example.com', '', 'My Site');
    expect(result).toContain('## General');
    expect(result).toContain('## Shop');
  });

  it('should put posts in ## Optional section', () => {
    const result = generateLlmsTxt(pages, 'https://example.com', '', 'My Site');
    expect(result).toContain('## Optional');
    const optionalIdx = result.indexOf('## Optional');
    expect(result.indexOf('First Post')).toBeGreaterThan(optionalIdx);
    expect(result.indexOf('Second Post')).toBeGreaterThan(optionalIdx);
  });

  it('should not put posts in category sections', () => {
    const result = generateLlmsTxt(pages, 'https://example.com', '', 'My Site');
    expect(result).not.toContain('## Blog');
  });

  it('should omit ## Optional when no posts exist', () => {
    const noPosts = pages.filter(p => p.type !== 'post');
    const result = generateLlmsTxt(noPosts, 'https://example.com', '', 'My Site');
    expect(result).not.toContain('## Optional');
  });

  it('should produce full URLs for each entry', () => {
    const result = generateLlmsTxt(pages, 'https://example.com', '', 'My Site');
    expect(result).toContain('(https://example.com/about)');
    expect(result).toContain('(https://example.com/shop/mug)');
  });

  it('should include description after colon', () => {
    const result = generateLlmsTxt(pages, 'https://example.com', '', 'My Site');
    expect(result).toContain('[About](https://example.com/about): About us');
  });

  it('should exclude label index pages', () => {
    const result = generateLlmsTxt(pages, 'https://example.com', '', 'My Site');
    expect(result).not.toContain('/label/htmx');
  });

  it('should respect basePath in URL prefix and label exclusion', () => {
    const withBasePath: PageIndexEntry[] = [
      ...pages.filter(p => p.type !== 'post' && p.url !== '/label/htmx'),
      { url: '/Flint/label/htmx', title: 'Label: htmx', description: '', labels: [], category: '', date: null },
    ];
    const result = generateLlmsTxt(withBasePath, 'https://example.com', '/Flint', 'My Site');
    expect(result).toContain('(https://example.com/about)');
    expect(result).not.toContain('/Flint/label/htmx');
  });

  it('should handle empty page list', () => {
    const result = generateLlmsTxt([], 'https://example.com', '', 'Empty Site');
    expect(result).toContain('# Empty Site');
    expect(result).not.toContain('## Optional');
  });

  it('should strip trailing slash from siteUrl', () => {
    const result = generateLlmsTxt(pages, 'https://example.com/', '', 'My Site');
    expect(result).not.toContain('https://example.com//');
  });

  it('should use Docs as fallback category for uncategorised pages', () => {
    const uncategorised: PageIndexEntry[] = [
      { url: '/mystery', title: 'Mystery', description: 'Unknown', labels: [], category: '', date: null, type: 'page' },
    ];
    const result = generateLlmsTxt(uncategorised, 'https://example.com', '', 'My Site');
    expect(result).toContain('## Docs');
  });
});
