import { describe, it, expect } from 'bun:test';
import {
  generatePageIndex,
  generateLabelSlug,
  type PageIndexEntry,
} from './page-index.js';
import type { PageMetadata } from './page-metadata.js';

function makePage(overrides: Partial<PageMetadata> & { url: string }): PageMetadata & { url: string } {
  return {
    shortUri: 'test-page',
    title: 'Test Page',
    type: 'page',
    category: '',
    labels: [],
    parent: 'root',
    order: 999,
    author: '',
    date: null,
    description: '',
    keywords: [],
    ...overrides,
  };
}

describe('PageIndex', () => {
  describe('generateLabelSlug', () => {
    it('should lowercase and replace non-alphanum with hyphens', () => {
      expect(generateLabelSlug('HTMX')).toBe('htmx');
      expect(generateLabelSlug('Tips & Tricks')).toBe('tips-tricks');
    });

    it('should trim leading/trailing hyphens', () => {
      expect(generateLabelSlug('--hello--')).toBe('hello');
    });

    it('should collapse multiple hyphens', () => {
      expect(generateLabelSlug('a   b   c')).toBe('a-b-c');
    });
  });

  describe('generatePageIndex', () => {
    it('should produce an entry for each page', () => {
      const pages = [
        makePage({ shortUri: 'home', title: 'Home', url: '/' }),
        makePage({ shortUri: 'about', title: 'About', url: '/about' }),
      ];

      const index = generatePageIndex(pages);

      expect(index).toHaveLength(2);
    });

    it('should include url, title, description, labels, category, date', () => {
      const pages = [
        makePage({
          shortUri: 'post',
          title: 'A Post',
          url: '/blog/post',
          description: 'About a post',
          labels: ['htmx', 'css'],
          category: 'Tutorials',
          date: new Date('2026-01-15'),
        }),
      ];

      const index = generatePageIndex(pages);
      const entry = index[0];

      expect(entry.url).toBe('/blog/post');
      expect(entry.title).toBe('A Post');
      expect(entry.description).toBe('About a post');
      expect(entry.labels).toEqual(['htmx', 'css']);
      expect(entry.category).toBe('Tutorials');
      expect(entry.date).toBe('2026-01-15');
    });

    it('should format date as ISO string (YYYY-MM-DD)', () => {
      const pages = [
        makePage({ shortUri: 'p', url: '/p', date: new Date('2026-02-05T00:00:00Z') }),
      ];

      const index = generatePageIndex(pages);
      expect(index[0].date).toBe('2026-02-05');
    });

    it('should use null for missing dates', () => {
      const pages = [
        makePage({ shortUri: 'p', url: '/p', date: null }),
      ];

      const index = generatePageIndex(pages);
      expect(index[0].date).toBeNull();
    });

    it('should return empty array for no pages', () => {
      expect(generatePageIndex([])).toEqual([]);
    });

    it('should handle pages with empty labels', () => {
      const pages = [
        makePage({ shortUri: 'p', url: '/p', labels: [] }),
      ];

      const index = generatePageIndex(pages);
      expect(index[0].labels).toEqual([]);
    });
  });
});
