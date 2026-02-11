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

describe('Navigation responsive', () => {
  it('should render a hamburger toggle button', () => {
    const html = Navigation.render({
      items: [{ label: 'Home', href: '/' }],
    });

    expect(html).toContain('id="flint-nav-toggle"');
    expect(html).toContain('aria-label="Toggle navigation"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="flint-nav-menu"');
  });

  it('should hide the hamburger button on md+ screens', () => {
    const html = Navigation.render({
      items: [{ label: 'Home', href: '/' }],
    });

    // The toggle button should have md:hidden
    const toggleMatch = html.match(/<button[^>]*id="flint-nav-toggle"[^>]*>/);
    expect(toggleMatch).not.toBeNull();
    expect(toggleMatch![0]).toContain('md:hidden');
  });

  it('should render desktop links visible only on md+ screens', () => {
    const html = Navigation.render({
      items: [
        { label: 'Home', href: '/' },
        { label: 'About', href: '/about' },
      ],
    });

    // Desktop link container should be hidden on mobile, flex on md+
    expect(html).toContain('hidden md:flex');
  });

  it('should render a mobile menu panel hidden by default', () => {
    const html = Navigation.render({
      items: [
        { label: 'Home', href: '/' },
        { label: 'About', href: '/about' },
      ],
    });

    expect(html).toContain('id="flint-nav-menu"');
    // The mobile menu should be hidden by default
    const menuMatch = html.match(/<div[^>]*id="flint-nav-menu"[^>]*>/);
    expect(menuMatch).not.toBeNull();
    expect(menuMatch![0]).toContain('hidden');
  });

  it('should render links in both desktop and mobile containers', () => {
    const html = Navigation.render({
      items: [
        { label: 'Home', href: '/' },
        { label: 'Blog', href: '/blog' },
      ],
    });

    // Each link label should appear twice — once in desktop, once in mobile
    const homeMatches = html.match(/Home/g);
    expect(homeMatches).not.toBeNull();
    expect(homeMatches!.length).toBe(2);
  });

  it('should mark active items in the mobile menu too', () => {
    const html = Navigation.render({
      items: [
        { label: 'Home', href: '/' },
        { label: 'About', href: '/about', active: true },
      ],
    });

    // aria-current should appear twice (desktop + mobile)
    const ariaMatches = html.match(/aria-current="page"/g);
    expect(ariaMatches).not.toBeNull();
    expect(ariaMatches!.length).toBe(2);
  });

  it('should render a hamburger icon with three bars', () => {
    const html = Navigation.render({
      items: [{ label: 'Home', href: '/' }],
    });

    // SVG hamburger icon
    expect(html).toContain('<svg');
    expect(html).toContain('viewBox');
  });

  it('should render mobile links as full-width blocks', () => {
    const html = Navigation.render({
      items: [{ label: 'Home', href: '/' }],
    });

    // Mobile links should use block display for full-width tappability
    const mobileMenu = html.split('id="flint-nav-menu"')[1];
    expect(mobileMenu).toContain('block');
  });
});
