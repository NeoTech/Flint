import { describe, it, expect } from 'bun:test';
import { CallToAction } from './call-to-action.js';

describe('CallToAction', () => {
  const fullProps = {
    heading: 'Ready to build something fast?',
    subtitle: 'Clone the repo and ship in minutes.',
    primaryCta: { label: 'Read the Docs', href: '/about' },
    secondaryCta: { label: 'Explore the Shop', href: '/shop' },
  };

  it('should render a section element', () => {
    const html = CallToAction.render(fullProps);
    expect(html).toContain('<section');
  });

  it('should use a gradient background', () => {
    const html = CallToAction.render(fullProps);
    expect(html).toContain('bg-gradient-to-r');
  });

  it('should render the heading', () => {
    const html = CallToAction.render(fullProps);
    expect(html).toContain('<h2');
    expect(html).toContain('Ready to build something fast?');
  });

  it('should render the subtitle', () => {
    const html = CallToAction.render(fullProps);
    expect(html).toContain('Clone the repo');
  });

  it('should render primary CTA button', () => {
    const html = CallToAction.render(fullProps);
    expect(html).toContain('href="/about"');
    expect(html).toContain('Read the Docs');
  });

  it('should render secondary CTA button', () => {
    const html = CallToAction.render(fullProps);
    expect(html).toContain('href="/shop"');
    expect(html).toContain('Explore the Shop');
  });

  it('should omit secondary CTA when not provided', () => {
    const html = CallToAction.render({
      heading: 'Go',
      primaryCta: { label: 'Click', href: '/' },
    });
    expect(html).toContain('Click');
    expect(html).not.toContain('border-2');
  });

  it('should omit subtitle when not provided', () => {
    const html = CallToAction.render({
      heading: 'Go',
      primaryCta: { label: 'Click', href: '/' },
    });
    expect(html).not.toContain('<p');
  });

  it('should escape HTML in all text fields', () => {
    const html = CallToAction.render({
      heading: '<script>xss</script>',
      subtitle: '<b>bold</b>',
      primaryCta: { label: '<em>click</em>', href: '/safe' },
    });
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('<em>');
    expect(html).toContain('&lt;script&gt;');
  });
});
