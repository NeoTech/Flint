import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { SiteBuilder, type BuildConfig, type ContentFile } from './builder.js';

describe('SiteBuilder', () => {
  let tempDir: string;
  let contentDir: string;
  let outputDir: string;
  let templatesDir: string;
  let builder: SiteBuilder;

  /** Write a minimal default.html template to the temp templates dir. */
  function writeTestTemplates(dir: string): void {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'default.html'), [
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
    ].join('\n'));
  }

  beforeEach(() => {
    // Prevent SITE_URL from .env bleeding into tests that expect no SEO files
    delete process.env.SITE_URL;
    tempDir = mkdtempSync(join(tmpdir(), 'site-builder-test-'));
    contentDir = join(tempDir, 'content');
    outputDir = join(tempDir, 'dist');
    templatesDir = join(tempDir, 'templates');
    mkdirSync(contentDir, { recursive: true });
    writeTestTemplates(templatesDir);
    
    const config: BuildConfig = {
      contentDir,
      outputDir,
      templatesDir,
      navigation: [
        { label: 'Home', href: '/' },
        { label: 'About', href: '/about' },
      ],
    };
    
    builder = new SiteBuilder(config);
  });

  afterEach(() => {
    delete process.env.BASE_PATH;
    delete process.env.SITE_URL;
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('scanContent', () => {
    it('should find all markdown files', () => {
      writeFileSync(join(contentDir, 'index.md'), '# Home');
      writeFileSync(join(contentDir, 'about.md'), '# About');
      
      const files = builder.scanContent();
      
      expect(files).toHaveLength(2);
      expect(files.map(f => f.name)).toContain('index.md');
      expect(files.map(f => f.name)).toContain('about.md');
    });

    it('should find markdown files in subdirectories', () => {
      const blogDir = join(contentDir, 'blog');
      mkdirSync(blogDir, { recursive: true });
      
      writeFileSync(join(contentDir, 'index.md'), '# Home');
      writeFileSync(join(blogDir, 'post1.md'), '# Post 1');
      
      const files = builder.scanContent();
      
      expect(files).toHaveLength(2);
      // Check for file in subdirectory (handle both / and \ path separators)
      expect(files.some((f: ContentFile) => f.relativePath.includes('blog') && f.name === 'post1.md')).toBe(true);
    });

    it('should return empty array when no markdown files exist', () => {
      const files = builder.scanContent();
      expect(files).toEqual([]);
    });
  });

  describe('processFile', () => {
    it('should process markdown file with frontmatter', () => {
      const markdown = `---
title: Test Page
---

# Hello World`;
      
      const result = builder.processFile(markdown, 'test.md');
      
      expect(result.data.title).toBe('Test Page');
      expect(result.html).toContain('<h1>Hello World</h1>');
      expect(result.outputPath).toBe('test/index.html');
    });

    it('should convert .md to folder with index.html for clean URLs', () => {
      const result = builder.processFile('# Content', 'page.md');
      expect(result.outputPath).toBe('page/index.html');
    });

    it('should handle index.md specially', () => {
      const result = builder.processFile('# Home', 'index.md');
      expect(result.outputPath).toBe('index.html');
    });

    it('should use filename stem when Short-URI is absent (flat URL)', () => {
      const result = builder.processFile('# Blog Post', 'blog/post.md');
      expect(result.outputPath).toBe('post/index.html'); // stem of blog/post.md
    });

    it('should handle subdirectory index.md correctly', () => {
      const result = builder.processFile('# Blog', 'blog/index.md');
      expect(result.outputPath).toBe('blog/index.html');
    });
  });

  describe('build', () => {
    it('should build site from markdown files', async () => {
      writeFileSync(join(contentDir, 'index.md'), `---
title: Home
---

# Welcome`);
      
      writeFileSync(join(contentDir, 'about.md'), `---
title: About Us
---

# About`);
      
      await builder.build();
      
      expect(existsSync(join(outputDir, 'index.html'))).toBe(true);
      expect(existsSync(join(outputDir, 'about', 'index.html'))).toBe(true);
      
      const indexContent = readFileSync(join(outputDir, 'index.html'), 'utf-8');
      expect(indexContent).toContain('<title>Home</title>');
      expect(indexContent).toContain('<h1>Welcome</h1>');
    });

    it('should use Short-URI as output path (flat URL)', async () => {
      const blogDir = join(contentDir, 'blog');
      mkdirSync(blogDir, { recursive: true });

      // With Short-URI, the output is at <short-uri>/index.html regardless of file location
      writeFileSync(join(blogDir, 'post.md'), [
        '---',
        'title: Blog Post',
        'Short-URI: my-post',
        '---',
        '# Blog Post',
      ].join('\n'));

      await builder.build();

      expect(existsSync(join(outputDir, 'my-post', 'index.html'))).toBe(true);
    });

    it('should include navigation in output', async () => {
      writeFileSync(join(contentDir, 'index.md'), '---\ntitle: Home\nShort-URI: home\nParent: root\n---\n# Home');
      
      await builder.build();
      
      const content = readFileSync(join(outputDir, 'index.html'), 'utf-8');
      expect(content).toContain('<nav');
      expect(content).toContain('href="/"');
      expect(content).toContain('Home');
    });

    it('should handle empty content directory', async () => {
      await builder.build();
      
      expect(existsSync(outputDir)).toBe(true);
      // Only the fragments directory (with empty page-index.json) should exist
      const files = readdirSync(outputDir);
      expect(files).toEqual(['fragments']);
      const index = JSON.parse(readFileSync(join(outputDir, 'fragments', 'page-index.json'), 'utf-8'));
      expect(index).toEqual([]);
    });

    it('should build subdirectory index pages correctly', async () => {
      const blogDir = join(contentDir, 'blog');
      mkdirSync(blogDir, { recursive: true });

      writeFileSync(join(contentDir, 'index.md'), '---\ntitle: Home\nShort-URI: home\nParent: root\nOrder: 1\n---\n# Home');
      writeFileSync(join(blogDir, 'index.md'), '---\ntitle: Blog\nShort-URI: blog\nParent: root\nOrder: 2\n---\n# Blog');
      writeFileSync(join(blogDir, 'post.md'), '---\ntitle: Post\nShort-URI: a-post\nParent: blog\n---\n# A Post');

      await builder.build();

      // Blog index Short-URI=blog → dist/blog/index.html
      expect(existsSync(join(outputDir, 'blog', 'index.html'))).toBe(true);
      expect(existsSync(join(outputDir, 'blog', 'index', 'index.html'))).toBe(false);

      // Blog post Short-URI=a-post → dist/a-post/index.html (flat URL)
      expect(existsSync(join(outputDir, 'a-post', 'index.html'))).toBe(true);

      // Navigation should have /blog link (with leading slash)
      const homeContent = readFileSync(join(outputDir, 'index.html'), 'utf-8');
      expect(homeContent).toContain('href="/blog"');
    });

    it('should resolve :::children directives in section pages', async () => {
      const blogDir = join(contentDir, 'blog');
      mkdirSync(blogDir, { recursive: true });

      writeFileSync(join(contentDir, 'index.md'), '---\ntitle: Home\nShort-URI: home\nParent: root\nOrder: 1\n---\n# Home');

      writeFileSync(join(blogDir, 'index.md'), [
        '---',
        'title: Blog',
        'Short-URI: blog',
        'Type: section',
        'Parent: root',
        'Order: 2',
        '---',
        '# Blog',
        '',
        ':::children sort=date-desc',
        ':::',
      ].join('\n'));

      writeFileSync(join(blogDir, 'post1.md'), [
        '---',
        'title: First Post',
        'Short-URI: first-post',
        'Type: post',
        'Category: Tutorials',
        'Labels:',
        '  - htmx',
        'Parent: blog',
        'Order: 1',
        'Date: 2026-02-01',
        'Description: A first blog post',
        '---',
        '# First Post',
      ].join('\n'));

      writeFileSync(join(blogDir, 'post2.md'), [
        '---',
        'title: Second Post',
        'Short-URI: second-post',
        'Type: post',
        'Category: Deep Dives',
        'Labels:',
        '  - architecture',
        'Parent: blog',
        'Order: 2',
        'Date: 2026-01-15',
        'Description: A second blog post',
        '---',
        '# Second Post',
      ].join('\n'));

      await builder.build();

      const blogIndex = readFileSync(join(outputDir, 'blog', 'index.html'), 'utf-8');

      // Children should be rendered in the blog index
      expect(blogIndex).toContain('First Post');
      expect(blogIndex).toContain('Second Post');
      // Date-desc: First Post (Feb 1) before Second Post (Jan 15)
      expect(blogIndex.indexOf('First Post')).toBeLessThan(blogIndex.indexOf('Second Post'));
      // Should contain links to child pages using their Short-URIs
      expect(blogIndex).toContain('/first-post');
      expect(blogIndex).toContain('/second-post');
      // Should contain descriptions
      expect(blogIndex).toContain('A first blog post');
      expect(blogIndex).toContain('A second blog post');
    });

    it('should generate page-index.json in fragments directory', async () => {
      writeFileSync(join(contentDir, 'index.md'), [
        '---',
        'title: Home',
        'Short-URI: home',
        'Parent: root',
        'Labels:',
        '  - welcome',
        '---',
        '# Home',
      ].join('\n'));

      writeFileSync(join(contentDir, 'about.md'), [
        '---',
        'title: About',
        'Short-URI: about',
        'Parent: root',
        'Labels:',
        '  - info',
        '---',
        '# About',
      ].join('\n'));

      await builder.build();

      const jsonPath = join(outputDir, 'fragments', 'page-index.json');
      expect(existsSync(jsonPath)).toBe(true);

      const index = JSON.parse(readFileSync(jsonPath, 'utf-8'));
      expect(index).toHaveLength(2);
      expect(index.map((e: { title: string }) => e.title)).toContain('Home');
      expect(index.map((e: { title: string }) => e.title)).toContain('About');
      // Each entry should have labels array
      const homeEntry = index.find((e: { title: string }) => e.title === 'Home');
      expect(homeEntry.labels).toContain('welcome');
    });

    it('should generate label index pages for labels with 2+ pages', async () => {
      writeFileSync(join(contentDir, 'page1.md'), [
        '---',
        'title: Page One',
        'Short-URI: page-one',
        'Labels:',
        '  - shared-label',
        '  - unique-a',
        '---',
        '# Page One',
      ].join('\n'));

      writeFileSync(join(contentDir, 'page2.md'), [
        '---',
        'title: Page Two',
        'Short-URI: page-two',
        'Labels:',
        '  - shared-label',
        '  - unique-b',
        '---',
        '# Page Two',
      ].join('\n'));

      await builder.build();

      // shared-label has 2 pages → should get a label index page
      const labelPagePath = join(outputDir, 'label', 'shared-label', 'index.html');
      expect(existsSync(labelPagePath)).toBe(true);

      const labelPageHtml = readFileSync(labelPagePath, 'utf-8');
      expect(labelPageHtml).toContain('shared-label');
      expect(labelPageHtml).toContain('Page One');
      expect(labelPageHtml).toContain('Page Two');

      // unique-a and unique-b each only appear on 1 page → no label index page
      expect(existsSync(join(outputDir, 'label', 'unique-a', 'index.html'))).toBe(false);
      expect(existsSync(join(outputDir, 'label', 'unique-b', 'index.html'))).toBe(false);
    });

    it('should not generate label index page for single-page labels', async () => {
      writeFileSync(join(contentDir, 'page.md'), [
        '---',
        'title: Solo Page',
        'Short-URI: solo',
        'Labels:',
        '  - lonely-label',
        '---',
        '# Solo',
      ].join('\n'));

      await builder.build();

      expect(existsSync(join(outputDir, 'label', 'lonely-label', 'index.html'))).toBe(false);
    });
  });

  describe('getOutputPath', () => {
    type GetOutputPath = (shortUri: string, path: string) => string;
    const get = (b: SiteBuilder) => (b as unknown as { getOutputPath: GetOutputPath }).getOutputPath.bind(b);

    it('should use Short-URI as output directory', () => {
      expect(get(builder)('my-page', 'page.md')).toBe('my-page/index.html');
    });

    it('should use Short-URI regardless of source file location (flat URL)', () => {
      expect(get(builder)('my-post', 'blog/post.md')).toBe('my-post/index.html');
    });

    it('should keep root index.md at site root', () => {
      expect(get(builder)('home', 'index.md')).toBe('index.html');
    });

    it('should use Short-URI for subdirectory index files', () => {
      expect(get(builder)('blog', 'blog/index.md')).toBe('blog/index.html');
    });

    it('should fall back to directory name for index.md when shortUri is empty', () => {
      expect(get(builder)('', 'blog/index.md')).toBe('blog/index.html');
    });

    it('should fall back to filename stem when shortUri is empty', () => {
      expect(get(builder)('', 'blog/post.md')).toBe('post/index.html');
    });
  });

  describe('SEO files', () => {
    it('should generate robots.txt and sitemap.xml when siteUrl is set', async () => {
      writeFileSync(join(contentDir, 'index.md'), [
        '---',
        'title: Home',
        'Short-URI: /',
        'date: 2024-01-15',
        '---',
        '# Home',
      ].join('\n'));

      const seoBuilder = new SiteBuilder({
        contentDir,
        outputDir,
        templatesDir,
        siteUrl: 'https://example.com',
      });
      await seoBuilder.build();

      expect(existsSync(join(outputDir, 'robots.txt'))).toBe(true);
      expect(existsSync(join(outputDir, 'sitemap.xml'))).toBe(true);

      const robots = readFileSync(join(outputDir, 'robots.txt'), 'utf-8');
      expect(robots).toContain('User-agent: *');
      expect(robots).toContain('Sitemap: https://example.com/sitemap.xml');

      const sitemap = readFileSync(join(outputDir, 'sitemap.xml'), 'utf-8');
      expect(sitemap).toContain('<loc>https://example.com/</loc>');
    });

    it('should not generate SEO files when siteUrl is empty', async () => {
      writeFileSync(join(contentDir, 'index.md'), '---\ntitle: Home\n---\n# Home');
      await builder.build();

      expect(existsSync(join(outputDir, 'robots.txt'))).toBe(false);
      expect(existsSync(join(outputDir, 'sitemap.xml'))).toBe(false);
    });
  });

  describe('BASE_PATH rewriting', () => {
    it('should rewrite absolute paths in content when BASE_PATH is set', async () => {
      process.env.BASE_PATH = '/Flint';
      writeFileSync(join(contentDir, 'index.md'), '---\ntitle: Home\n---\n[About](/about)');
      await builder.build();

      const html = readFileSync(join(outputDir, 'index.html'), 'utf-8');
      expect(html).toContain('href="/Flint/about"');
      expect(html).not.toContain('href="/about"');
    });

    it('should rewrite absolute paths rendered outside content (e.g. component output)', async () => {
      process.env.BASE_PATH = '/Flint';
      // Template with a hardcoded link outside {{content}} — simulates component-rendered links
      writeFileSync(join(templatesDir, 'with-link.html'), [
        '{{head}}',
        '<body>',
        '  <a href="/showcase">Showcase</a>',
        '  <a href="/shop">Shop</a>',
        '  <main>{{content}}</main>',
        '  {{foot-scripts}}',
        '</body>',
        '</html>',
      ].join('\n'));
      writeFileSync(join(contentDir, 'index.md'), '---\ntitle: Home\nShort-URI: home\nTemplate: with-link\n---\n# Home');
      // Rebuild builder so it picks up the new template
      const freshBuilder = new SiteBuilder({
        contentDir,
        outputDir,
        templatesDir,
        navigation: [{ label: 'Home', href: '/' }],
      });
      await freshBuilder.build();

      const html = readFileSync(join(outputDir, 'index.html'), 'utf-8');
      expect(html).toContain('href="/Flint/showcase"');
      expect(html).toContain('href="/Flint/shop"');
      expect(html).not.toContain('href="/showcase"');
      expect(html).not.toContain('href="/shop"');
    });

    it('should not double-prefix paths that already contain BASE_PATH', async () => {
      process.env.BASE_PATH = '/Flint';
      writeFileSync(join(contentDir, 'index.md'), '---\ntitle: Home\n---\n[Already](/Flint/about)');
      await builder.build();

      const html = readFileSync(join(outputDir, 'index.html'), 'utf-8');
      expect(html).toContain('href="/Flint/about"');
      expect(html).not.toContain('href="/Flint/Flint/about"');
    });

    it('should not rewrite external URLs', async () => {
      process.env.BASE_PATH = '/Flint';
      writeFileSync(join(contentDir, 'index.md'), '---\ntitle: Home\n---\n[External](https://example.com/page)');
      await builder.build();

      const html = readFileSync(join(outputDir, 'index.html'), 'utf-8');
      expect(html).toContain('href="https://example.com/page"');
    });

    it('should leave paths unchanged when BASE_PATH is empty', async () => {
      process.env.BASE_PATH = '';
      writeFileSync(join(contentDir, 'index.md'), '---\ntitle: Home\n---\n[About](/about)');
      await builder.build();

      const html = readFileSync(join(outputDir, 'index.html'), 'utf-8');
      expect(html).toContain('href="/about"');
    });
  });
});
