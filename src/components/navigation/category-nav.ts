import { Component, type ComponentProps } from '../component.js';
import type { PageMetadata } from '../../core/page-metadata.js';

export interface CategoryNavProps extends ComponentProps {
  pages: PageMetadata[];
  currentCategory: string | null;
  useHtmx?: boolean;
}

/**
 * CategoryNav component - renders category filter navigation
 */
export class CategoryNav extends Component<CategoryNavProps> {
  render(): string {
    const { pages, currentCategory, useHtmx = true } = this.props;

    if (pages.length === 0) {
      return '';
    }

    // Count pages per category
    const categoryCounts = new Map<string, number>();
    for (const page of pages) {
      if (page.category) {
        categoryCounts.set(page.category, (categoryCounts.get(page.category) || 0) + 1);
      }
    }

    // Sort categories alphabetically
    const sortedCategories = Array.from(categoryCounts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]));

    if (sortedCategories.length === 0) {
      return '';
    }

    const htmxAttrs = useHtmx 
      ? 'hx-boost="true" hx-target="#app" hx-swap="innerHTML"' 
      : '';

    const items = sortedCategories.map(([category, count]) => {
      const isActive = category === currentCategory;
      const activeClass = isActive
        ? 'bg-blue-600 text-white'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200';
      const slug = this.generateSlug(category);

      return `
        <a href="/category/${slug}" 
           class="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeClass}"
           ${htmxAttrs}>
          ${category}
          <span class="ml-2 text-xs opacity-75">(${count})</span>
        </a>`;
    }).join('');

    return `<nav class="category-nav mb-6" aria-label="Categories">
  <h3 class="text-sm font-semibold text-gray-900 mb-3">Categories</h3>
  <div class="flex flex-wrap gap-2">
    ${items}
  </div>
</nav>`;
  }

  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
