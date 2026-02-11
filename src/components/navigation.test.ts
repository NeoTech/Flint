import { describe, it, expect } from 'bun:test';
import { Navigation } from './navigation.js';

describe('Navigation', () => {
  it('should render navigation with items', () => {
    const html = Navigation.render({
      items: [
        { label: 'Home', href: '/' },
        { label: 'About', href: '/about' },
        { label: 'Contact', href: '/contact' },
      ],
    });

    expect(html).toContain('<nav');
    expect(html).toContain('href="/"');
    expect(html).toContain('Home');
    expect(html).toContain('href="/about"');
    expect(html).toContain('About');
  });

  it('should mark current page as active', () => {
    const html = Navigation.render({
      items: [
        { label: 'Home', href: '/' },
        { label: 'About', href: '/about', active: true },
      ],
    });

    expect(html).toContain('aria-current="page"');
    // Should have visual indicator for active state (blue color)
    expect(html).toContain('text-blue-600');
  });

  it('should support HTMX navigation', () => {
    const html = Navigation.render({
      items: [
        { label: 'Home', href: '/', hxBoost: true },
        { label: 'About', href: '/about', hxBoost: true },
      ],
    });

    expect(html).toContain('hx-boost="true"');
  });

  it('should render with custom className', () => {
    const html = Navigation.render({
      items: [{ label: 'Home', href: '/' }],
      className: 'main-nav',
    });

    expect(html).toContain('main-nav');
  });

  it('should render empty navigation', () => {
    const html = Navigation.render({
      items: [],
    });

    expect(html).toContain('<nav');
    expect(html).not.toContain('<a');
  });
});
