/**
 * SEO utilities — robots.txt, sitemap.xml, and llms.txt generators.
 *
 * All three are written to the dist root at build time.
 */

import type { PageIndexEntry } from './page-index.js';

/**
 * Generate an /llms.txt file following the llmstxt.org specification.
 *
 * Structure:
 *   # Site name
 *   > Site description
 *
 *   ## Category (one section per category)
 *   - [Page title](url): description
 *
 *   ## Optional  ← blog posts, lower priority for LLM context
 *   - [Post title](url): description
 *
 * Label index pages are excluded (same filter as sitemap).
 * Pages with type ‘post’ are placed in the Optional section.
 */
export function generateLlmsTxt(
  pages: PageIndexEntry[],
  siteUrl: string,
  basePath: string = '',
  siteName: string = 'Site',
  siteDescription: string = '',
): string {
  const cleanUrl = siteUrl.replace(/\/+$/, '');
  const labelPrefix = `${basePath}/label/`;

  // Exclude label index pages
  const filtered = pages.filter(p => !p.url.startsWith(labelPrefix));

  // Posts go into ## Optional (secondary, skippable)
  const posts = filtered.filter(p => p.type === 'post');
  const nonPosts = filtered.filter(p => p.type !== 'post');

  // Group remaining pages by category; uncategorised falls under 'Docs'
  const groups = new Map<string, PageIndexEntry[]>();
  for (const page of nonPosts) {
    const key = page.category || 'Docs';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(page);
  }

  const lines: string[] = [];

  lines.push(`# ${siteName}`);
  lines.push('');

  if (siteDescription) {
    lines.push(`> ${siteDescription}`);
    lines.push('');
  }

  for (const [category, categoryPages] of groups) {
    lines.push(`## ${category}`);
    lines.push('');
    for (const page of categoryPages) {
      const url = `${cleanUrl}${page.url}`;
      const desc = page.description ? `: ${page.description}` : '';
      lines.push(`- [${page.title}](${url})${desc}`);
    }
    lines.push('');
  }

  if (posts.length > 0) {
    lines.push('## Optional');
    lines.push('');
    for (const page of posts) {
      const url = `${cleanUrl}${page.url}`;
      const desc = page.description ? `: ${page.description}` : '';
      lines.push(`- [${page.title}](${url})${desc}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function generateRobotsTxt(siteUrl: string, basePath: string = ''): string {
  const cleanUrl = siteUrl.replace(/\/+$/, '');
  return [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${cleanUrl}${basePath}/sitemap.xml`,
    '',
  ].join('\n');
}

/**
 * Generate a sitemap.xml from the page index.
 *
 * Label index pages (url starting with basePath + "/label/") are excluded
 * because they are hidden navigation helpers, not canonical content.
 */
export function generateSitemap(
  pages: PageIndexEntry[],
  siteUrl: string,
  basePath: string = '',
): string {
  const cleanUrl = siteUrl.replace(/\/+$/, '');
  const labelPrefix = `${basePath}/label/`;

  const urls = pages
    .filter(p => !p.url.startsWith(labelPrefix))
    .map(page => {
      const lastmod = page.date ? `\n    <lastmod>${page.date}</lastmod>` : '';
      return `  <url>\n    <loc>${cleanUrl}${page.url}</loc>${lastmod}\n  </url>`;
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
    '',
  ].join('\n');
}
