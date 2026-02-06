import { Component, type ComponentProps } from './component.js';

export interface LabelIndexPageEntry {
  url: string;
  title: string;
  description: string;
  category: string;
  date: string | null;
}

export interface LabelIndexProps extends ComponentProps {
  label: string;
  pages: LabelIndexPageEntry[];
}

/**
 * LabelIndex component — renders a full page listing all pages
 * that share a particular label. Generated at build time for labels
 * that appear on multiple pages, providing a navigation destination
 * for the client-side label router.
 *
 * These pages are hidden from the main navigation menu.
 */
export class LabelIndex extends Component<LabelIndexProps> {
  render(): string {
    const { label, pages } = this.props;

    if (pages.length === 0) {
      return `<div class="label-index">
  <h1 class="text-2xl font-bold mb-4">Label: ${label}</h1>
  <p class="text-gray-500">No pages found with this label.</p>
</div>`;
    }

    const cards = pages.map(page => {
      const datePart = page.date
        ? `<span class="text-gray-400">${page.date}</span>`
        : '';
      const categoryPart = page.category
        ? `<span class="text-gray-400">${page.category}</span>`
        : '';
      const separator = datePart && categoryPart ? ' · ' : '';

      return `<div class="border border-gray-200 rounded p-4 hover:shadow-sm transition-shadow">
  <a href="${page.url}" class="text-lg font-semibold text-blue-600 hover:underline">${page.title}</a>
  <p class="text-sm text-gray-500 mt-1">${datePart}${separator}${categoryPart}</p>
  <p class="text-gray-600 mt-2">${page.description}</p>
</div>`;
    }).join('\n');

    return `<div class="label-index">
  <h1 class="text-2xl font-bold mb-2">Label: ${label}</h1>
  <p class="text-gray-500 mb-6">${pages.length} page${pages.length !== 1 ? 's' : ''} tagged with "${label}"</p>
  <div class="space-y-4">
    ${cards}
  </div>
</div>`;
  }
}
