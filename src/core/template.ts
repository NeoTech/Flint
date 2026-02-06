import { MarkdownCompiler } from './markdown.js';
import { Layout } from '../components/layout.js';
import { Navigation, type NavItem } from '../components/navigation.js';
import type { FrontmatterData } from './frontmatter.js';

export interface PageData {
  title: string;
  content: string;
  path: string;
  description?: string;
  keywords?: string;
  frontmatter?: FrontmatterData;
  navigation?: NavItem[];
  layout?: string;
  cssFiles?: string[];
  jsFiles?: string[];
    siteLabels?: string[];
}

export interface ProcessedMarkdown {
  html: string;
  data: FrontmatterData;
  path: string;
}

export type ComponentFunction<P = Record<string, unknown>> = (props: P) => string;

/**
 * Template engine for rendering pages
 * Combines markdown content with components and layouts
 */
export class TemplateEngine {
  private compiler: MarkdownCompiler;
  private components: Map<string, ComponentFunction>;

  constructor() {
    this.compiler = new MarkdownCompiler();
    this.components = new Map();
  }

  /**
   * Render a complete page with layout
   */
  renderPage(data: PageData): string {
    const {
      title,
      content,
      path,
      description,
      keywords,
      frontmatter = {},
      navigation,
      cssFiles = [],
      jsFiles = [],
      siteLabels = [],
    } = data;

    // Use frontmatter title if available, otherwise use provided title
    const pageTitle = (frontmatter.title as string) || title;
    const pageDescription = (frontmatter.description as string) || description;
    const pageKeywords = keywords || (Array.isArray(frontmatter.Keywords)
      ? (frontmatter.Keywords as string[]).join(', ')
      : (frontmatter.Keywords as string | undefined));

    // Build page structure - content is already HTML
    let pageContent = content;

    // Add navigation if provided
    if (navigation && navigation.length > 0) {
      const navHtml = Navigation.render({ items: navigation });
      pageContent = navHtml + '\n<main class="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">' + content + '</main>';
    } else {
      pageContent = '<main class="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">' + content + '</main>';
    }

    // Render full layout
    return Layout.render({
      title: pageTitle,
      description: pageDescription,
      keywords: pageKeywords,
      children: pageContent,
      cssFiles,
      jsFiles,
      siteLabels,
    });
  }

  /**
   * Render markdown as partial HTML (no layout)
   */
  renderPartial(markdown: string): string {
    if (!markdown.trim()) {
      return '';
    }
    return this.compiler.compile(markdown);
  }

  /**
   * Process markdown with frontmatter extraction
   */
  processMarkdown(markdown: string, path: string): ProcessedMarkdown {
    const result = this.compiler.compileWithFrontmatter(markdown);
    
    return {
      html: result.html,
      data: result.data,
      path,
    };
  }

  /**
   * Register a custom component
   */
  registerComponent<P>(name: string, component: ComponentFunction<P>): void {
    this.components.set(name, component as ComponentFunction);
  }

  /**
   * Check if a component is registered
   */
  hasComponent(name: string): boolean {
    return this.components.has(name);
  }

  /**
   * Render a registered component
   */
  renderComponent<P>(name: string, props: P): string {
    const component = this.components.get(name);
    if (!component) {
      throw new Error(`Component "${name}" is not registered`);
    }
    return component(props as Record<string, unknown>);
  }
}

/**
 * Create a default template engine instance
 */
export function createTemplateEngine(): TemplateEngine {
  return new TemplateEngine();
}
