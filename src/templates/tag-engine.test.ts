import { describe, it, expect } from 'vitest';
import { resolveTag, isTagTruthy, processTemplate, estimateReadingTime, formatDate } from './tag-engine.js';
import type { TemplateContext } from './template-registry.js';

/** Minimal context factory for tests. */
function makeCtx(overrides: Partial<TemplateContext> = {}): TemplateContext {
  return {
    title: 'Test Page',
    content: '<p>Hello world</p>',
    description: 'A test page',
    keywords: 'test, page',
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

describe('estimateReadingTime', () => {
  it('should return 1 for short content', () => {
    expect(estimateReadingTime('<p>Hello</p>')).toBe(1);
  });

  it('should estimate longer content correctly', () => {
    const words = Array(400).fill('word').join(' ');
    expect(estimateReadingTime(`<p>${words}</p>`)).toBe(2);
  });

  it('should strip HTML tags before counting', () => {
    const html = '<h1>Title</h1><p>one two three</p><strong>four</strong>';
    expect(estimateReadingTime(html)).toBe(1);
  });
});

describe('formatDate', () => {
  it('should format a date in long US format', () => {
    const d = new Date('2026-02-01T00:00:00Z');
    expect(formatDate(d)).toBe('February 1, 2026');
  });

  it('should use UTC to avoid timezone shifts', () => {
    const d = new Date('2026-01-15T00:00:00Z');
    expect(formatDate(d)).toBe('January 15, 2026');
  });
});

describe('resolveTag', () => {
  it('should resolve {{title}} to context title', () => {
    const ctx = makeCtx({ title: 'My Title' });
    expect(resolveTag('title', ctx)).toBe('My Title');
  });

  it('should resolve {{description}}', () => {
    const ctx = makeCtx({ description: 'My desc' });
    expect(resolveTag('description', ctx)).toBe('My desc');
  });

  it('should resolve {{keywords}}', () => {
    const ctx = makeCtx({ keywords: 'a, b' });
    expect(resolveTag('keywords', ctx)).toBe('a, b');
  });

  it('should resolve {{author}}', () => {
    const ctx = makeCtx({ author: 'Jane' });
    expect(resolveTag('author', ctx)).toBe('Jane');
  });

  it('should resolve {{category}}', () => {
    const ctx = makeCtx({ category: 'Tutorials' });
    expect(resolveTag('category', ctx)).toBe('Tutorials');
  });

  it('should resolve {{basePath}}', () => {
    const ctx = makeCtx({ basePath: '/Flint' });
    expect(resolveTag('basePath', ctx)).toBe('/Flint');
  });

  it('should resolve {{content}} to pre-compiled HTML', () => {
    const ctx = makeCtx({ content: '<h1>Hi</h1>' });
    expect(resolveTag('content', ctx)).toBe('<h1>Hi</h1>');
  });

  it('should resolve {{head}} with DOCTYPE, meta, title, and CSS link', () => {
    const ctx = makeCtx({ title: 'My Page', description: 'Desc', keywords: 'kw' });
    const head = resolveTag('head', ctx);
    expect(head).toContain('<!DOCTYPE html>');
    expect(head).toContain('<title>My Page</title>');
    expect(head).toContain('meta name="description"');
    expect(head).toContain('meta name="keywords"');
    expect(head).toContain('main.css');
  });

  it('should resolve {{head}} with basePath prefix on CSS', () => {
    const ctx = makeCtx({ basePath: '/Flint' });
    const head = resolveTag('head', ctx);
    expect(head).toContain('href="/Flint/assets/main.css"');
  });

  it('should resolve {{navigation}} to nav element when items exist', () => {
    const ctx = makeCtx({
      navigation: [
        { label: 'Home', href: '/', active: true },
        { label: 'About', href: '/about' },
      ],
    });
    const nav = resolveTag('navigation', ctx);
    expect(nav).toContain('<nav');
    expect(nav).toContain('Home');
    expect(nav).toContain('About');
  });

  it('should resolve {{navigation}} to empty string when no items', () => {
    const ctx = makeCtx({ navigation: [] });
    expect(resolveTag('navigation', ctx)).toBe('');
  });

  it('should resolve {{label-footer}} to footer when labels exist', () => {
    const ctx = makeCtx({ siteLabels: ['htmx', 'css'] });
    const footer = resolveTag('label-footer', ctx);
    expect(footer).toContain('<footer');
    expect(footer).toContain('data-label="css"');
    expect(footer).toContain('data-label="htmx"');
  });

  it('should resolve {{label-footer}} to empty string when no labels', () => {
    const ctx = makeCtx({ siteLabels: [] });
    expect(resolveTag('label-footer', ctx)).toBe('');
  });

  it('should resolve {{foot-scripts}} to script tag', () => {
    const ctx = makeCtx({ basePath: '/Flint' });
    const scripts = resolveTag('foot-scripts', ctx);
    expect(scripts).toContain('src="/Flint/assets/main.js"');
  });

  it('should resolve {{formatted-date}} to readable date', () => {
    const ctx = makeCtx({ date: new Date('2026-02-01T00:00:00Z') });
    expect(resolveTag('formatted-date', ctx)).toBe('February 1, 2026');
  });

  it('should resolve {{formatted-date}} to empty string when no date', () => {
    const ctx = makeCtx({ date: null });
    expect(resolveTag('formatted-date', ctx)).toBe('');
  });

  it('should resolve {{reading-time}} from content', () => {
    const ctx = makeCtx({ content: '<p>' + Array(400).fill('word').join(' ') + '</p>' });
    expect(resolveTag('reading-time', ctx)).toBe('2 min read');
  });

  it('should resolve {{category-pill}} to badge HTML', () => {
    const ctx = makeCtx({ category: 'Tutorials' });
    const pill = resolveTag('category-pill', ctx);
    expect(pill).toContain('Tutorials');
    expect(pill).toContain('bg-blue-100');
  });

  it('should resolve {{category-pill}} to empty string when no category', () => {
    const ctx = makeCtx({ category: '' });
    expect(resolveTag('category-pill', ctx)).toBe('');
  });

  it('should resolve {{label-badges}} to badge HTML', () => {
    const ctx = makeCtx({ labels: ['htmx', 'css'] });
    const badges = resolveTag('label-badges', ctx);
    expect(badges).toContain('htmx');
    expect(badges).toContain('css');
    expect(badges).toContain('rounded-full');
  });

  it('should resolve {{label-badges}} to empty string when no labels', () => {
    const ctx = makeCtx({ labels: [] });
    expect(resolveTag('label-badges', ctx)).toBe('');
  });

  it('should resolve {{blog-header}} with full article header', () => {
    const ctx = makeCtx({
      title: 'My Post',
      author: 'Jane',
      date: new Date('2026-02-01T00:00:00Z'),
      category: 'Tutorials',
      labels: ['htmx', 'beginner'],
      content: '<p>Some words here for reading time</p>',
    });
    const header = resolveTag('blog-header', ctx);
    expect(header).toContain('<header');
    expect(header).toContain('My Post');
    expect(header).toContain('Jane');
    expect(header).toContain('February 1, 2026');
    expect(header).toContain('Tutorials');
    expect(header).toContain('htmx');
    expect(header).toContain('min read');
  });

  it('should pass through unknown tags unchanged', () => {
    const ctx = makeCtx();
    expect(resolveTag('unknown-thing', ctx)).toBe('{{unknown-thing}}');
  });
});

describe('isTagTruthy', () => {
  it('should return true for non-empty resolved tags', () => {
    const ctx = makeCtx({ title: 'Hello' });
    expect(isTagTruthy('title', ctx)).toBe(true);
  });

  it('should return false for empty resolved tags', () => {
    const ctx = makeCtx({ navigation: [] });
    expect(isTagTruthy('navigation', ctx)).toBe(false);
  });

  it('should return true for navigation with items', () => {
    const ctx = makeCtx({ navigation: [{ label: 'Home', href: '/' }] });
    expect(isTagTruthy('navigation', ctx)).toBe(true);
  });

  it('should return false for label-footer with no labels', () => {
    const ctx = makeCtx({ siteLabels: [] });
    expect(isTagTruthy('label-footer', ctx)).toBe(false);
  });

  it('should return true for label-footer with labels', () => {
    const ctx = makeCtx({ siteLabels: ['a'] });
    expect(isTagTruthy('label-footer', ctx)).toBe(true);
  });
});

describe('processTemplate', () => {
  it('should replace simple tags', () => {
    const template = '<h1>{{title}}</h1>';
    const ctx = makeCtx({ title: 'Hello' });
    expect(processTemplate(template, ctx)).toBe('<h1>Hello</h1>');
  });

  it('should replace multiple tags', () => {
    const template = '<title>{{title}}</title><p>{{description}}</p>';
    const ctx = makeCtx({ title: 'T', description: 'D' });
    expect(processTemplate(template, ctx)).toBe('<title>T</title><p>D</p>');
  });

  it('should render {{#if}} block when truthy', () => {
    const template = '{{#if navigation}}<nav>NAV</nav>{{/if}}';
    const ctx = makeCtx({ navigation: [{ label: 'Home', href: '/' }] });
    expect(processTemplate(template, ctx)).toBe('<nav>NAV</nav>');
  });

  it('should remove {{#if}} block when falsy', () => {
    const template = 'BEFORE{{#if navigation}}<nav>NAV</nav>{{/if}}AFTER';
    const ctx = makeCtx({ navigation: [] });
    expect(processTemplate(template, ctx)).toBe('BEFOREAFTER');
  });

  it('should resolve tags inside {{#if}} blocks', () => {
    const template = '{{#if navigation}}{{navigation}}{{/if}}';
    const ctx = makeCtx({ navigation: [{ label: 'Home', href: '/' }] });
    const result = processTemplate(template, ctx);
    expect(result).toContain('<nav');
    expect(result).toContain('Home');
  });

  it('should handle nested content with {{#if}} and regular tags', () => {
    const template = [
      '{{head}}',
      '<body>',
      '{{#if navigation}}{{navigation}}{{/if}}',
      '<main>{{content}}</main>',
      '{{foot-scripts}}',
      '</body>',
      '</html>',
    ].join('\n');
    const ctx = makeCtx({
      title: 'Test',
      content: '<p>Hello</p>',
      navigation: [{ label: 'Home', href: '/' }],
    });
    const result = processTemplate(template, ctx);
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<title>Test</title>');
    expect(result).toContain('<nav');
    expect(result).toContain('<p>Hello</p>');
    expect(result).toContain('main.js');
  });

  it('should produce a full page from a default-like template', () => {
    const template = [
      '{{head}}',
      '<body class="min-h-screen bg-gray-50">',
      '    <div id="app" class="flex flex-col min-h-screen">',
      '        {{#if navigation}}{{navigation}}{{/if}}',
      '        <main class="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{{content}}</main>',
      '        {{#if label-footer}}{{label-footer}}{{/if}}',
      '    </div>',
      '    {{foot-scripts}}',
      '</body>',
      '</html>',
    ].join('\n');
    const ctx = makeCtx({
      title: 'Home',
      description: 'Welcome',
      content: '<h1>Welcome</h1>',
      navigation: [{ label: 'Home', href: '/', active: true }],
      siteLabels: ['htmx', 'css'],
    });
    const result = processTemplate(template, ctx);
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<title>Home</title>');
    expect(result).toContain('<nav');
    expect(result).toContain('<h1>Welcome</h1>');
    expect(result).toContain('<footer');
    expect(result).toContain('main.js');
  });
});

// ------------------------------------------------------------------
// Component tags
// ------------------------------------------------------------------

describe('resolveTag – gadget', () => {
  it('should render the gadget widget', () => {
    const ctx = makeCtx();
    const html = resolveTag('gadget', ctx);
    expect(html).toContain('gadget');
  });
});

describe('resolveTag – cart', () => {
  it('should render the cart widget shell', () => {
    const ctx = makeCtx();
    const html = resolveTag('cart', ctx);
    expect(html).toContain('flint-cart');
    expect(html).toContain('button');
  });

  it('should be truthy so {{#if cart}} blocks render', () => {
    const ctx = makeCtx();
    expect(isTagTruthy('cart', ctx)).toBe(true);
  });
});

describe('resolveTag – product', () => {
  it('should render the product card from frontmatter data', () => {
    const ctx = makeCtx({
      title: 'Blue Ceramic Mug',
      frontmatter: {
        'Short-URI': 'blue-mug',
        'PriceCents': 1200,
        'Description': 'A hand-crafted mug.',
        'Image': '☕',
      },
    });
    const html = resolveTag('product', ctx);
    expect(html).toContain('Blue Ceramic Mug');
    expect(html).toContain('$12.00');
    expect(html).toContain('blue-mug');
    expect(html).toContain('A hand-crafted mug.');
  });

  it('should return empty string when no Short-URI in frontmatter', () => {
    const ctx = makeCtx({ frontmatter: {} });
    expect(resolveTag('product', ctx)).toBe('');
  });

  it('should render without price when PriceCents is missing', () => {
    const ctx = makeCtx({
      title: 'Free Item',
      frontmatter: { 'Short-URI': 'free-item' },
    });
    const html = resolveTag('product', ctx);
    expect(html).toContain('Free Item');
    expect(html).toContain('free-item');
  });

  it('should include an Add to Cart button', () => {
    const ctx = makeCtx({
      title: 'Mug',
      frontmatter: { 'Short-URI': 'mug', 'PriceCents': 500 },
    });
    const html = resolveTag('product', ctx);
    expect(html).toContain('Add');
  });

  it('should be falsy when no product data', () => {
    const ctx = makeCtx({ frontmatter: {} });
    expect(isTagTruthy('product', ctx)).toBe(false);
  });

  it('should be truthy when product data exists', () => {
    const ctx = makeCtx({
      title: 'Mug',
      frontmatter: { 'Short-URI': 'mug', 'PriceCents': 500 },
    });
    expect(isTagTruthy('product', ctx)).toBe(true);
  });
});

describe('resolveTag – skill-cards', () => {
  const skillsData = [
    { name: 'add-content', icon: '📝', description: 'Create content pages.', tags: ['frontmatter'], color: 'green' },
    { name: 'build-and-test', icon: '🧪', description: 'Build and test.', tags: ['vitest'], color: 'amber' },
  ];

  it('should render skill cards from frontmatter Skills array', () => {
    const ctx = makeCtx({ frontmatter: { Skills: skillsData } });
    const html = resolveTag('skill-cards', ctx);
    expect(html).toContain('add-content');
    expect(html).toContain('build-and-test');
    expect(html).toContain('📝');
  });

  it('should return empty string when Skills is missing', () => {
    const ctx = makeCtx({ frontmatter: {} });
    expect(resolveTag('skill-cards', ctx)).toBe('');
  });

  it('should return empty string when Skills is empty array', () => {
    const ctx = makeCtx({ frontmatter: { Skills: [] } });
    expect(resolveTag('skill-cards', ctx)).toBe('');
  });

  it('should be falsy when no Skills data', () => {
    const ctx = makeCtx({ frontmatter: {} });
    expect(isTagTruthy('skill-cards', ctx)).toBe(false);
  });

  it('should be truthy when Skills data exists', () => {
    const ctx = makeCtx({ frontmatter: { Skills: skillsData } });
    expect(isTagTruthy('skill-cards', ctx)).toBe(true);
  });
});
