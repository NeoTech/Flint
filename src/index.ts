// Main entry point for the application
// This file is bundled by Rspack and includes HTMX

import 'htmx.org';
import 'flint-theme-styles';

// --- Cart queue stub ---
// Provides window.CartAPI stub + queue so product fragments can call
// addItem() immediately, even before the full CartAPI initialises.
// The real cart-hydrate module drains the queue on DOMContentLoaded.
declare global {
  interface Window {
    htmx: typeof import('htmx.org');
    __flintCartQueue: Array<[string, unknown[]]>;
    __FLINT_CONFIG__: { stripePublishableKey: string; siteUrl: string };
    CartAPI: any;
    queueCartCall: (name: string, ...args: unknown[]) => void;
  }
}

(function initCartStub() {
  if (typeof window === 'undefined') return;
  if (window.__flintCartQueue) return;          // already initialised
  window.__flintCartQueue = [];
  window.__FLINT_CONFIG__ = window.__FLINT_CONFIG__ || { stripePublishableKey: '', siteUrl: '' };
  window.queueCartCall = function (name: string, ...args: unknown[]) {
    window.__flintCartQueue.push([name, args]);
  };
  // Lightweight stub — replaced by real CartAPI when cart-hydrate loads
  if (!window.CartAPI || window.CartAPI._isStub) {
    window.CartAPI = {
      _isStub: true,
      addItem(id: string, qty = 1) { window.queueCartCall('addItem', id, qty); return Promise.resolve([]); },
      removeItem(id: string) { window.queueCartCall('removeItem', id); return Promise.resolve([]); },
      clear() { window.queueCartCall('clear'); return Promise.resolve(); },
      getItems() { return Promise.resolve([]); },
    };
  }
})();

// Client-side hydration modules (bundled by rspack)
import './client/cart-hydrate.js';
import './client/product-hydrate.js';
import { initNavToggle } from './client/nav-toggle.js';

// Initialise navigation toggle on DOMContentLoaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavToggle);
  } else {
    initNavToggle();
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
// Base path for GitHub Pages subpath hosting (read from <meta name="base-path"> at runtime)
function getBasePath(): string {
  return document.querySelector('meta[name="base-path"]')?.getAttribute('content') || '';
}

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

  const response = await fetch(`${getBasePath()}/fragments/page-index.json`);
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
    window.location.href = `${getBasePath()}/label/${labelSlug(label)}`;
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
