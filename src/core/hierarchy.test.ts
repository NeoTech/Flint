import { describe, it, expect, beforeEach } from 'bun:test';
import { 
  buildPageHierarchy, 
  generateBreadcrumbs,
  findPageByShortUri,
  getChildren,
  type PageNode 
} from './hierarchy.js';

describe('PageHierarchy', () => {
  const createMockPages = (): PageNode[] => [
    { shortUri: 'root', title: 'Home', parent: null as unknown as string, type: 'page', category: '', labels: [], author: '', date: null, description: '', keywords: [] },
    { shortUri: 'docs', title: 'Documentation', parent: 'root', type: 'section', category: '', labels: [], author: '', date: null, description: '', keywords: [] },
    { shortUri: 'getting-started', title: 'Getting Started', parent: 'docs', type: 'page', category: '', labels: [], author: '', date: null, description: '', keywords: [] },
    { shortUri: 'advanced', title: 'Advanced Topics', parent: 'docs', type: 'page', category: '', labels: [], author: '', date: null, description: '', keywords: [] },
    { shortUri: 'blog', title: 'Blog', parent: 'root', type: 'section', category: '', labels: [], author: '', date: null, description: '', keywords: [] },
    { shortUri: 'first-post', title: 'First Post', parent: 'blog', type: 'post', category: '', labels: [], author: '', date: null, description: '', keywords: [] },
  ];

  describe('buildPageHierarchy', () => {
    it('should build tree from flat pages', () => {
      const pages = createMockPages();
      const tree = buildPageHierarchy(pages);

      expect(tree.shortUri).toBe('root');
      expect(tree.children).toHaveLength(2);
      expect(tree.children?.map(c => c.shortUri)).toContain('docs');
      expect(tree.children?.map(c => c.shortUri)).toContain('blog');
    });

    it('should nest children correctly', () => {
      const pages = createMockPages();
      const tree = buildPageHierarchy(pages);

      const docsNode = tree.children?.find(c => c.shortUri === 'docs');
      expect(docsNode?.children).toHaveLength(2);
      expect(docsNode?.children?.map(c => c.shortUri)).toContain('getting-started');
      expect(docsNode?.children?.map(c => c.shortUri)).toContain('advanced');
    });

    it('should detect circular references', () => {
      const pages: PageNode[] = [
        { shortUri: 'root', title: 'Root', parent: null, type: 'page', category: '', labels: [], author: '', date: null, description: '', keywords: [] },
        { shortUri: 'a', title: 'A', parent: 'root', type: 'page', category: '', labels: [], author: '', date: null, description: '', keywords: [] },
        { shortUri: 'b', title: 'B', parent: 'a', type: 'page', category: '', labels: [], author: '', date: null, description: '', keywords: [] },
        // Create a cycle by having 'a' appear as both parent of 'b' AND child of 'b'
        { shortUri: 'a', title: 'A Again', parent: 'b', type: 'page', category: '', labels: [], author: '', date: null, description: '', keywords: [] },
      ];

      expect(() => buildPageHierarchy(pages)).toThrow('Circular reference detected');
    });

    it('should detect orphaned pages', () => {
      const pages: PageNode[] = [
        { shortUri: 'root', title: 'Home', parent: null, type: 'page' },
        { shortUri: 'orphan', title: 'Orphan', parent: 'non-existent', type: 'page' },
      ];

      expect(() => buildPageHierarchy(pages)).toThrow('Orphaned pages detected');
    });

    it('should handle empty pages', () => {
      const tree = buildPageHierarchy([]);
      expect(tree).toBeNull();
    });

    it('should require root node', () => {
      const pages: PageNode[] = [
        { shortUri: 'page1', title: 'Page 1', parent: null, type: 'page' },
        { shortUri: 'page2', title: 'Page 2', parent: null, type: 'page' },
      ];

      expect(() => buildPageHierarchy(pages)).toThrow('Multiple root pages detected');
    });
  });

  describe('generateBreadcrumbs', () => {
    it('should generate path from root to page', () => {
      const pages = createMockPages();
      const tree = buildPageHierarchy(pages);

      const breadcrumbs = generateBreadcrumbs(tree, 'getting-started');
      expect(breadcrumbs).toEqual([
        { shortUri: 'root', title: 'Home' },
        { shortUri: 'docs', title: 'Documentation' },
        { shortUri: 'getting-started', title: 'Getting Started' },
      ]);
    });

    it('should return empty for root', () => {
      const pages = createMockPages();
      const tree = buildPageHierarchy(pages);

      const breadcrumbs = generateBreadcrumbs(tree, 'root');
      expect(breadcrumbs).toEqual([{ shortUri: 'root', title: 'Home' }]);
    });

    it('should throw for non-existent page', () => {
      const pages = createMockPages();
      const tree = buildPageHierarchy(pages);

      expect(() => generateBreadcrumbs(tree, 'non-existent')).toThrow('Page not found');
    });
  });

  describe('findPageByShortUri', () => {
    it('should find page in tree', () => {
      const pages = createMockPages();
      const tree = buildPageHierarchy(pages);

      const page = findPageByShortUri(tree, 'advanced');
      expect(page?.title).toBe('Advanced Topics');
    });

    it('should return null for non-existent', () => {
      const pages = createMockPages();
      const tree = buildPageHierarchy(pages);

      const page = findPageByShortUri(tree, 'non-existent');
      expect(page).toBeNull();
    });
  });

  describe('getChildren', () => {
    it('should return direct children', () => {
      const pages = createMockPages();
      const tree = buildPageHierarchy(pages);

      const children = getChildren(tree, 'docs');
      expect(children).toHaveLength(2);
      expect(children.map(c => c.shortUri)).toContain('getting-started');
    });

    it('should return empty for leaf node', () => {
      const pages = createMockPages();
      const tree = buildPageHierarchy(pages);

      const children = getChildren(tree, 'first-post');
      expect(children).toEqual([]);
    });
  });
});
