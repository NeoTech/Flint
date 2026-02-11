import { describe, it, expect } from 'bun:test';
import { LabelIndex, type LabelIndexProps } from './label-index.js';

describe('LabelIndex', () => {
  const baseProps: LabelIndexProps = {
    label: 'htmx',
    pages: [
      {
        url: '/blog/getting-started-with-htmx',
        title: 'Getting Started with HTMX',
        description: 'Learn HTMX basics',
        category: 'Tutorials',
        date: '2026-02-01',
      },
      {
        url: '/htmx',
        title: 'HTMX Demo',
        description: 'Interactive HTMX examples',
        category: 'Documentation',
        date: '2026-01-10',
      },
    ],
  };

  it('should render a heading with the label name', () => {
    const html = LabelIndex.render(baseProps);
    expect(html).toContain('htmx');
    expect(html).toContain('<h1');
  });

  it('should render a card for each page', () => {
    const html = LabelIndex.render(baseProps);
    expect(html).toContain('Getting Started with HTMX');
    expect(html).toContain('HTMX Demo');
  });

  it('should include links to each page', () => {
    const html = LabelIndex.render(baseProps);
    expect(html).toContain('href="/blog/getting-started-with-htmx"');
    expect(html).toContain('href="/htmx"');
  });

  it('should include page descriptions', () => {
    const html = LabelIndex.render(baseProps);
    expect(html).toContain('Learn HTMX basics');
    expect(html).toContain('Interactive HTMX examples');
  });

  it('should include page categories', () => {
    const html = LabelIndex.render(baseProps);
    expect(html).toContain('Tutorials');
    expect(html).toContain('Documentation');
  });

  it('should include page dates', () => {
    const html = LabelIndex.render(baseProps);
    expect(html).toContain('2026-02-01');
    expect(html).toContain('2026-01-10');
  });

  it('should show page count in description', () => {
    const html = LabelIndex.render(baseProps);
    expect(html).toContain('2');
    expect(html).toMatch(/2\s*page/i);
  });

  it('should render empty message when no pages', () => {
    const html = LabelIndex.render({ label: 'unknown', pages: [] });
    expect(html).toContain('No pages');
  });

  it('should handle single page', () => {
    const html = LabelIndex.render({
      label: 'css',
      pages: [baseProps.pages[0]],
    });
    expect(html).toContain('Getting Started with HTMX');
    expect(html).toMatch(/1\s*page/i);
  });

  it('should handle pages with no date', () => {
    const html = LabelIndex.render({
      label: 'test',
      pages: [{ url: '/test', title: 'Test', description: 'Desc', category: '', date: null }],
    });
    expect(html).toContain('Test');
    expect(html).not.toContain('null');
  });
});
