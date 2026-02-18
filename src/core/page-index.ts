/**
 * Static page index generator.
 *
 * Produces a compact JSON array describing every page on the site.
 * Written to dist/fragments/page-index.json at build time and fetched
 * by the client-side label router to enable zero-API label navigation.
 */

import type { PageMetadata } from './page-metadata.js';

export interface PageIndexEntry {
  url: string;
  title: string;
  description: string;
  labels: string[];
  category: string;
  date: string | null;
  type?: string;
}

/**
 * Generate a URL-friendly slug from a label name.
 */
export function generateLabelSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Format a Date as YYYY-MM-DD using UTC, or return null.
 */
function formatDate(date: Date | null): string | null {
  if (!date) return null;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Generate the page index array from collected page metadata + URLs.
 * Each entry in `pages` must include a `url` property added by the builder.
 */
export function generatePageIndex(
  pages: (PageMetadata & { url: string })[],
): PageIndexEntry[] {
  return pages.map(page => ({
    url: page.url,
    title: page.title,
    description: page.description,
    labels: page.labels,
    category: page.category,
    date: formatDate(page.date),
    type: page.type,
  }));
}
