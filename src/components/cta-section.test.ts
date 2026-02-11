import { describe, it, expect } from 'bun:test';
import { CtaSection } from './cta-section.js';

describe('CtaSection', () => {
  const heroProps = {
    variant: 'hero' as const,
    heading: 'Build fast sites.',
    subtitle: 'Powered by TypeScript.',
    tagline: 'Static Site Generator',
    primaryCta: { label: 'Get Started', href: '/about' },
    secondaryCta: { label: 'Read Blog', href: '/blog' },
  };

  const bannerProps = {
    variant: 'banner' as const,
    heading: 'Ready to build?',
    subtitle: 'Clone and ship.',
    primaryCta: { label: 'Read Docs', href: '/about' },
    secondaryCta: { label: 'Shop Demo', href: '/shop' },
  };

  // Structure
  it('should render a section element', () => {
    const html = CtaSection.render(heroProps);
    expect(html).toContain('<section');
    expect(html).toContain('</section>');
  });

  it('should use gradient background', () => {
    const html = CtaSection.render(heroProps);
    expect(html).toContain('bg-gradient-to-');
  });

  // Hero variant
  it('should render h1 for hero variant', () => {
    const html = CtaSection.render(heroProps);
    expect(html).toContain('<h1');
    expect(html).toContain('Build fast sites.');
    expect(html).not.toContain('<h2');
  });

  it('should render tagline for hero variant', () => {
    const html = CtaSection.render(heroProps);
    expect(html).toContain('Static Site Generator');
    expect(html).toContain('uppercase');
  });

  it('should render decorative blur circles for hero variant', () => {
    const html = CtaSection.render(heroProps);
    expect(html).toContain('blur-3xl');
  });

  // Banner variant
  it('should render h2 for banner variant', () => {
    const html = CtaSection.render(bannerProps);
    expect(html).toContain('<h2');
    expect(html).toContain('Ready to build?');
    expect(html).not.toContain('<h1');
  });

  it('should not render tagline for banner variant even if provided', () => {
    const html = CtaSection.render({ ...bannerProps, tagline: 'Ignored' });
    expect(html).not.toContain('Ignored');
  });

  it('should not render blur circles for banner variant', () => {
    const html = CtaSection.render(bannerProps);
    expect(html).not.toContain('blur-3xl');
  });

  // CTA buttons
  it('should render primary CTA button', () => {
    const html = CtaSection.render(heroProps);
    expect(html).toContain('Get Started');
    expect(html).toContain('href="/about"');
    expect(html).toContain('bg-white');
  });

  it('should render secondary CTA button', () => {
    const html = CtaSection.render(heroProps);
    expect(html).toContain('Read Blog');
    expect(html).toContain('href="/blog"');
    expect(html).toContain('border-white/30');
  });

  it('should omit secondary CTA when not provided', () => {
    const { secondaryCta: _, ...props } = heroProps;
    const html = CtaSection.render(props);
    expect(html).toContain('Get Started');
    expect(html).not.toContain('border-white/30');
  });

  // Optional fields
  it('should omit subtitle when not provided', () => {
    const { subtitle: _, ...props } = heroProps;
    const html = CtaSection.render(props);
    expect(html).toContain('Build fast sites.');
    expect(html).not.toContain('Powered by TypeScript.');
  });

  it('should omit tagline when not provided in hero', () => {
    const { tagline: _, ...props } = heroProps;
    const html = CtaSection.render(props);
    expect(html).not.toContain('uppercase');
  });

  // Defaults
  it('should default to hero variant when not specified', () => {
    const { variant: _, ...props } = heroProps;
    const html = CtaSection.render(props);
    expect(html).toContain('<h1');
  });

  // XSS
  it('should escape HTML in all text fields', () => {
    const html = CtaSection.render({
      variant: 'hero',
      heading: '<script>alert("xss")</script>',
      subtitle: '<img onerror=alert(1)>',
      tagline: '<b>bold</b>',
      primaryCta: { label: '<em>click</em>', href: '/safe' },
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('<em>');
  });
});
