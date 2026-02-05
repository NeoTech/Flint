import { marked, type MarkedOptions } from 'marked';
import { parseFrontmatter, stringifyFrontmatter, type FrontmatterData } from './frontmatter.js';
import { processHtmxMarkdown } from './htmx-markdown.js';
import { extractHtmlBlocks, restoreHtmlBlocks } from './html-blocks.js';

export interface MarkdownCompilerOptions {
  allowHtml?: boolean;
  gfm?: boolean;
  breaks?: boolean;
}

export interface CompiledMarkdown {
  html: string;
  data: FrontmatterData;
}

/**
 * Markdown compiler using marked
 * Supports frontmatter parsing and HTML sanitization options
 */
export class MarkdownCompiler {
  private options: MarkedOptions;
  private allowHtml: boolean;

  constructor(options: MarkdownCompilerOptions = {}) {
    this.allowHtml = options.allowHtml ?? true;
    this.options = {
      gfm: options.gfm ?? true,
      breaks: options.breaks ?? false,
    };
  }

  /**
   * Compile markdown string to HTML
   */
  compile(markdown: string): string {
    try {
      // Extract :::html blocks before any processing
      const { markdown: withoutBlocks, blocks } = extractHtmlBlocks(markdown);

      // Process HTMX attribute syntax before marked compilation
      // Converts [text](url){hx-attrs} to proper HTML elements
      const preprocessed = processHtmxMarkdown(withoutBlocks);

      // Create a custom renderer for this compilation
      const renderer = new marked.Renderer();
      
      // If HTML is not allowed, escape it
      if (!this.allowHtml) {
        renderer.html = ({ text }: { text: string }) => {
          return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        };
      }

      // Parse with instance-specific options
      const compiled = marked.parse(preprocessed, { 
        async: false,
        gfm: this.options.gfm,
        breaks: this.options.breaks,
        renderer,
      }) as string;

      // Restore raw HTML blocks
      return restoreHtmlBlocks(compiled, blocks);
    } catch (error) {
      throw new Error(`Failed to compile markdown: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Compile markdown with frontmatter extraction
   */
  compileWithFrontmatter(markdown: string): CompiledMarkdown {
    const { data, content } = parseFrontmatter(markdown);
    const html = this.compile(content);

    return {
      html,
      data,
    };
  }

  /**
   * Compile markdown to HTML with frontmatter (returns full string with frontmatter)
   */
  stringify(data: FrontmatterData, html: string): string {
    // Convert HTML back to markdown-like content for storage
    // This is a simplified version - in practice you might want to keep original markdown
    return stringifyFrontmatter(data, html);
  }
}

/**
 * Create a default compiler instance
 */
export function createCompiler(options?: MarkdownCompilerOptions): MarkdownCompiler {
  return new MarkdownCompiler(options);
}
