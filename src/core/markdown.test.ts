import { describe, it, expect } from 'vitest';
import { MarkdownCompiler } from './markdown.js';

describe('MarkdownCompiler', () => {
  const compiler = new MarkdownCompiler();

  describe('compile', () => {
    it('should compile basic markdown to HTML', () => {
      const input = '# Hello World\n\nThis is a paragraph.';
      const result = compiler.compile(input);

      expect(result).toContain('<h1>Hello World</h1>');
      expect(result).toContain('<p>This is a paragraph.</p>');
    });

    it('should compile lists', () => {
      const input = `- Item 1
- Item 2
- Item 3`;
      const result = compiler.compile(input);

      expect(result).toContain('<ul>');
      expect(result).toContain('<li>Item 1</li>');
      expect(result).toContain('<li>Item 2</li>');
      expect(result).toContain('<li>Item 3</li>');
      expect(result).toContain('</ul>');
    });

    it('should compile code blocks with language class', () => {
      const input = '```typescript\nconst x = 1;\n```';
      const result = compiler.compile(input);

      expect(result).toContain('<pre><code class="language-typescript">');
      expect(result).toContain('const x = 1;');
    });

    it('should compile inline code', () => {
      const input = 'Use the `console.log()` function.';
      const result = compiler.compile(input);

      expect(result).toContain('<code>console.log()</code>');
    });

    it('should compile links', () => {
      const input = '[Link text](https://example.com)';
      const result = compiler.compile(input);

      expect(result).toContain('<a href="https://example.com">Link text</a>');
    });

    it('should compile images', () => {
      const input = '![Alt text](image.png)';
      const result = compiler.compile(input);

      expect(result).toContain('<img src="image.png" alt="Alt text">');
    });

    it('should compile blockquotes', () => {
      const input = '> This is a quote\n> spanning lines';
      const result = compiler.compile(input);

      expect(result).toContain('<blockquote>');
      expect(result).toContain('This is a quote');
      expect(result).toContain('spanning lines');
    });

    it('should compile tables', () => {
      const input = `| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |`;
      const result = compiler.compile(input);

      expect(result).toContain('<table>');
      expect(result).toContain('<th>Header 1</th>');
      expect(result).toContain('<td>Cell 1</td>');
    });

    it('should compile emphasis and strong', () => {
      const input = '*italic* and **bold** text';
      const result = compiler.compile(input);

      expect(result).toContain('<em>italic</em>');
      expect(result).toContain('<strong>bold</strong>');
    });

    it('should handle horizontal rules', () => {
      const input = '---';
      const result = compiler.compile(input);

      expect(result).toContain('<hr>');
    });

    it('should handle line breaks', () => {
      const input = 'Line 1  \nLine 2';
      const result = compiler.compile(input);

      expect(result).toContain('<br>');
    });
  });

  describe('compileWithFrontmatter', () => {
    it('should compile markdown with frontmatter', () => {
      const input = `---
title: Test Page
---

# Hello`;

      const result = compiler.compileWithFrontmatter(input);

      expect(result.html).toContain('<h1>Hello</h1>');
      expect(result.data.title).toBe('Test Page');
    });

    it('should return empty data for content without frontmatter', () => {
      const input = '# Hello';

      const result = compiler.compileWithFrontmatter(input);

      expect(result.html).toContain('<h1>Hello</h1>');
      expect(result.data).toEqual({});
    });
  });

  describe('HTML handling', () => {
    it('should allow HTML by default', () => {
      const input = '<div class="custom">Content</div>';
      const result = compiler.compile(input);

      expect(result).toContain('<div class="custom">');
    });

    it('should escape HTML when allowHtml is false', () => {
      const compilerNoHtml = new MarkdownCompiler({ allowHtml: false });
      const input = '<script>alert("xss")</script>';
      const result = compilerNoHtml.compile(input);

      expect(result).toContain('&lt;script&gt;');
    });

    it('should allow HTML when configured', () => {
      const compilerWithHtml = new MarkdownCompiler({ allowHtml: true });
      const input = '<div class="custom">Content</div>';
      const result = compilerWithHtml.compile(input);

      expect(result).toContain('<div class="custom">');
    });
  });
});
