/**
 * Template registry — manages named page templates.
 *
 * Templates are HTML files with {{tag}} placeholders, processed
 * by the tag engine at render time. Content authors select a
 * template via the `Template` frontmatter field.
 *
 * Usage:
 *   const registry = new TemplateRegistry();
 *   registry.register('default', '{{head}}<body>{{content}}</body></html>');
 *   const html = registry.render('default', context);
 *
 * Or load from disk:
 *   const registry = loadTemplatesFromDir('./templates');
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { processTemplate } from './tag-engine.js';
import type { NavItem } from '../components/navigation.js';
import type { FrontmatterData } from '../core/frontmatter.js';
import type { PageType } from '../core/page-metadata.js';

/**
 * Everything a template needs to render a full page.
 */
export interface TemplateContext {
  /** Page title (resolved from frontmatter or config) */
  title: string;
  /** Pre-compiled HTML content from markdown */
  content: string;
  /** Meta description */
  description: string;
  /** Meta keywords (comma-separated string) */
  keywords: string;
  /** URL prefix for subpath hosting, e.g. '/Flint' or '' */
  basePath: string;
  /** Site-wide navigation items */
  navigation: NavItem[];
  /** All unique labels across the site (for LabelFooter) */
  siteLabels: string[];
  /** Raw frontmatter data */
  frontmatter: FrontmatterData;
  /** Additional CSS files to include */
  cssFiles: string[];
  /** Additional JS files to include */
  jsFiles: string[];
  /** Page author */
  author: string;
  /** Page date */
  date: Date | null;
  /** Page category */
  category: string;
  /** Page labels */
  labels: string[];
  /** Page type (page, post, section) */
  type: PageType;
}

/**
 * Registry for managing page templates by name.
 *
 * Templates are stored as raw HTML strings with {{tag}} placeholders.
 * The tag engine resolves them at render time.
 */
export class TemplateRegistry {
  private templates = new Map<string, string>();

  /** Register a template HTML string (overwrites existing with same name). */
  register(name: string, templateHtml: string): void {
    this.templates.set(name, templateHtml);
  }

  /** Get a template's raw HTML by name, or undefined. */
  get(name: string): string | undefined {
    return this.templates.get(name);
  }

  /** Check if a template is registered. */
  has(name: string): boolean {
    return this.templates.has(name);
  }

  /** List all registered template names in insertion order. */
  names(): string[] {
    return [...this.templates.keys()];
  }

  /** Render a page using the named template. Throws if not registered. */
  render(name: string, context: TemplateContext): string {
    const templateHtml = this.templates.get(name);
    if (!templateHtml) {
      throw new Error(`Template "${name}" is not registered. Available: ${this.names().join(', ')}`);
    }
    return processTemplate(templateHtml, context);
  }
}

/**
 * Load all .html template files from a directory into a new registry.
 * Each file's basename (without .html) becomes the template name.
 */
export function loadTemplatesFromDir(dir: string): TemplateRegistry {
  const registry = new TemplateRegistry();

  if (!existsSync(dir)) {
    return registry;
  }

  const files = readdirSync(dir);
  for (const file of files) {
    if (file.endsWith('.html')) {
      const name = basename(file, '.html');
      const content = readFileSync(join(dir, file), 'utf-8');
      registry.register(name, content);
    }
  }

  return registry;
}

/**
 * Overlay .html template files from a theme directory onto an existing registry.
 * Only files present in the theme directory are overwritten; the rest are kept.
 * Silently skips if the directory does not exist.
 */
export function overlayTemplatesFromDir(dir: string, registry: TemplateRegistry): void {
  if (!existsSync(dir)) {
    return;
  }

  const files = readdirSync(dir);
  for (const file of files) {
    if (file.endsWith('.html')) {
      const name = basename(file, '.html');
      const content = readFileSync(join(dir, file), 'utf-8');
      registry.register(name, content);
    }
  }
}
