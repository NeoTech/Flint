import { describe, it, expect } from 'bun:test';
import { CategoryNav } from './category-nav.js';

describe('CategoryNav', () => {
  const createMockPages = () => [
    { shortUri: 'page1', title: 'Page 1', category: 'Documentation', type: 'page' as const },
    { shortUri: 'page2', title: 'Page 2', category: 'Documentation', type: 'page' as const },
    { shortUri: 'page3', title: 'Page 3', category: 'Blog', type: 'post' as const },
    { shortUri: 'page4', title: 'Page 4', category: 'Blog', type: 'post' as const },
    { shortUri: 'page5', title: 'Page 5', category: 'Tutorials', type: 'page' as const },
  ];

  it('should render all categories', () => {
    const pages = createMockPages();
    const html = CategoryNav.render({ pages, currentCategory: null });

    expect(html).toContain('Documentation');
    expect(html).toContain('Blog');
    expect(html).toContain('Tutorials');
  });

  it('should show page count per category', () => {
    const pages = createMockPages();
    const html = CategoryNav.render({ pages, currentCategory: null });

    expect(html).toContain('(2)');
    expect(html).toContain('(1)');
  });

  it('should mark current category as active', () => {
    const pages = createMockPages();
    const html = CategoryNav.render({ pages, currentCategory: 'Documentation' });

    expect(html).toContain('bg-blue-600');
    expect(html).toContain('text-white');
  });

  it('should use HTMX for filtering', () => {
    const pages = createMockPages();
    const html = CategoryNav.render({ pages, currentCategory: null, useHtmx: true });

    expect(html).toContain('hx-boost');
    expect(html).toContain('hx-target');
  });

  it('should link to category index pages', () => {
    const pages = createMockPages();
    const html = CategoryNav.render({ pages, currentCategory: null });

    expect(html).toContain('href="/category/documentation"');
    expect(html).toContain('href="/category/blog"');
  });

  it('should handle empty pages', () => {
    const html = CategoryNav.render({ pages: [], currentCategory: null });
    expect(html).toBe('');
  });

  it('should sort categories alphabetically', () => {
    const pages = createMockPages();
    const html = CategoryNav.render({ pages, currentCategory: null });

    const blogIndex = html.indexOf('Blog');
    const docsIndex = html.indexOf('Documentation');
    const tutorialsIndex = html.indexOf('Tutorials');

    expect(blogIndex).toBeLessThan(docsIndex);
    expect(docsIndex).toBeLessThan(tutorialsIndex);
  });
});
