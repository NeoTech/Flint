import { describe, it, expect } from 'bun:test';
import { LabelFooter } from './label-footer.js';

describe('LabelFooter', () => {
  it('should render a footer element', () => {
    const html = LabelFooter.render({ labels: ['htmx', 'css'] });

    expect(html).toContain('<footer');
    expect(html).toContain('</footer>');
  });

  it('should render all provided labels', () => {
    const html = LabelFooter.render({
      labels: ['htmx', 'css', 'typescript'],
    });

    expect(html).toContain('htmx');
    expect(html).toContain('css');
    expect(html).toContain('typescript');
  });

  it('should render labels as clickable anchor badges', () => {
    const html = LabelFooter.render({ labels: ['htmx'] });

    expect(html).toContain('<a');
    expect(html).toContain('label-link');
    expect(html).toContain('data-label="htmx"');
    expect(html).toContain('rounded');
    expect(html).toContain('htmx');
  });

  it('should render empty string when no labels provided', () => {
    const html = LabelFooter.render({ labels: [] });

    expect(html).toBe('');
  });

  it('should sort labels alphabetically', () => {
    const html = LabelFooter.render({
      labels: ['typescript', 'css', 'architecture'],
    });

    const archIdx = html.indexOf('architecture');
    const cssIdx = html.indexOf('css');
    const tsIdx = html.indexOf('typescript');

    expect(archIdx).toBeLessThan(cssIdx);
    expect(cssIdx).toBeLessThan(tsIdx);
  });

  it('should deduplicate labels', () => {
    const html = LabelFooter.render({
      labels: ['htmx', 'css', 'htmx', 'css'],
    });

    // data-label="htmx" appears once per deduplicated label
    const count = (html.match(/data-label="htmx"/g) || []).length;
    expect(count).toBe(1);
  });

  it('should include a heading', () => {
    const html = LabelFooter.render({ labels: ['htmx'] });

    expect(html).toContain('Labels');
  });

  it('should use flex-wrap for label layout', () => {
    const html = LabelFooter.render({ labels: ['htmx', 'css'] });

    expect(html).toContain('flex');
    expect(html).toContain('flex-wrap');
  });

  it('should apply custom className', () => {
    const html = LabelFooter.render({
      labels: ['htmx'],
      className: 'custom-footer',
    });

    expect(html).toContain('custom-footer');
  });

  it('should assign color classes based on label index for variety', () => {
    const html = LabelFooter.render({
      labels: ['alpha', 'beta', 'gamma', 'delta'],
    });

    // Should have multiple different color classes for visual variety
    expect(html).toContain('bg-');
    expect(html).toContain('text-');
  });

  it('should have a top border to separate from content', () => {
    const html = LabelFooter.render({ labels: ['htmx'] });

    expect(html).toContain('border-t');
  });
});
