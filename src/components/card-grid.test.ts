import { describe, it, expect } from 'bun:test';
import { CardGrid } from './card-grid.js';

describe('CardGrid', () => {
  const featureProps = {
    heading: 'Everything you need.',
    subtitle: 'A complete toolkit.',
    items: [
      { icon: '⚡', title: 'Fast Builds', description: 'Under 200ms.', color: 'blue' as const },
      { icon: '🧩', title: 'Components', description: 'Type-safe UI.', color: 'green' as const },
      { icon: '📝', title: 'Markdown', description: 'Write in MD.', color: 'purple' as const },
    ],
  };

  const showcaseProps = {
    heading: 'See it in action',
    subtitle: 'Explore what Flint can do.',
    items: [
      { icon: '🔄', title: 'HTMX Demos', description: 'Click-to-load.', href: '/htmx' },
      { icon: '🛒', title: 'Shop & Cart', description: 'Browse products.', href: '/shop' },
      { icon: '📰', title: 'Blog', description: 'Auto-indexed posts.', href: '/blog' },
    ],
  };

  // Structure
  it('should render a section element', () => {
    const html = CardGrid.render(featureProps);
    expect(html).toContain('<section');
    expect(html).toContain('</section>');
  });

  it('should render the heading', () => {
    const html = CardGrid.render(featureProps);
    expect(html).toContain('Everything you need.');
  });

  it('should render the subtitle when provided', () => {
    const html = CardGrid.render(featureProps);
    expect(html).toContain('A complete toolkit.');
  });

  it('should omit subtitle when not provided', () => {
    const { subtitle: _, ...props } = featureProps;
    const html = CardGrid.render(props);
    expect(html).not.toContain('A complete toolkit.');
  });

  // Cards without links (feature-style)
  it('should render all cards', () => {
    const html = CardGrid.render(featureProps);
    expect(html).toContain('Fast Builds');
    expect(html).toContain('Components');
    expect(html).toContain('Markdown');
  });

  it('should render icons', () => {
    const html = CardGrid.render(featureProps);
    expect(html).toContain('⚡');
    expect(html).toContain('🧩');
    expect(html).toContain('📝');
  });

  it('should render descriptions', () => {
    const html = CardGrid.render(featureProps);
    expect(html).toContain('Under 200ms.');
    expect(html).toContain('Type-safe UI.');
  });

  it('should render items without href as div cards', () => {
    const html = CardGrid.render(featureProps);
    // No <a> tags for feature-style cards
    expect(html).not.toContain('<a href=');
    expect(html).toContain('<div class=');
  });

  it('should apply color backgrounds to icon containers when color is set', () => {
    const html = CardGrid.render(featureProps);
    expect(html).toContain('bg-blue-100');
    expect(html).toContain('bg-green-100');
    expect(html).toContain('bg-purple-100');
  });

  // Cards with links (showcase-style)
  it('should render items with href as anchor cards', () => {
    const html = CardGrid.render(showcaseProps);
    expect(html).toContain('<a href="/htmx"');
    expect(html).toContain('<a href="/shop"');
    expect(html).toContain('<a href="/blog"');
  });

  it('should render hover effects on linked cards', () => {
    const html = CardGrid.render(showcaseProps);
    expect(html).toContain('hover:shadow-lg');
    expect(html).toContain('hover:border-blue-300');
  });

  it('should render item titles inside linked cards', () => {
    const html = CardGrid.render(showcaseProps);
    expect(html).toContain('HTMX Demos');
    expect(html).toContain('Shop &amp; Cart');
  });

  it('should not render colored icon bg when no color is set', () => {
    const html = CardGrid.render(showcaseProps);
    expect(html).not.toContain('bg-blue-100');
    expect(html).not.toContain('bg-green-100');
  });

  // Mixed cards
  it('should handle items with both href and color', () => {
    const mixedProps = {
      heading: 'Mixed',
      items: [
        { icon: '⚡', title: 'Linked Feature', description: 'Has both.', href: '/test', color: 'blue' as const },
      ],
    };
    const html = CardGrid.render(mixedProps);
    expect(html).toContain('<a href="/test"');
    expect(html).toContain('bg-blue-100');
  });

  // Responsive grid
  it('should use a responsive grid', () => {
    const html = CardGrid.render(featureProps);
    expect(html).toContain('grid');
    expect(html).toContain('grid-cols-1');
    expect(html).toContain('sm:grid-cols-2');
    expect(html).toContain('lg:grid-cols-3');
  });

  // Empty
  it('should return empty string for empty items', () => {
    const html = CardGrid.render({ heading: 'Empty', items: [] });
    expect(html).toBe('');
  });

  // XSS
  it('should escape HTML in text fields', () => {
    const html = CardGrid.render({
      heading: '<script>alert(1)</script>',
      subtitle: '<img onerror=alert(1)>',
      items: [{
        icon: '⚡',
        title: '<b>bold</b>',
        description: '<em>italic</em>',
      }],
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('<em>');
  });
});
