import { describe, it, expect } from 'vitest';
import { TemplateEngine, type PageData } from './template.js';

describe('TemplateEngine', () => {
  const engine = new TemplateEngine();

  describe('renderPage', () => {
    it('should render a complete page with markdown content', () => {
      const pageData: PageData = {
        title: 'Test Page',
        content: '<h1>Hello World</h1>\n<p>This is <strong>bold</strong> text.</p>',
        path: '/test',
      };

      const html = engine.renderPage(pageData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Test Page</title>');
      expect(html).toContain('<h1>Hello World</h1>');
      expect(html).toContain('<strong>bold</strong>');
    });

    it('should include navigation when provided', () => {
      const pageData: PageData = {
        title: 'Page',
        content: 'Content',
        path: '/page',
        navigation: [
          { label: 'Home', href: '/' },
          { label: 'Page', href: '/page', active: true },
        ],
      };

      const html = engine.renderPage(pageData);

      expect(html).toContain('<nav');
      expect(html).toContain('href="/"');
      expect(html).toContain('aria-current="page"');
    });

    it('should use frontmatter data when available', () => {
      const pageData: PageData = {
        title: 'Page',
        content: 'Content',
        path: '/page',
        frontmatter: {
          description: 'A custom description',
          author: 'Test Author',
        },
      };

      const html = engine.renderPage(pageData);

      expect(html).toContain('A custom description');
    });

    it('should override title with frontmatter title', () => {
      const pageData: PageData = {
        title: 'Default Title',
        content: 'Content',
        path: '/page',
        frontmatter: {
          title: 'Custom Title',
        },
      };

      const html = engine.renderPage(pageData);

      expect(html).toContain('<title>Custom Title</title>');
    });

    it('should render with custom CSS classes', () => {
      const pageData: PageData = {
        title: 'Page',
        content: '# Heading',
        path: '/page',
        layout: 'full-width',
      };

      const html = engine.renderPage(pageData);

      expect(html).toContain('class="');
    });
  });

  describe('renderPartial', () => {
    it('should render markdown without layout', () => {
      const markdown = '# Partial\n\nContent';
      const html = engine.renderPartial(markdown);

      expect(html).toContain('<h1>Partial</h1>');
      expect(html).not.toContain('<!DOCTYPE html>');
    });

    it('should handle empty content', () => {
      const html = engine.renderPartial('');

      expect(html).toBe('');
    });
  });

  describe('processMarkdown', () => {
    it('should process markdown with frontmatter', () => {
      const markdown = `---
title: Processed Page
description: A description
---

# Content

Text here.`;

      const result = engine.processMarkdown(markdown, '/path');

      expect(result.data.title).toBe('Processed Page');
      expect(result.data.description).toBe('A description');
      expect(result.html).toContain('<h1>Content</h1>');
      expect(result.path).toBe('/path');
    });

    it('should handle markdown without frontmatter', () => {
      const markdown = '# Just Content';

      const result = engine.processMarkdown(markdown, '/simple');

      expect(result.data).toEqual({});
      expect(result.html).toContain('<h1>Just Content</h1>');
    });
  });

  describe('registerComponent', () => {
    it('should allow registering custom components', () => {
      const customComponent = (props: { text: string }) => `<span>${props.text}</span>`;
      
      engine.registerComponent('custom', customComponent);
      
      // Component should be available for use
      const result = engine.hasComponent('custom');
      expect(result).toBe(true);
    });

    it('should return false for unregistered components', () => {
      expect(engine.hasComponent('nonexistent')).toBe(false);
    });
  });
});
