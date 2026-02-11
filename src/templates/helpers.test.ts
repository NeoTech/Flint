import { describe, it, expect } from 'bun:test';
import { renderHead, renderFootScripts } from './helpers.js';

describe('renderHead', () => {
  it('should include charset, viewport, title, and main CSS', () => {
    const html = renderHead({ title: 'Test', basePath: '' });
    expect(html).toContain('<meta charset="UTF-8">');
    expect(html).toContain('<meta name="viewport"');
    expect(html).toContain('<title>Test</title>');
    expect(html).toContain('href="/assets/main.css"');
  });

  it('should include description meta when provided', () => {
    const html = renderHead({ title: 'T', basePath: '', description: 'A page' });
    expect(html).toContain('<meta name="description" content="A page">');
  });

  it('should omit description meta when empty', () => {
    const html = renderHead({ title: 'T', basePath: '', description: '' });
    expect(html).not.toContain('name="description"');
  });

  it('should include keywords meta when provided', () => {
    const html = renderHead({ title: 'T', basePath: '', keywords: 'a, b' });
    expect(html).toContain('<meta name="keywords" content="a, b">');
  });

  it('should omit keywords meta when empty', () => {
    const html = renderHead({ title: 'T', basePath: '' });
    expect(html).not.toContain('name="keywords"');
  });

  it('should include base-path meta', () => {
    const html = renderHead({ title: 'T', basePath: '/Flint' });
    expect(html).toContain('<meta name="base-path" content="/Flint">');
  });

  it('should prefix main CSS with basePath', () => {
    const html = renderHead({ title: 'T', basePath: '/Flint' });
    expect(html).toContain('href="/Flint/assets/main.css"');
  });

  it('should include extra CSS files', () => {
    const html = renderHead({ title: 'T', basePath: '', cssFiles: ['/extra.css', '/theme.css'] });
    expect(html).toContain('href="/extra.css"');
    expect(html).toContain('href="/theme.css"');
  });

  it('should include extra JS files in head', () => {
    const html = renderHead({ title: 'T', basePath: '', jsFiles: ['/app.js'] });
    expect(html).toContain('src="/app.js"');
  });

  it('should set lang attribute', () => {
    const html = renderHead({ title: 'T', basePath: '', lang: 'de' });
    expect(html).toContain('<html lang="de">');
  });

  it('should default lang to en', () => {
    const html = renderHead({ title: 'T', basePath: '' });
    expect(html).toContain('<html lang="en">');
  });
});

describe('renderFootScripts', () => {
  it('should include main.js with basePath', () => {
    const html = renderFootScripts('/Flint');
    expect(html).toContain('src="/Flint/assets/main.js"');
  });

  it('should work with empty basePath', () => {
    const html = renderFootScripts('');
    expect(html).toContain('src="/assets/main.js"');
  });
});
