import { readdirSync } from 'fs';
import { join } from 'path';
import type { TemplateContext } from './template-registry.js';

export interface TagDef {
  /** Exact tag name to match (e.g. 'feature-grid'). */
  tag?: string;
  /** Wildcard matcher for dynamic tags (e.g. 'media:N'). */
  matchTag?: (name: string) => boolean;
  /** Render the tag given the current template context and resolved tag name. */
  resolve: (ctx: TemplateContext, tagName: string) => string;
  /** Optional frontmatter key this tag reads from (for manager UI). */
  frontmatterKey?: string;
  /** Optional TypeScript interface name for props (for manager UI). */
  interfaceName?: string;
  /** Human-readable label for the component browser. */
  label: string;
  /** Emoji / icon string for the component browser. */
  icon: string;
  /** One-line description shown in the component browser. */
  description: string;
}

export class TagRegistry {
  private exactMap = new Map<string, TagDef>();
  private wildcards: TagDef[] = [];

  /** Register one or more TagDefs. Exact tags are indexed; wildcards appended. */
  register(defs: TagDef[]): void {
    for (const def of defs) {
      if (def.tag) {
        this.exactMap.set(def.tag, def);
      } else if (def.matchTag) {
        this.wildcards.push(def);
      }
    }
  }

  /**
   * Resolve a tag name to rendered HTML.
   * Exact match wins over wildcard. Returns null when no match is found.
   */
  resolve(tagName: string, ctx: TemplateContext): string | null {
    const exact = this.exactMap.get(tagName);
    if (exact) return exact.resolve(ctx, tagName);

    for (const def of this.wildcards) {
      if (def.matchTag!(tagName)) return def.resolve(ctx, tagName);
    }

    return null;
  }

  /** Remove all registered definitions. */
  clear(): void {
    this.exactMap.clear();
    this.wildcards = [];
  }

  /** Return all registered definitions (exact first, then wildcards). */
  all(): TagDef[] {
    return [...this.exactMap.values(), ...this.wildcards];
  }

  /**
   * Scan a directory for component files, import each one, and register
   * any exported `tagDefs` arrays.  Clears existing registrations first.
   *
   * Files matching `*.test.*` are skipped.
   */
  async discover(componentDir: string): Promise<void> {
    this.clear();

    let files: string[];
    try {
      files = readdirSync(componentDir);
    } catch {
      return; // Directory doesn't exist — no components to register.
    }

    const candidates = files.filter(
      (f) =>
        (f.endsWith('.ts') || f.endsWith('.js')) &&
        !f.includes('.test.')
    );

    for (const file of candidates) {
      try {
        const mod = await import(join(componentDir, file));
        if (Array.isArray(mod.tagDefs)) {
          this.register(mod.tagDefs as TagDef[]);
        }
      } catch {
        // Skip files that fail to import (e.g. missing deps in test env).
      }
    }
  }
}

/** Singleton registry used throughout the build pipeline. */
export const registry = new TagRegistry();
