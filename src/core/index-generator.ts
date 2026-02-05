import type { PageMetadata } from './page-metadata.js';

export interface IndexPage {
  title: string;
  shortUri: string;
  description: string;
  pages: IndexPageItem[];
  keywords: string[];
}

export interface IndexPageItem {
  shortUri: string;
  title: string;
  description: string;
  date: string;
  author: string;
  type: string;
}

export interface AllIndexes {
  categories: IndexPage[];
  labels: IndexPage[];
}

/**
 * Generate index page for a category
 */
export function generateCategoryIndex(category: string, pages: PageMetadata[]): IndexPage {
  const categoryPages = pages
    .filter(p => p.category === category)
    .sort((a, b) => {
      // Sort by date descending
      if (a.date && b.date) {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      return 0;
    });
  
  const items: IndexPageItem[] = categoryPages.map(p => ({
    shortUri: p.shortUri,
    title: p.title || p.shortUri,
    description: p.description,
    date: p.date,
    author: p.author,
    type: p.type,
  }));
  
  // Collect all labels and keywords from pages in this category
  const allLabels = new Set<string>();
  const allKeywords = new Set<string>([category]);
  
  for (const page of categoryPages) {
    (page.labels || []).forEach((l: string) => allLabels.add(l));
    (page.keywords || []).forEach((k: string) => allKeywords.add(k));
  }
  
  return {
    title: category,
    shortUri: `category/${generateSlug(category)}`,
    description: `All pages in category "${category}" (${items.length} pages)`,
    pages: items,
    keywords: Array.from(allKeywords),
  };
}

/**
 * Generate index page for a label
 */
export function generateLabelIndex(label: string, pages: PageMetadata[]): IndexPage {
  const labelPages = pages
    .filter(p => p.labels.includes(label))
    .sort((a, b) => {
      if (a.date && b.date) {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      return 0;
    });
  
  const items: IndexPageItem[] = labelPages.map(p => ({
    shortUri: p.shortUri,
    title: p.title || p.shortUri,
    description: p.description,
    date: p.date,
    author: p.author,
    type: p.type,
  }));
  
  // Collect categories and keywords
  const categories = new Set<string>();
  const allKeywords = new Set<string>([label]);
  
  for (const page of labelPages) {
    if (page.category) categories.add(page.category);
    (page.keywords || []).forEach((k: string) => allKeywords.add(k));
  }
  
  return {
    title: label,
    shortUri: `label/${generateSlug(label)}`,
    description: `All pages tagged with "${label}" (${items.length} pages)`,
    pages: items,
    keywords: Array.from(allKeywords),
  };
}

/**
 * Generate all category and label indexes
 */
export function generateAllIndexes(pages: PageMetadata[]): AllIndexes {
  // Collect unique categories
  const categories = new Set<string>();
  for (const page of pages) {
    if (page.category) {
      categories.add(page.category);
    }
  }
  
  // Collect unique labels
  const labels = new Set<string>();
  for (const page of pages) {
    for (const label of page.labels) {
      labels.add(label);
    }
  }
  
  return {
    categories: Array.from(categories).map(cat => generateCategoryIndex(cat, pages)),
    labels: Array.from(labels).map(label => generateLabelIndex(label, pages)),
  };
}

/**
 * Generate a URL-friendly slug
 */
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
