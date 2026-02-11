import { describe, it, expect } from 'bun:test';
import { ShowcaseGrid } from './showcase-grid.js';

describe('ShowcaseGrid', () => {
  const items = [
    { icon: '🔄', title: 'HTMX Demos', description: 'Live examples', href: '/htmx' },
    { icon: '🛒', title: 'Shop & Cart', description: 'Browse products', href: '/shop' },
    { icon: '📰', title: 'Blog', description: 'Auto-indexed posts', href: '/blog' },
  ];

  it('should render a section element', () => {
    const html = ShowcaseGrid.render({ heading: 'See it', items });
    expect(html).toContain('<section');
  });

  it('should render the heading', () => {
    const html = ShowcaseGrid.render({ heading: 'See it', items });
    expect(html).toContain('<h2');
    expect(html).toContain('See it');
  });

  it('should render the subtitle when provided', () => {
    const html = ShowcaseGrid.render({ heading: 'See it', subtitle: 'Explore below', items });
    expect(html).toContain('Explore below');
  });

  it('should render all items as links', () => {
    const html = ShowcaseGrid.render({ heading: 'See it', items });
    expect(html).toContain('href="/htmx"');
    expect(html).toContain('href="/shop"');
    expect(html).toContain('href="/blog"');
  });

  it('should render item titles', () => {
    const html = ShowcaseGrid.render({ heading: 'See it', items });
    expect(html).toContain('HTMX Demos');
    expect(html).toContain('Shop &amp; Cart');
    expect(html).toContain('Blog');
  });

  it('should render item icons', () => {
    const html = ShowcaseGrid.render({ heading: 'See it', items });
    expect(html).toContain('🔄');
    expect(html).toContain('🛒');
  });

  it('should render item descriptions', () => {
    const html = ShowcaseGrid.render({ heading: 'See it', items });
    expect(html).toContain('Live examples');
    expect(html).toContain('Browse products');
  });

  it('should use a responsive grid', () => {
    const html = ShowcaseGrid.render({ heading: 'See it', items });
    expect(html).toContain('grid');
    expect(html).toContain('lg:grid-cols-3');
  });

  it('should render items as clickable cards with hover effects', () => {
    const html = ShowcaseGrid.render({ heading: 'See it', items });
    expect(html).toContain('hover:shadow-lg');
  });

  it('should return empty string for empty items', () => {
    const html = ShowcaseGrid.render({ heading: 'See it', items: [] });
    expect(html).toBe('');
  });

  it('should escape HTML in text fields', () => {
    const html = ShowcaseGrid.render({
      heading: '<script>xss</script>',
      items: [{ icon: '📖', title: '<b>bad</b>', description: '<img src=x>', href: '/safe' }],
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>bad');
    expect(html).not.toContain('<img src=x>');
    expect(html).toContain('&lt;script&gt;');
  });
});
