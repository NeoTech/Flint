// Main entry point for the application
// This file is bundled by Rspack and includes HTMX

import 'htmx.org';
import './styles/main.css';

// Make htmx available globally
declare global {
  interface Window {
    htmx: typeof import('htmx.org');
  }
}

// --- Page Index types (mirrors PageIndexEntry from page-index.ts) ---
interface PageIndexEntry {
  url: string;
  title: string;
  description: string;
  labels: string[];
  category: string;
  date: string | null;
}

// --- Label Router ---
// Cached page index — fetched once, reused for all label clicks
let pageIndexCache: PageIndexEntry[] | null = null;

/**
 * Generate a URL-friendly slug from a label name.
 * Must match the server-side generateLabelSlug() exactly.
 */
function labelSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Fetch and cache the page index JSON.
 */
async function getPageIndex(): Promise<PageIndexEntry[]> {
  if (pageIndexCache) return pageIndexCache;

  const response = await fetch('/fragments/page-index.json');
  if (!response.ok) {
    console.warn('Failed to load page index:', response.statusText);
    return [];
  }

  pageIndexCache = (await response.json()) as PageIndexEntry[];
  return pageIndexCache;
}

/**
 * Handle a label click: fetch the index, filter by label,
 * then navigate directly (1 match) or to the label index page (2+ matches).
 */
async function handleLabelClick(label: string): Promise<void> {
  const index = await getPageIndex();
  const matches = index.filter(entry => entry.labels.includes(label));

  if (matches.length === 1) {
    // Single match — go directly to the page
    window.location.href = matches[0].url;
  } else if (matches.length > 1) {
    // Multiple matches — navigate to the label index page
    window.location.href = `/label/${labelSlug(label)}`;
  }
  // 0 matches — do nothing
}

// Initialize HTMX and label router
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Static site loaded with HTMX');
  
  // Configure HTMX defaults
  if (window.htmx) {
    window.htmx.config.defaultSwapStyle = 'innerHTML';
    window.htmx.config.defaultSwapDelay = 0;
  }

  // Label router: delegate clicks on .label-link elements
  document.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('.label-link');
    if (!target) return;

    e.preventDefault();
    const label = (target as HTMLElement).dataset.label;
    if (label) {
      handleLabelClick(label);
    }
  });
});

// Export for module usage
export {};
