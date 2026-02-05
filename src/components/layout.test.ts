import { describe, it, expect } from 'vitest';
import { Layout } from './layout.js';

describe('Layout', () => {
  it('should render basic page structure', () => {
    const html = Layout.render({
      title: 'Test Page',
      children: '<main>Content</main>',
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('<head>');
    expect(html).toContain('<title>Test Page</title>');
    expect(html).toContain('<body');
    expect(html).toContain('<main>Content</main>');
  });

  it('should include bundled JS', () => {
    const html = Layout.render({
      title: 'Test',
      children: '',
    });

    expect(html).toContain('/assets/main.js');
    expect(html).toContain('<script');
  });

  it('should include bundled CSS', () => {
    const html = Layout.render({
      title: 'Test',
      children: '',
    });

    expect(html).toContain('/assets/main.css');
    expect(html).toContain('<link');
  });

  it('should render with custom meta description', () => {
    const html = Layout.render({
      title: 'Test',
      description: 'A test page',
      children: '',
    });

    expect(html).toContain('<meta name="description" content="A test page">');
  });

  it('should render with custom CSS files', () => {
    const html = Layout.render({
      title: 'Test',
      cssFiles: ['/custom.css', '/theme.css'],
      children: '',
    });

    expect(html).toContain('href="/custom.css"');
    expect(html).toContain('href="/theme.css"');
  });

  it('should render with custom JS files', () => {
    const html = Layout.render({
      title: 'Test',
      jsFiles: ['/app.js'],
      children: '',
    });

    expect(html).toContain('src="/app.js"');
  });

  it('should include language attribute', () => {
    const html = Layout.render({
      title: 'Test',
      lang: 'sv',
      children: '',
    });

    expect(html).toContain('<html lang="sv">');
  });

  it('should wrap children in proper structure', () => {
    const html = Layout.render({
      title: 'Test',
      children: '<h1>Hello</h1>',
    });

    expect(html).toContain('<div id="app"');
    expect(html).toContain('<h1>Hello</h1>');
  });
});
