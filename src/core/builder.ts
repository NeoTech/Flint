import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname, extname, basename, relative } from 'path';
import { TemplateEngine } from './template.js';
import type { NavItem } from '../components/navigation.js';
import type { FrontmatterData } from './frontmatter.js';
import { parsePageMetadata } from './page-metadata.js';

export interface BuildConfig {
  contentDir: string;
  outputDir: string;
  navigation?: NavItem[];
  defaultTitle?: string;
}

export interface ContentFile {
  path: string;
  relativePath: string;
  name: string;
}

export interface ProcessedFile {
  html: string;
  data: FrontmatterData;
  outputPath: string;
}

/**
 * Site builder - orchestrates the build process
 * Scans content, processes markdown, and outputs HTML files
 */
export class SiteBuilder {
  private config: BuildConfig;
  private templateEngine: TemplateEngine;

  constructor(config: BuildConfig) {
    this.config = config;
    this.templateEngine = new TemplateEngine();
  }

  /**
   * Scan content directory for markdown files
   */
  scanContent(dir: string = this.config.contentDir, baseDir: string = this.config.contentDir): ContentFile[] {
    const files: ContentFile[] = [];

    if (!existsSync(dir)) {
      return files;
    }

    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relativePath = relative(baseDir, fullPath);

      if (entry.isDirectory()) {
        files.push(...this.scanContent(fullPath, baseDir));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push({
          path: fullPath,
          relativePath,
          name: entry.name,
        });
      }
    }

    return files;
  }

  /**
   * Process a single markdown file
   */
  processFile(content: string, relativePath: string): ProcessedFile {
    const result = this.templateEngine.processMarkdown(content, relativePath);
    const outputPath = this.getOutputPath(relativePath);

    return {
      html: result.html,
      data: result.data,
      outputPath,
    };
  }

  /**
   * Convert markdown path to HTML output path
   * Creates clean URLs: about.md -> about/index.html
   */
  private getOutputPath(relativePath: string): string {
    const ext = extname(relativePath);
    const base = relativePath.slice(0, -ext.length).replace(/\\/g, '/');
    
    // Any index.md stays as <dir>/index.html (not <dir>/index/index.html)
    if (base === 'index' || base.endsWith('/index')) {
      return `${base}.html`;
    }
    
    return `${base}/index.html`;
  }

  /**
   * Build the entire site
   */
  async build(): Promise<void> {
    // Ensure output directory exists
    mkdirSync(this.config.outputDir, { recursive: true });

    // Scan for content files
    const contentFiles = this.scanContent();

    // Generate navigation from root-level pages
    const navigation = this.generateNavigation(contentFiles);

    // Process each file
    for (const file of contentFiles) {
      const content = readFileSync(file.path, 'utf-8');
      const processed = this.processFile(content, file.relativePath);

      // Build navigation with active state
      const navWithActive = navigation?.map((item: NavItem) => ({
        ...item,
        active: this.isActivePath(item.href, file.relativePath),
      }));

      // Render full page
      const title = (processed.data.title as string) || this.config.defaultTitle || 'Untitled';
      const description = processed.data.description as string | undefined;

      const pageHtml = this.templateEngine.renderPage({
        title,
        description,
        content: processed.html,
        path: file.relativePath,
        frontmatter: processed.data,
        navigation: navWithActive,
      });

      // Write output file
      const outputPath = join(this.config.outputDir, processed.outputPath);
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, pageHtml, 'utf-8');
    }
  }

  /**
   * Generate navigation from root-level pages
   */
  private generateNavigation(contentFiles: ContentFile[]): NavItem[] {
    const navItems: NavItem[] = [];

    for (const file of contentFiles) {
      try {
        const content = readFileSync(file.path, 'utf-8');
        const metadata = parsePageMetadata(content);

        // Only include pages with Parent: root or no parent
        if (metadata.parent === 'root' || metadata.parent === null) {
          const href = this.getUrlPath(file.relativePath);
          navItems.push({
            label: metadata.title || file.name.replace(/\.md$/, ''),
            href,
            order: metadata.order,
          });
        }
      } catch (error) {
        // Skip files that can't be parsed
        continue;
      }
    }

    // Sort by order first, then by title for same order
    navItems.sort((a, b) => {
      const orderDiff = (a.order ?? 999) - (b.order ?? 999);
      if (orderDiff !== 0) return orderDiff;
      return a.label.localeCompare(b.label);
    });

    return navItems;
  }

  /**
   * Get URL path from file path
   */
  private getUrlPath(relativePath: string): string {
    // Remove .md extension and convert to URL path
    let urlPath = relativePath.replace(/\.md$/, '').replace(/\\/g, '/');
    
    // Handle index files — strip the /index part, keep the directory
    if (urlPath === 'index') {
      return '/';
    }
    if (urlPath.endsWith('/index')) {
      urlPath = urlPath.slice(0, -'/index'.length);
    }
    
    // Ensure leading slash
    if (!urlPath.startsWith('/')) {
      urlPath = '/' + urlPath;
    }
    
    return urlPath;
  }

  /**
   * Determine if a nav item is active for the current path
   */
  private isActivePath(href: string, filePath: string): boolean {
    // Convert file path to URL path
    const urlPath = '/' + filePath.replace(/\.md$/, '.html').replace(/\\/g, '/');
    
    // Handle index pages
    if (href === '/') {
      return urlPath === '/index.html' || filePath === 'index.md';
    }
    
    return urlPath.startsWith(href + '/') || urlPath === href + '.html';
  }
}

/**
 * Create a site builder with configuration
 */
export function createBuilder(config: BuildConfig): SiteBuilder {
  return new SiteBuilder(config);
}
