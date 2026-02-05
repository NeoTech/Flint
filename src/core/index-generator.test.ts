import { describe, it, expect } from 'vitest';
import { 
  generateCategoryIndex,
  generateLabelIndex,
  generateAllIndexes,
  type IndexPage 
} from './index-generator.js';

describe('IndexGenerator', () => {
  const createMockPages = () => [
    { 
      shortUri: 'getting-started', 
      title: 'Getting Started', 
      category: 'Documentation',
      labels: ['tutorial', 'beginner'],
      description: 'A beginner tutorial',
      date: '2024-01-15',
      type: 'page' as const 
    },
    { 
      shortUri: 'advanced-guide', 
      title: 'Advanced Guide', 
      category: 'Documentation',
      labels: ['tutorial', 'advanced'],
      description: 'An advanced tutorial',
      date: '2024-02-01',
      type: 'page' as const 
    },
    { 
      shortUri: 'first-post', 
      title: 'First Post', 
      category: 'Blog',
      labels: ['news'],
      description: 'Our first blog post',
      date: '2024-01-01',
      type: 'post' as const 
    },
  ];

  describe('generateCategoryIndex', () => {
    it('should generate index for category', () => {
      const pages = createMockPages();
      const index = generateCategoryIndex('Documentation', pages);

      expect(index.title).toBe('Documentation');
      expect(index.pages).toHaveLength(2);
      // Sorted by date descending, so advanced-guide (2024-02-01) comes first
      expect(index.pages[0].shortUri).toBe('advanced-guide');
      expect(index.pages[1].shortUri).toBe('getting-started');
    });

    it('should sort pages by date descending', () => {
      const pages = createMockPages();
      const index = generateCategoryIndex('Documentation', pages);

      expect(index.pages[0].shortUri).toBe('advanced-guide');
      expect(index.pages[1].shortUri).toBe('getting-started');
    });

    it('should include metadata', () => {
      const pages = createMockPages();
      const index = generateCategoryIndex('Documentation', pages);

      expect(index.description).toContain('2 pages');
      expect(index.keywords).toContain('Documentation');
    });
  });

  describe('generateLabelIndex', () => {
    it('should generate index for label', () => {
      const pages = createMockPages();
      const index = generateLabelIndex('tutorial', pages);

      expect(index.title).toBe('tutorial');
      expect(index.pages).toHaveLength(2);
    });

    it('should only include pages with label', () => {
      const pages = createMockPages();
      const index = generateLabelIndex('news', pages);

      expect(index.pages).toHaveLength(1);
      expect(index.pages[0].shortUri).toBe('first-post');
    });

    it('should handle non-existent label', () => {
      const pages = createMockPages();
      const index = generateLabelIndex('non-existent', pages);

      expect(index.pages).toHaveLength(0);
    });
  });

  describe('generateAllIndexes', () => {
    it('should generate all category indexes', () => {
      const pages = createMockPages();
      const indexes = generateAllIndexes(pages);

      expect(indexes.categories).toHaveLength(2);
      expect(indexes.categories.map(c => c.title)).toContain('Documentation');
      expect(indexes.categories.map(c => c.title)).toContain('Blog');
    });

    it('should generate all label indexes', () => {
      const pages = createMockPages();
      const indexes = generateAllIndexes(pages);

      expect(indexes.labels).toHaveLength(4);
      expect(indexes.labels.map(l => l.title)).toContain('tutorial');
      expect(indexes.labels.map(l => l.title)).toContain('beginner');
    });

    it('should include unique labels only', () => {
      const pages = createMockPages();
      const indexes = generateAllIndexes(pages);

      const labelTitles = indexes.labels.map(l => l.title);
      const uniqueTitles = [...new Set(labelTitles)];
      expect(labelTitles).toEqual(uniqueTitles);
    });
  });
});
