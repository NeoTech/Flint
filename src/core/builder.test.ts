import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { SiteBuilder, type BuildConfig, type ContentFile } from './builder.js';

describe('SiteBuilder', () => {
  let tempDir: string;
  let contentDir: string;
  let outputDir: string;
  let builder: SiteBuilder;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'site-builder-test-'));
    contentDir = join(tempDir, 'content');
    outputDir = join(tempDir, 'dist');
    mkdirSync(contentDir, { recursive: true });
    
    const config: BuildConfig = {
      contentDir,
      outputDir,
      navigation: [
        { label: 'Home', href: '/' },
        { label: 'About', href: '/about' },
      ],
    };
    
    builder = new SiteBuilder(config);
  });

  afterEach(() => {
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

    it('should handle nested paths with clean URLs', () => {
      const result = builder.processFile('# Blog Post', 'blog/post.md');
      expect(result.outputPath).toBe('blog/post/index.html');
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

    it('should preserve directory structure', async () => {
      const blogDir = join(contentDir, 'blog');
      mkdirSync(blogDir, { recursive: true });
      
      writeFileSync(join(blogDir, 'post.md'), '# Blog Post');
      
      await builder.build();
      
      expect(existsSync(join(outputDir, 'blog', 'post', 'index.html'))).toBe(true);
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
      const files = readdirSync(outputDir);
      expect(files).toHaveLength(0);
    });

    it('should build subdirectory index pages correctly', async () => {
      const blogDir = join(contentDir, 'blog');
      mkdirSync(blogDir, { recursive: true });

      writeFileSync(join(contentDir, 'index.md'), '---\ntitle: Home\nShort-URI: home\nParent: root\nOrder: 1\n---\n# Home');
      writeFileSync(join(blogDir, 'index.md'), '---\ntitle: Blog\nShort-URI: blog\nParent: root\nOrder: 2\n---\n# Blog');
      writeFileSync(join(blogDir, 'post.md'), '---\ntitle: Post\nParent: blog\n---\n# A Post');

      await builder.build();

      // Blog index should be at blog/index.html, NOT blog/index/index.html
      expect(existsSync(join(outputDir, 'blog', 'index.html'))).toBe(true);
      expect(existsSync(join(outputDir, 'blog', 'index', 'index.html'))).toBe(false);

      // Blog post should be at blog/post/index.html
      expect(existsSync(join(outputDir, 'blog', 'post', 'index.html'))).toBe(true);

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
      // Should contain links to child pages
      expect(blogIndex).toContain('/blog/post1');
      expect(blogIndex).toContain('/blog/post2');
      // Should contain descriptions
      expect(blogIndex).toContain('A first blog post');
      expect(blogIndex).toContain('A second blog post');
    });
  });

  describe('getOutputPath', () => {
    it('should convert md to folder with index.html', () => {
      const result = (builder as unknown as { getOutputPath: (path: string) => string }).getOutputPath('page.md');
      expect(result).toBe('page/index.html');
    });

    it('should handle nested paths with clean URLs', () => {
      const result = (builder as unknown as { getOutputPath: (path: string) => string }).getOutputPath('blog/post.md');
      expect(result).toBe('blog/post/index.html');
    });

    it('should handle subdirectory index.md as directory index', () => {
      const result = (builder as unknown as { getOutputPath: (path: string) => string }).getOutputPath('blog/index.md');
      expect(result).toBe('blog/index.html');
    });

    it('should handle deeply nested index.md', () => {
      const result = (builder as unknown as { getOutputPath: (path: string) => string }).getOutputPath('blog/tutorials/index.md');
      expect(result).toBe('blog/tutorials/index.html');
    });
  });
});
