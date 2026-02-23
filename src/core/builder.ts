import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname, relative } from 'path';
import { MarkdownCompiler } from './markdown.js';
import type { NavItem } from '../components/navigation.js';
import { parseFrontmatter, type FrontmatterData } from './frontmatter.js';
import { parsePageMetadata, type PageMetadata } from './page-metadata.js';
import { processChildrenDirectives, type ChildPageData } from './children-directive.js';
import { generatePageIndex, generateLabelSlug, type PageIndexEntry } from './page-index.js';
import { generateSitemap, generateRobotsTxt, generateLlmsTxt } from './seo.js';
import { rewriteAbsolutePaths } from './base-path.js';
import { LabelIndex } from '../components/label-index.js';
import { loadTemplatesFromDir, overlayTemplatesFromDir, type TemplateContext } from '../templates/index.js';
import type { TemplateRegistry } from '../templates/template-registry.js';
import { registry } from '../templates/tag-registry.js';

export interface BuildConfig {
  contentDir: string;
  outputDir: string;
  templatesDir?: string;
  /** Active theme name — must match a subdirectory under themes/. Defaults to 'default'. */
  theme?: string;
  navigation?: NavItem[];
  defaultTitle?: string;
  siteUrl?: string;
  siteDescription?: string;
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
  private compiler: MarkdownCompiler;
  private templateRegistry: TemplateRegistry;

  constructor(config: BuildConfig) {
    this.config = config;
    this.compiler = new MarkdownCompiler();
    const root = dirname(config.contentDir);
    const defaultTemplatesDir = join(root, 'themes', 'default', 'templates');
    const templatesDir = config.templatesDir || defaultTemplatesDir;
    this.templateRegistry = loadTemplatesFromDir(templatesDir);
    // Overlay theme-specific templates (only if theme is not 'default')
    const theme = config.theme || 'default';
    if (theme !== 'default') {
      const themeTemplatesDir = join(root, 'themes', theme, 'templates');
      overlayTemplatesFromDir(themeTemplatesDir, this.templateRegistry);
    }
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
    const result = this.compiler.compileWithFrontmatter(content);

    // Parse Short-URI to determine output path; fall back to filename stem
    let shortUri = '';
    try {
      const metadata = parsePageMetadata(content);
      shortUri = metadata.shortUri;
    } catch {
      const normPath = relativePath.replace(/\\/g, '/');
      if (normPath.endsWith('/index.md')) {
        shortUri = normPath.slice(0, -'/index.md'.length).split('/').pop() || '';
      } else {
        shortUri = normPath.replace(/\.md$/, '').split('/').pop() || '';
      }
    }

    const outputPath = this.getOutputPath(shortUri, relativePath);
    return { html: result.html, data: result.data, outputPath };
  }

  /**
   * Convert a Short-URI + relative path to an HTML output path.
   * The shortUri drives the output directory; relativePath is used only
   * to detect the root index (content/index.md → dist/index.html).
   * Falls back to the filename stem when shortUri is empty.
   */
  private getOutputPath(shortUri: string, relativePath: string): string {
    const normPath = relativePath.replace(/\\/g, '/');

    // Root index.md is always the site root
    if (normPath === 'index.md') return 'index.html';

    let slug = shortUri;
    if (!slug) {
      // Fall back: for **/index.md use the directory name, otherwise the file stem
      if (normPath.endsWith('/index.md')) {
        slug = normPath.slice(0, -'/index.md'.length).split('/').pop() || normPath;
      } else {
        slug = normPath.replace(/\.md$/, '').split('/').pop() || normPath.replace(/\.md$/, '');
      }
    }

    return `${slug}/index.html`;
  }

  /**
   * Build the entire site
   */
  async build(): Promise<void> {
    // Discover and register component tagDefs before processing templates
    await registry.discover(join(import.meta.dir, '../components'));

    // Ensure output directory exists
    mkdirSync(this.config.outputDir, { recursive: true });

    // Scan for content files
    const contentFiles = this.scanContent();

    // Generate navigation from root-level pages
    const navigation = this.generateNavigation(contentFiles);

    // Collect children metadata for :::children directive resolution
    const childrenMap = this.collectChildrenMap(contentFiles);

    // Collect all unique labels across every page for the site-wide footer
    const siteLabels = this.collectSiteLabels(contentFiles);

    // Process each file
    for (const file of contentFiles) {
      let content = readFileSync(file.path, 'utf-8');

      // Resolve :::children directives before markdown compilation
      if (content.includes(':::children')) {
        try {
          const { data } = parseFrontmatter(content);
          const shortUri = data['Short-URI'] as string;
          if (shortUri) {
            const children = childrenMap.get(shortUri) || [];
            content = processChildrenDirectives(content, children);
          }
        } catch {
          // Continue with unprocessed content if frontmatter parsing fails
        }
      }

      const processed = this.processFile(content, file.relativePath);

      // Parse page metadata for template selection and URL determination
      let templateName = 'default';
      let pageShortUri = '';
      try {
        const metadata = parsePageMetadata(content);
        templateName = metadata.template;
        pageShortUri = metadata.shortUri;
      } catch {
        // Fall back: derive slug from filename
        const normPath = file.relativePath.replace(/\\/g, '/');
        if (normPath.endsWith('/index.md')) {
          pageShortUri = normPath.slice(0, -'/index.md'.length).split('/').pop() || '';
        } else {
          pageShortUri = normPath.replace(/\.md$/, '').split('/').pop() || '';
        }
      }
      const currentUrl = this.getUrlPath(pageShortUri, file.relativePath);

      // Build navigation with active state
      const navWithActive = navigation?.map((item: NavItem) => ({
        ...item,
        active: item.href === currentUrl,
      }));

      // Render full page
      const title = (processed.data.title as string) || this.config.defaultTitle || 'Untitled';
      const description = (processed.data.Description as string)
        || (processed.data.description as string)
        || undefined;
      const keywords = Array.isArray(processed.data.Keywords)
        ? (processed.data.Keywords as string[]).join(', ')
        : (processed.data.Keywords as string | undefined)
          || (Array.isArray(processed.data.keywords)
            ? (processed.data.keywords as string[]).join(', ')
            : (processed.data.keywords as string | undefined));

      const basePath = process.env.BASE_PATH || '';

      // Build template context
      const context: TemplateContext = {
        title,
        content: processed.html,
        description: description || '',
        keywords: keywords || '',
        basePath,
        navigation: navWithActive || [],
        siteLabels,
        frontmatter: processed.data,
        cssFiles: [],
        jsFiles: [],
        author: (processed.data.Author as string) || '',
        date: processed.data.Date ? new Date(processed.data.Date as string) : null,
        category: (processed.data.Category as string) || '',
        labels: Array.isArray(processed.data.Labels) ? (processed.data.Labels as string[]) : [],
        type: ((processed.data.Type as string) || 'page') as TemplateContext['type'],
      };

      // Render with the selected template (fall back to 'default' if not found)
      const resolvedTemplate = this.templateRegistry.has(templateName) ? templateName : 'default';
      const renderedHtml = this.templateRegistry.render(resolvedTemplate, context);

      // Rewrite absolute paths in the full page (content + component + template links)
      const pageHtml = rewriteAbsolutePaths(renderedHtml, basePath);

      // Write output file
      const outputPath = join(this.config.outputDir, processed.outputPath);
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, pageHtml, 'utf-8');
    }

    // Generate static page index (JSON) for client-side label routing
    const allPageMeta = this.collectAllPageMetadata(contentFiles);
    const pageIndex = generatePageIndex(allPageMeta);
    const fragmentsDir = join(this.config.outputDir, 'fragments');
    mkdirSync(fragmentsDir, { recursive: true });
    writeFileSync(
      join(fragmentsDir, 'page-index.json'),
      JSON.stringify(pageIndex),
      'utf-8',
    );

    // Generate label index pages for labels with 2+ pages
    this.generateLabelIndexPages(pageIndex, navigation, siteLabels);

    // Generate product index JSON from Type: product pages
    this.generateProductIndex(allPageMeta);

    // Generate robots.txt and sitemap.xml for SEO
    const basePath = process.env.BASE_PATH || '';
    const siteUrl = this.config.siteUrl || process.env.SITE_URL || '';
    if (siteUrl) {
      writeFileSync(
        join(this.config.outputDir, 'robots.txt'),
        generateRobotsTxt(siteUrl, basePath),
        'utf-8',
      );
      writeFileSync(
        join(this.config.outputDir, 'sitemap.xml'),
        generateSitemap(pageIndex, siteUrl, basePath),
        'utf-8',
      );
      const siteName = this.config.defaultTitle || 'Site';
      const siteDescription = this.config.siteDescription || '';
      writeFileSync(
        join(this.config.outputDir, 'llms.txt'),
        generateLlmsTxt(pageIndex, siteUrl, basePath, siteName, siteDescription),
        'utf-8',
      );
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
          const href = this.getUrlPath(metadata.shortUri, file.relativePath);
          navItems.push({
            label: metadata.title || file.name.replace(/\.md$/, ''),
            href,
            order: metadata.order,
          });
        }
      } catch {
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
   * Collect all page metadata grouped by parent Short-URI.
   * Used to resolve :::children directives at build time.
   */
  private collectChildrenMap(contentFiles: ContentFile[]): Map<string, ChildPageData[]> {
    const childrenMap = new Map<string, ChildPageData[]>();

    for (const file of contentFiles) {
      try {
        const content = readFileSync(file.path, 'utf-8');
        const metadata = parsePageMetadata(content);
        const url = this.getUrlPath(metadata.shortUri, file.relativePath);

        const parent = metadata.parent || 'root';
        if (!childrenMap.has(parent)) {
          childrenMap.set(parent, []);
        }

        childrenMap.get(parent)?.push({
          title: metadata.title,
          url,
          description: metadata.description,
          date: metadata.date,
          category: metadata.category,
          labels: metadata.labels,
          author: metadata.author,
          type: metadata.type,
          shortUri: metadata.shortUri,
          order: metadata.order,
          price: metadata.priceCents ? `$${(metadata.priceCents / 100).toFixed(2)}` : '',
          priceCents: metadata.priceCents,
          currency: metadata.currency,
          stripePriceId: metadata.stripePriceId,
          stripePaymentLink: metadata.stripePaymentLink ?? '',
          image: metadata.image,
        });
      } catch {
        continue;
      }
    }

    return childrenMap;
  }

  /**
   * Collect all unique labels across every content file for the site-wide footer.
   */
  private collectSiteLabels(contentFiles: ContentFile[]): string[] {
    const labelSet = new Set<string>();

    for (const file of contentFiles) {
      try {
        const content = readFileSync(file.path, 'utf-8');
        const metadata = parsePageMetadata(content);
        for (const label of metadata.labels) {
          labelSet.add(label);
        }
      } catch {
        continue;
      }
    }

    return [...labelSet];
  }

  /**
   * Collect page metadata + URL for every content file.
   * Used to build the static page-index.json.
   */
  private collectAllPageMetadata(contentFiles: ContentFile[]): (PageMetadata & { url: string })[] {
    const results: (PageMetadata & { url: string })[] = [];

    for (const file of contentFiles) {
      try {
        const content = readFileSync(file.path, 'utf-8');
        const metadata = parsePageMetadata(content);
        const url = this.getUrlPath(metadata.shortUri, file.relativePath);
        results.push({ ...metadata, url });
      } catch {
        continue;
      }
    }

    return results;
  }

  /**
   * Generate label index pages for labels that appear on 2+ pages.
   * Written to dist/label/<slug>/index.html with full layout.
   */
  private generateLabelIndexPages(
    pageIndex: PageIndexEntry[],
    navigation: NavItem[],
    siteLabels: string[],
  ): void {
    const basePath = process.env.BASE_PATH || '';
    // Group pages by label
    const labelPages = new Map<string, PageIndexEntry[]>();
    for (const entry of pageIndex) {
      for (const label of entry.labels) {
        if (!labelPages.has(label)) {
          labelPages.set(label, []);
        }
        labelPages.get(label)?.push(entry);
      }
    }

    // Only generate pages for labels with 2+ pages
    for (const [label, pages] of labelPages) {
      if (pages.length < 2) continue;

      const slug = generateLabelSlug(label);
      const content = LabelIndex.render({
        label,
        pages: pages.map(p => ({
          url: p.url,
          title: p.title,
          description: p.description,
          category: p.category,
          date: p.date,
        })),
      });

      const labelContext: TemplateContext = {
        title: `Label: ${label}`,
        content,
        description: `All pages tagged with "${label}"`,
        keywords: '',
        basePath,
        navigation,
        siteLabels,
        frontmatter: {},
        cssFiles: [],
        jsFiles: [],
        author: '',
        date: null,
        category: '',
        labels: [],
        type: 'page',
      };

      const renderedHtml = this.templateRegistry.render('default', labelContext);
      const pageHtml = rewriteAbsolutePaths(renderedHtml, basePath);

      const outputPath = join(this.config.outputDir, 'label', slug, 'index.html');
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, pageHtml, 'utf-8');
    }
  }

  /**
   * Generate products/index.json from all Type: product pages.
   * This replaces the manually maintained static/products/index.json.
   * The cart-hydrate module reads this at runtime for prices and Stripe IDs.
   */
  private generateProductIndex(allMeta: (PageMetadata & { url: string })[]): void {
    const products = allMeta.filter(m => m.type === 'product');
    if (products.length === 0) return;

    const index: Record<string, {
      id: string;
      title: string;
      price_cents: number;
      currency: string;
      stripe_price_id: string;
      stripe_payment_link: string;
      description: string;
      url: string;
      image: string;
    }> = {};

    for (const p of products) {
      index[p.shortUri] = {
        id: p.shortUri,
        title: p.title,
        price_cents: p.priceCents,
        currency: p.currency,
        stripe_price_id: p.stripePriceId,
        stripe_payment_link: p.stripePaymentLink ?? '',
        description: p.description,
        url: p.url,
        image: p.image,
      };
    }

    const dir = join(this.config.outputDir, 'static', 'products');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'index.json'),
      JSON.stringify(index, null, 2),
      'utf-8',
    );
  }

  /**
   * Get the URL path for a page from its Short-URI.
   * The shortUri drives the URL; relativePath is used only to detect the
   * root index (content/index.md → '/').
   * Falls back to the filename stem when shortUri is empty.
   */
  private getUrlPath(shortUri: string, relativePath: string): string {
    const basePath = process.env.BASE_PATH || '';
    const normPath = relativePath.replace(/\\/g, '/');

    // Root index.md is always the site root
    if (normPath === 'index.md') return basePath + '/';

    let slug = shortUri;
    if (!slug) {
      if (normPath.endsWith('/index.md')) {
        slug = normPath.slice(0, -'/index.md'.length).split('/').pop() || normPath;
      } else {
        slug = normPath.replace(/\.md$/, '').split('/').pop() || normPath.replace(/\.md$/, '');
      }
    }

    return `${basePath}/${slug}`;
  }
}

/**
 * Create a site builder with configuration
 */
export function createBuilder(config: BuildConfig): SiteBuilder {
  return new SiteBuilder(config);
}
