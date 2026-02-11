import { describe, it, expect } from 'bun:test';
import { StatsBar } from './stats-bar.js';

describe('StatsBar', () => {
  const stats = [
    { value: '< 200ms', label: 'Build time', color: 'blue' as const },
    { value: '410+', label: 'Tests passing', color: 'green' as const },
    { value: '0', label: 'Client frameworks', color: 'purple' as const },
    { value: '100', label: 'Lighthouse score', color: 'orange' as const },
  ];

  it('should render a section element', () => {
    const html = StatsBar.render({ stats });
    expect(html).toContain('<section');
  });

  it('should use a dark background', () => {
    const html = StatsBar.render({ stats });
    expect(html).toContain('bg-gray-900');
  });

  it('should render all stat values', () => {
    const html = StatsBar.render({ stats });
    expect(html).toContain('&lt; 200ms');
    expect(html).toContain('410+');
    expect(html).toContain('0');
    expect(html).toContain('100');
  });

  it('should render all stat labels', () => {
    const html = StatsBar.render({ stats });
    expect(html).toContain('Build time');
    expect(html).toContain('Tests passing');
    expect(html).toContain('Client frameworks');
    expect(html).toContain('Lighthouse score');
  });

  it('should apply color classes to values', () => {
    const html = StatsBar.render({ stats });
    expect(html).toContain('text-blue-400');
    expect(html).toContain('text-green-400');
    expect(html).toContain('text-purple-400');
    expect(html).toContain('text-orange-400');
  });

  it('should use a responsive grid', () => {
    const html = StatsBar.render({ stats });
    expect(html).toContain('grid');
    expect(html).toContain('sm:grid-cols-4');
  });

  it('should return empty string for empty stats', () => {
    const html = StatsBar.render({ stats: [] });
    expect(html).toBe('');
  });

  it('should escape HTML in values and labels', () => {
    const html = StatsBar.render({
      stats: [{ value: '<script>xss</script>', label: '<b>bad</b>', color: 'blue' as const }],
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>bad');
    expect(html).toContain('&lt;script&gt;');
  });
});
