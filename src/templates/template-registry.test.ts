import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  TemplateRegistry,
  loadTemplatesFromDir,
  type TemplateContext,
} from './template-registry.js';

function makeContext(overrides: Partial<TemplateContext> = {}): TemplateContext {
  return {
    title: 'Test Page',
    content: '<p>Hello</p>',
    description: '',
    keywords: '',
    basePath: '',
    navigation: [],
    siteLabels: [],
    frontmatter: {},
    cssFiles: [],
    jsFiles: [],
    author: '',
    date: null,
    category: '',
    labels: [],
    type: 'page',
    ...overrides,
  };
}

describe('TemplateRegistry', () => {
  it('should register and retrieve a template', () => {
    const registry = new TemplateRegistry();
    registry.register('stub', '<p>{{title}}</p>');
    expect(registry.get('stub')).toBe('<p>{{title}}</p>');
  });

  it('should return undefined for unregistered template', () => {
    const registry = new TemplateRegistry();
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('should check if a template is registered', () => {
    const registry = new TemplateRegistry();
    registry.register('stub', '<p>hi</p>');
    expect(registry.has('stub')).toBe(true);
    expect(registry.has('missing')).toBe(false);
  });

  it('should list all registered template names', () => {
    const registry = new TemplateRegistry();
    registry.register('alpha', '<p>a</p>');
    registry.register('beta', '<p>b</p>');
    expect(registry.names()).toEqual(['alpha', 'beta']);
  });

  it('should overwrite a template with the same name', () => {
    const registry = new TemplateRegistry();
    registry.register('stub', '<p>original</p>');
    registry.register('stub', '<p>replaced</p>');
    expect(registry.get('stub')).toBe('<p>replaced</p>');
  });

  it('should render a template by resolving {{tags}} via the tag engine', () => {
    const registry = new TemplateRegistry();
    registry.register('simple', '<title>{{title}}</title><div>{{content}}</div>');

    const ctx = makeContext({ title: 'My Page', content: '<p>body</p>' });
    const html = registry.render('simple', ctx);
    expect(html).toContain('<title>My Page</title>');
    expect(html).toContain('<p>body</p>');
  });

  it('should render {{#if}} conditionals', () => {
    const registry = new TemplateRegistry();
    registry.register('cond', 'BEFORE{{#if navigation}}<nav>NAV</nav>{{/if}}AFTER');

    const withNav = makeContext({ navigation: [{ label: 'Home', href: '/' }] });
    expect(registry.render('cond', withNav)).toContain('<nav>NAV</nav>');

    const noNav = makeContext({ navigation: [] });
    expect(registry.render('cond', noNav)).toBe('BEFOREAFTER');
  });

  it('should throw when rendering an unregistered template', () => {
    const registry = new TemplateRegistry();
    const ctx = makeContext();
    expect(() => registry.render('missing', ctx)).toThrow('Template "missing" is not registered');
  });
});

describe('loadTemplatesFromDir', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'templates-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should load .html files as named templates', () => {
    writeFileSync(join(tempDir, 'default.html'), '<p>{{title}}</p>');
    writeFileSync(join(tempDir, 'blank.html'), '<div>{{content}}</div>');

    const registry = loadTemplatesFromDir(tempDir);
    expect(registry.has('default')).toBe(true);
    expect(registry.has('blank')).toBe(true);
    expect(registry.names()).toEqual(expect.arrayContaining(['default', 'blank']));
  });

  it('should ignore non-.html files', () => {
    writeFileSync(join(tempDir, 'default.html'), '<p>ok</p>');
    writeFileSync(join(tempDir, 'README.md'), '# Not a template');

    const registry = loadTemplatesFromDir(tempDir);
    expect(registry.names()).toEqual(['default']);
  });

  it('should return empty registry for nonexistent directory', () => {
    const registry = loadTemplatesFromDir('/tmp/does-not-exist-xyz');
    expect(registry.names()).toEqual([]);
  });

  it('should render loaded templates through the tag engine', () => {
    writeFileSync(join(tempDir, 'test.html'), '<h1>{{title}}</h1><main>{{content}}</main>');

    const registry = loadTemplatesFromDir(tempDir);
    const ctx = makeContext({ title: 'Loaded', content: '<p>Works</p>' });
    const html = registry.render('test', ctx);
    expect(html).toBe('<h1>Loaded</h1><main><p>Works</p></main>');
  });
});
