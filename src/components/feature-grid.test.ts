import { describe, it, expect } from 'bun:test';
import { FeatureGrid } from './feature-grid.js';

describe('FeatureGrid', () => {
  const features = [
    { icon: '⚡', title: 'Fast Builds', description: 'Compiles in 200ms', color: 'blue' as const },
    { icon: '🧩', title: 'Components', description: 'Type-safe UI', color: 'green' as const },
    { icon: '📝', title: 'Markdown', description: 'Content first', color: 'purple' as const },
  ];

  it('should render a section element', () => {
    const html = FeatureGrid.render({ heading: 'Features', features });
    expect(html).toContain('<section');
  });

  it('should render the heading', () => {
    const html = FeatureGrid.render({ heading: 'Features', features });
    expect(html).toContain('<h2');
    expect(html).toContain('Features');
  });

  it('should render the subtitle when provided', () => {
    const html = FeatureGrid.render({ heading: 'Features', subtitle: 'Everything included', features });
    expect(html).toContain('Everything included');
  });

  it('should render all feature cards', () => {
    const html = FeatureGrid.render({ heading: 'Features', features });
    expect(html).toContain('Fast Builds');
    expect(html).toContain('Components');
    expect(html).toContain('Markdown');
  });

  it('should render icons', () => {
    const html = FeatureGrid.render({ heading: 'Features', features });
    expect(html).toContain('⚡');
    expect(html).toContain('🧩');
  });

  it('should render descriptions', () => {
    const html = FeatureGrid.render({ heading: 'Features', features });
    expect(html).toContain('Compiles in 200ms');
    expect(html).toContain('Type-safe UI');
  });

  it('should use a responsive grid', () => {
    const html = FeatureGrid.render({ heading: 'Features', features });
    expect(html).toContain('grid');
    expect(html).toContain('lg:grid-cols-3');
  });

  it('should apply color backgrounds to icon containers', () => {
    const html = FeatureGrid.render({ heading: 'Features', features });
    expect(html).toContain('bg-blue-100');
    expect(html).toContain('bg-green-100');
    expect(html).toContain('bg-purple-100');
  });

  it('should return empty string for empty features', () => {
    const html = FeatureGrid.render({ heading: 'Features', features: [] });
    expect(html).toBe('');
  });

  it('should escape HTML in text fields', () => {
    const html = FeatureGrid.render({
      heading: '<script>xss</script>',
      features: [{ icon: '⚡', title: '<b>bad</b>', description: '<img src=x>', color: 'blue' as const }],
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>bad');
    expect(html).not.toContain('<img src=x>');
    expect(html).toContain('&lt;script&gt;');
  });
});
