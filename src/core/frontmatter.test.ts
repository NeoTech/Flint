import { describe, it, expect } from 'vitest';
import { parseFrontmatter, stringifyFrontmatter, type FrontmatterData } from './frontmatter.js';

describe('Frontmatter Parser', () => {
  describe('parseFrontmatter', () => {
    it('should parse markdown with YAML frontmatter', () => {
      const input = `---
title: Test Page
author: John Doe
date: 2024-01-15
tags:
  - typescript
  - markdown
---

# Content

This is the body.`;

      const result = parseFrontmatter(input);

      expect(result.data.title).toBe('Test Page');
      expect(result.data.author).toBe('John Doe');
      expect(result.data.tags).toEqual(['typescript', 'markdown']);
      // gray-matter parses dates as Date objects
      expect(result.data.date).toBeInstanceOf(Date);
      expect(result.content.trim()).toBe('# Content\n\nThis is the body.');
    });

    it('should handle markdown without frontmatter', () => {
      const input = `# Just Content

No frontmatter here.`;

      const result = parseFrontmatter(input);

      expect(result.data).toEqual({});
      expect(result.content.trim()).toBe('# Just Content\n\nNo frontmatter here.');
    });

    it('should handle empty frontmatter', () => {
      const input = `---
---

Content here.`;

      const result = parseFrontmatter(input);

      expect(result.data).toEqual({});
      expect(result.content.trim()).toBe('Content here.');
    });

    it('should parse complex nested data', () => {
      const input = `---
meta:
  version: 1.0
  draft: true
config:
  layout: default
  options:
    showSidebar: true
    maxItems: 10
---

Content`;

      const result = parseFrontmatter(input);

      expect(result.data.meta).toEqual({ version: 1.0, draft: true });
      expect(result.data.config?.layout).toBe('default');
      expect(result.data.config?.options?.showSidebar).toBe(true);
      expect(result.data.config?.options?.maxItems).toBe(10);
    });

    it('should handle various data types', () => {
      const input = `---
string: hello
number: 42
boolean: true
nullValue: null
array: [1, 2, 3]
---

Content`;

      const result = parseFrontmatter(input);

      expect(result.data.string).toBe('hello');
      expect(result.data.number).toBe(42);
      expect(result.data.boolean).toBe(true);
      expect(result.data.nullValue).toBeNull();
      expect(result.data.array).toEqual([1, 2, 3]);
    });

    it('should throw on invalid YAML', () => {
      const input = `---
invalid: yaml: content: :::
---

Content`;

      expect(() => parseFrontmatter(input)).toThrow();
    });
  });

  describe('stringifyFrontmatter', () => {
    it('should stringify data to YAML frontmatter', () => {
      const data: FrontmatterData = {
        title: 'Test Page',
        author: 'John Doe',
      };
      const content = '# Hello\n\nWorld';

      const result = stringifyFrontmatter(data, content);

      expect(result).toContain('---');
      expect(result).toContain('title: Test Page');
      expect(result).toContain('author: John Doe');
      expect(result).toContain('# Hello');
      expect(result).toContain('World');
    });

    it('should handle empty data', () => {
      const result = stringifyFrontmatter({}, 'Just content');

      expect(result).toBe('Just content');
    });

    it('should preserve content formatting', () => {
      const data = { title: 'Test' };
      const content = `  code block
  indented

New paragraph`;

      const result = stringifyFrontmatter(data, content);

      expect(result).toContain(content);
    });
  });
});
