import { describe, it, expect } from 'bun:test';
import { extractHtmlBlocks, restoreHtmlBlocks } from './html-blocks.js';

describe('HTML Blocks', () => {
  describe('extractHtmlBlocks', () => {
    it('should extract a single html block', () => {
      const input = `# Title

:::html
<div hx-get="/test">Click</div>
:::

Some text`;

      const { markdown, blocks } = extractHtmlBlocks(input);

      expect(blocks.size).toBe(1);
      expect(markdown).not.toContain('<div');
      expect(markdown).toContain('<!--HTML_BLOCK_0-->');
      expect([...blocks.values()][0]).toBe('<div hx-get="/test">Click</div>');
    });

    it('should extract multiple html blocks', () => {
      const input = `# Title

:::html
<div id="first">First</div>
:::

Middle text

:::html
<div id="second">Second</div>
:::

End text`;

      const { markdown, blocks } = extractHtmlBlocks(input);

      expect(blocks.size).toBe(2);
      expect(markdown).toContain('<!--HTML_BLOCK_0-->');
      expect(markdown).toContain('<!--HTML_BLOCK_1-->');
      expect([...blocks.values()][0]).toBe('<div id="first">First</div>');
      expect([...blocks.values()][1]).toBe('<div id="second">Second</div>');
    });

    it('should preserve multi-line html blocks', () => {
      const input = `:::html
<div class="wrapper">
  <button hx-get="/page" hx-target="#out">
    Load
  </button>
  <div id="out"></div>
</div>
:::`;

      const { blocks } = extractHtmlBlocks(input);
      const html = [...blocks.values()][0];

      expect(html).toContain('<div class="wrapper">');
      expect(html).toContain('hx-get="/page"');
      expect(html).toContain('<div id="out"></div>');
    });

    it('should leave markdown without blocks unchanged', () => {
      const input = '# Hello\n\nSome **bold** text.';
      const { markdown, blocks } = extractHtmlBlocks(input);

      expect(blocks.size).toBe(0);
      expect(markdown).toBe(input);
    });

    it('should not extract regular code fences', () => {
      const input = '```html\n<div>code</div>\n```';
      const { markdown, blocks } = extractHtmlBlocks(input);

      expect(blocks.size).toBe(0);
      expect(markdown).toBe(input);
    });
  });

  describe('restoreHtmlBlocks', () => {
    it('should restore blocks into compiled html', () => {
      const compiledHtml = '<h1>Title</h1>\n<p><!--HTML_BLOCK_0--></p>\n<p>Text</p>';
      const blocks = new Map([['<!--HTML_BLOCK_0-->', '<div hx-get="/test">Click</div>']]);

      const result = restoreHtmlBlocks(compiledHtml, blocks);

      expect(result).toContain('<div hx-get="/test">Click</div>');
      expect(result).not.toContain('HTML_BLOCK');
      expect(result).not.toContain('<p><div');
    });

    it('should restore blocks not wrapped in p tags', () => {
      const compiledHtml = '<h1>Title</h1>\n<!--HTML_BLOCK_0-->\n<p>Text</p>';
      const blocks = new Map([['<!--HTML_BLOCK_0-->', '<div>Content</div>']]);

      const result = restoreHtmlBlocks(compiledHtml, blocks);

      expect(result).toContain('<div>Content</div>');
    });

    it('should restore multiple blocks', () => {
      const compiledHtml = '<p><!--HTML_BLOCK_0--></p>\n<p>Middle</p>\n<p><!--HTML_BLOCK_1--></p>';
      const blocks = new Map([
        ['<!--HTML_BLOCK_0-->', '<div id="a">A</div>'],
        ['<!--HTML_BLOCK_1-->', '<div id="b">B</div>'],
      ]);

      const result = restoreHtmlBlocks(compiledHtml, blocks);

      expect(result).toContain('<div id="a">A</div>');
      expect(result).toContain('<div id="b">B</div>');
    });

    it('should handle no blocks', () => {
      const html = '<h1>Hello</h1>';
      const result = restoreHtmlBlocks(html, new Map());

      expect(result).toBe(html);
    });
  });
});
