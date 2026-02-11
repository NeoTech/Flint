import { describe, it, expect } from 'bun:test';
import { Hero } from './hero.js';

describe('Hero', () => {
  const fullProps = {
    tagline: 'Static Site Generator',
    heading: 'Build fast sites. Ship with confidence.',
    subtitle: 'Flint compiles Markdown into lightning-fast HTML.',
    primaryCta: { label: 'Get Started →', href: '/about' },
    secondaryCta: { label: 'Read the Blog', href: '/blog' },
  };

  it('should render a section element', () => {
    const html = Hero.render(fullProps);
    expect(html).toContain('<section');
    expect(html).toContain('</section>');
  });

  it('should render the tagline', () => {
    const html = Hero.render(fullProps);
    expect(html).toContain('Static Site Generator');
  });

  it('should render the heading', () => {
    const html = Hero.render(fullProps);
    expect(html).toContain('<h1');
    expect(html).toContain('Build fast sites');
  });

  it('should render the subtitle', () => {
    const html = Hero.render(fullProps);
    expect(html).toContain('Flint compiles Markdown');
  });

  it('should render primary CTA button', () => {
    const html = Hero.render(fullProps);
    expect(html).toContain('href="/about"');
    expect(html).toContain('Get Started →');
  });

  it('should render secondary CTA button', () => {
    const html = Hero.render(fullProps);
    expect(html).toContain('href="/blog"');
    expect(html).toContain('Read the Blog');
  });

  it('should use gradient background', () => {
    const html = Hero.render(fullProps);
    expect(html).toContain('bg-gradient-to-br');
  });

  it('should omit secondary CTA when not provided', () => {
    const html = Hero.render({
      heading: 'Hello World',
      primaryCta: { label: 'Go', href: '/' },
    });
    expect(html).toContain('Go');
    expect(html).not.toContain('border-2');
  });

  it('should omit tagline when not provided', () => {
    const html = Hero.render({
      heading: 'Hello',
      primaryCta: { label: 'Go', href: '/' },
    });
    expect(html).toContain('<h1');
    // No tagline paragraph with uppercase tracking
    expect(html).not.toContain('tracking-widest');
  });

  it('should escape HTML in all text fields', () => {
    const html = Hero.render({
      tagline: '<script>bad</script>',
      heading: '<img onerror=alert(1)>',
      subtitle: '<b>bold</b>',
      primaryCta: { label: '<em>click</em>', href: '/safe' },
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img onerror');
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('<em>');
    expect(html).toContain('&lt;script&gt;');
  });
});
