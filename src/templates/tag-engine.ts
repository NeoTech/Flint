/**
 * Tag-based template engine.
 *
 * Processes HTML template files containing {{tag}} placeholders
 * and {{#if tag}}...{{/if}} conditional blocks.
 *
 * Built-in tags:
 *   {{head}}           — <head> section with meta tags, title, CSS
 *   {{navigation}}     — site navigation bar
 *   {{content}}        — pre-compiled page content
 *   {{label-footer}}   — site-wide label cloud footer
 *   {{foot-scripts}}   — closing <script> tags
 *   {{blog-header}}    — article header with byline, reading time
 *   {{title}}          — page title text
 *   {{description}}    — meta description text
 *   {{keywords}}       — meta keywords text
 *   {{author}}         — page author text
 *   {{category}}       — page category text
 *   {{basePath}}       — URL base path prefix
 *   {{formatted-date}} — human-readable date
 *   {{reading-time}}   — estimated reading time
 *   {{category-pill}}  — category badge HTML
 *   {{label-badges}}   — label badges HTML
 *   {{gadget}}         — interactive demo widget
 *   {{cart}}           — shopping cart widget (hydrated client-side)
 *   {{product}}        — demo product card with Add-to-Cart button
 */

import { Navigation } from '../components/navigation.js';
import { LabelFooter } from '../components/label-footer.js';
import { Gadget } from '../components/gadget.js';
import { Cart } from '../components/cart.js';
import { Product } from '../components/product.js';
import { renderHead, renderFootScripts } from './helpers.js';
import type { TemplateContext } from './template-registry.js';

/**
 * Estimate reading time from HTML content.
 * Strips tags, counts words, divides by ~200 WPM.
 */
export function estimateReadingTime(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ');
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  return Math.max(1, Math.round(words / 200));
}

/**
 * Format a Date as a human-readable string (e.g. "February 1, 2026").
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Resolve a tag name to its HTML string value.
 * Unknown tags pass through unchanged as {{tagName}}.
 */
export function resolveTag(tagName: string, ctx: TemplateContext): string {
  switch (tagName) {
    case 'head':
      return renderHead({
        title: ctx.title,
        basePath: ctx.basePath,
        description: ctx.description,
        keywords: ctx.keywords,
        cssFiles: ctx.cssFiles,
        jsFiles: ctx.jsFiles,
      });

    case 'navigation':
      return ctx.navigation.length > 0
        ? Navigation.render({ items: ctx.navigation })
        : '';

    case 'content':
      return ctx.content;

    case 'label-footer':
      return ctx.siteLabels.length > 0
        ? LabelFooter.render({ labels: ctx.siteLabels })
        : '';

    case 'foot-scripts':
      return renderFootScripts(ctx.basePath);

    case 'blog-header': {
      const readTime = estimateReadingTime(ctx.content);

      const bylineParts: string[] = [];
      if (ctx.author) {
        bylineParts.push(`<span class="byline">${ctx.author}</span>`);
      }
      if (ctx.date) {
        const iso = ctx.date.toISOString().slice(0, 10);
        bylineParts.push(`<time datetime="${iso}">${formatDate(ctx.date)}</time>`);
      }
      bylineParts.push(`<span class="reading-time">${readTime} min read</span>`);

      const bylineHtml = bylineParts.length > 0
        ? `<div class="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-2">${bylineParts.join(' · ')}</div>`
        : '';

      const categoryHtml = ctx.category
        ? `<span class="inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">${ctx.category}</span>`
        : '';

      const labelsHtml = ctx.labels.length > 0
        ? `<div class="flex flex-wrap gap-2 mt-3">${ctx.labels.map(l =>
            `<span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">${l}</span>`
          ).join('')}</div>`
        : '';

      return `<header class="mb-8 border-b border-gray-200 pb-6">
        ${categoryHtml}
        <h1 class="text-3xl font-bold text-gray-900 mt-2">${ctx.title}</h1>
        ${bylineHtml}
        ${labelsHtml}
      </header>`;
    }

    // Scalar context values
    case 'title':
      return ctx.title;
    case 'description':
      return ctx.description;
    case 'keywords':
      return ctx.keywords;
    case 'author':
      return ctx.author;
    case 'category':
      return ctx.category;
    case 'basePath':
      return ctx.basePath;

    case 'formatted-date':
      return ctx.date ? formatDate(ctx.date) : '';

    case 'reading-time':
      return `${estimateReadingTime(ctx.content)} min read`;

    case 'category-pill':
      return ctx.category
        ? `<span class="inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">${ctx.category}</span>`
        : '';

    case 'label-badges':
      return ctx.labels.length > 0
        ? ctx.labels.map(l =>
            `<span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">${l}</span>`
          ).join('')
        : '';

    case 'gadget':
      return Gadget.render({});

    case 'product':
      return Product.render({
        id: 'blue-mug',
        title: 'Blue Ceramic Mug',
        price: '$12.00',
        description: 'A beautiful hand-crafted ceramic mug, perfect for your morning coffee.',
      });

    case 'cart':
      return Cart.render({});

    default:
      return `{{${tagName}}}`;
  }
}

/**
 * Check whether a tag's resolved value is "truthy" for {{#if}} blocks.
 */
export function isTagTruthy(tagName: string, ctx: TemplateContext): boolean {
  return resolveTag(tagName, ctx).length > 0;
}

/**
 * Process an HTML template string, resolving all tags and conditionals.
 *
 * 1. Resolve {{#if tag}}...{{/if}} conditional blocks
 * 2. Replace all remaining {{tag}} placeholders with resolved values
 */
export function processTemplate(template: string, ctx: TemplateContext): string {
  // Step 1: Resolve conditionals — {{#if tagName}}...{{/if}}
  let result = template.replace(
    /\{\{#if\s+(\S+?)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, tagName: string, block: string) => {
      return isTagTruthy(tagName, ctx) ? block : '';
    },
  );

  // Step 2: Replace all remaining {{tag}} placeholders
  result = result.replace(
    /\{\{(\S+?)\}\}/g,
    (_match, tagName: string) => resolveTag(tagName, ctx),
  );

  return result;
}
