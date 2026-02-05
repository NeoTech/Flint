import { describe, it, expect } from 'vitest';
import { 
  parseHtmxAttributes, 
  renderHtmxElement,
  processHtmxMarkdown,
  type HtmxAttributes 
} from './htmx-markdown.js';

describe('HTMX Markdown Parser', () => {
  describe('parseHtmxAttributes', () => {
    it('should parse hx-get attribute', () => {
      const input = '{hx-get=/api/data}';
      const result = parseHtmxAttributes(input);
      expect(result['hx-get']).toBe('/api/data');
    });

    it('should parse multiple attributes', () => {
      const input = '{hx-get=/api/data hx-target=#result hx-swap=innerHTML}';
      const result = parseHtmxAttributes(input);
      expect(result['hx-get']).toBe('/api/data');
      expect(result['hx-target']).toBe('#result');
      expect(result['hx-swap']).toBe('innerHTML');
    });

    it('should parse hx-trigger with modifiers', () => {
      const input = '{hx-post=/submit hx-trigger="click delay:500ms"}';
      const result = parseHtmxAttributes(input);
      expect(result['hx-post']).toBe('/submit');
      expect(result['hx-trigger']).toBe('click delay:500ms');
    });

    it('should handle quoted values', () => {
      const input = '{hx-get="/api/data" hx-target="#result"}';
      const result = parseHtmxAttributes(input);
      expect(result['hx-get']).toBe('/api/data');
      expect(result['hx-target']).toBe('#result');
    });

    it('should return empty for no attributes', () => {
      const input = '';
      const result = parseHtmxAttributes(input);
      expect(result).toEqual({});
    });

    it('should handle boolean attributes', () => {
      const input = '{hx-boost=true}';
      const result = parseHtmxAttributes(input);
      expect(result['hx-boost']).toBe('true');
    });
  });

  describe('renderHtmxElement', () => {
    it('should render button with hx-get', () => {
      const attrs: HtmxAttributes = { 'hx-get': '/api/data' };
      const result = renderHtmxElement('button', attrs, 'Click me');
      expect(result).toBe('<button hx-get="/api/data">Click me</button>');
    });

    it('should render link with hx-boost', () => {
      const attrs: HtmxAttributes = { 'hx-boost': 'true' };
      const result = renderHtmxElement('a', attrs, 'Navigate');
      expect(result).toBe('<a hx-boost="true">Navigate</a>');
    });

    it('should render form with hx-post', () => {
      const attrs: HtmxAttributes = { 
        'hx-post': '/submit',
        'hx-target': '#result',
        'hx-swap': 'outerHTML'
      };
      const result = renderHtmxElement('form', attrs, '');
      expect(result).toBe('<form hx-post="/submit" hx-target="#result" hx-swap="outerHTML"></form>');
    });

    it('should render div with hx-trigger', () => {
      const attrs: HtmxAttributes = { 
        'hx-get': '/poll',
        'hx-trigger': 'every 5s'
      };
      const result = renderHtmxElement('div', attrs, 'Content');
      expect(result).toBe('<div hx-get="/poll" hx-trigger="every 5s">Content</div>');
    });
  });

  describe('processHtmxMarkdown', () => {
    it('should process link with HTMX attributes', () => {
      const input = '[Load Data](/api/data){hx-get=/api/data hx-target=#result}';
      const result = processHtmxMarkdown(input);
      expect(result).toBe('<a href="/api/data" hx-get="/api/data" hx-target="#result">Load Data</a>');
    });

    it('should process button with HTMX attributes', () => {
      const input = '[Click Me](#){hx-post=/click hx-swap=outerHTML}';
      const result = processHtmxMarkdown(input);
      expect(result).toBe('<button hx-post="/click" hx-swap="outerHTML">Click Me</button>');
    });

    it('should leave regular markdown unchanged', () => {
      const input = '[Regular Link](/page)';
      const result = processHtmxMarkdown(input);
      // Regular links without {attrs} are left as markdown for marked to handle
      expect(result).toBe('[Regular Link](/page)');
    });

    it('should process multiple HTMX elements', () => {
      const input = `
[Load](/api){hx-get=/api}
[Submit](#){hx-post=/submit}
      `.trim();
      const result = processHtmxMarkdown(input);
      expect(result).toContain('hx-get="/api"');
      expect(result).toContain('hx-post="/submit"');
    });

    it('should handle hx-boost for navigation', () => {
      const input = '[Home](/){hx-boost=true}';
      const result = processHtmxMarkdown(input);
      expect(result).toBe('<a href="/" hx-boost="true">Home</a>');
    });

    it('should handle hx-confirm', () => {
      const input = '[Delete](/delete){hx-delete=/delete hx-confirm="Are you sure?"}';
      const result = processHtmxMarkdown(input);
      expect(result).toContain('hx-delete="/delete"');
      expect(result).toContain('hx-confirm="Are you sure?"');
    });
  });
});
