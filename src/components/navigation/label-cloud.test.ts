import { describe, it, expect } from 'vitest';
import { LabelCloud } from './label-cloud.js';

describe('LabelCloud', () => {
  const createMockPages = () => [
    { shortUri: 'page1', title: 'Page 1', labels: ['tutorial', 'beginner'], type: 'page' as const },
    { shortUri: 'page2', title: 'Page 2', labels: ['tutorial', 'advanced'], type: 'page' as const },
    { shortUri: 'page3', title: 'Page 3', labels: ['guide', 'beginner'], type: 'page' as const },
    { shortUri: 'page4', title: 'Page 4', labels: ['tutorial'], type: 'page' as const },
  ];

  it('should render all unique labels', () => {
    const pages = createMockPages();
    const html = LabelCloud.render({ pages, selectedLabels: [] });

    expect(html).toContain('tutorial');
    expect(html).toContain('beginner');
    expect(html).toContain('advanced');
    expect(html).toContain('guide');
  });

  it('should show count per label', () => {
    const pages = createMockPages();
    const html = LabelCloud.render({ pages, selectedLabels: [] });

    expect(html).toContain('tutorial');
    expect(html).toContain('3');
    expect(html).toContain('beginner');
    expect(html).toContain('2');
  });

  it('should mark selected labels', () => {
    const pages = createMockPages();
    const html = LabelCloud.render({ pages, selectedLabels: ['tutorial'] });

    expect(html).toContain('bg-blue-600');
    expect(html).toContain('text-white');
  });

  it('should support multi-select', () => {
    const pages = createMockPages();
    const html = LabelCloud.render({ pages, selectedLabels: ['tutorial', 'beginner'] });

    const selectedCount = (html.match(/bg-blue-600/g) || []).length;
    expect(selectedCount).toBe(2);
  });

  it('should use HTMX for filtering', () => {
    const pages = createMockPages();
    const html = LabelCloud.render({ pages, selectedLabels: [], useHtmx: true });

    expect(html).toContain('hx-boost');
    expect(html).toContain('hx-target');
  });

  it('should link to label index pages', () => {
    const pages = createMockPages();
    const html = LabelCloud.render({ pages, selectedLabels: [] });

    expect(html).toContain('href="/label/tutorial"');
    expect(html).toContain('href="/label/beginner"');
  });

  it('should handle empty pages', () => {
    const html = LabelCloud.render({ pages: [], selectedLabels: [] });
    expect(html).toBe('');
  });

  it('should vary size based on count', () => {
    const pages = createMockPages();
    const html = LabelCloud.render({ pages, selectedLabels: [] });

    expect(html).toContain('text-sm');
    expect(html).toContain('text-lg');
  });
});
