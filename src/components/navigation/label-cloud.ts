import { Component, type ComponentProps } from '../component.js';
import type { PageMetadata } from '../../core/page-metadata.js';

export interface LabelCloudProps extends ComponentProps {
  pages: PageMetadata[];
  selectedLabels: string[];
  useHtmx?: boolean;
}

/**
 * LabelCloud component - renders clickable label filters
 */
export class LabelCloud extends Component<LabelCloudProps> {
  render(): string {
    const { pages, selectedLabels, useHtmx = true } = this.props;

    if (pages.length === 0) {
      return '';
    }

    // Count pages per label
    const labelCounts = new Map<string, number>();
    for (const page of pages) {
      for (const label of page.labels) {
        labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
      }
    }

    // Sort by count descending
    const sortedLabels = Array.from(labelCounts.entries())
      .sort((a, b) => b[1] - a[1]);

    if (sortedLabels.length === 0) {
      return '';
    }

    const maxCount = Math.max(...sortedLabels.map(([, count]) => count));
    const minCount = Math.min(...sortedLabels.map(([, count]) => count));

    const htmxAttrs = useHtmx 
      ? 'hx-boost="true" hx-target="#app" hx-swap="innerHTML"' 
      : '';

    const items = sortedLabels.map(([label, count]) => {
      const isSelected = selectedLabels.includes(label);
      const sizeClass = this.getSizeClass(count, minCount, maxCount);
      const activeClass = isSelected
        ? 'bg-blue-600 text-white'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200';
      const slug = this.generateSlug(label);

      return `
        <a href="/label/${slug}" 
           class="inline-flex items-center px-3 py-1 rounded-full transition-colors ${sizeClass} ${activeClass}"
           ${htmxAttrs}>
          ${label}
          <span class="ml-1.5 text-xs opacity-75">${count}</span>
        </a>`;
    }).join('');

    return `<nav class="label-cloud mb-6" aria-label="Labels">
  <h3 class="text-sm font-semibold text-gray-900 mb-3">Labels</h3>
  <div class="flex flex-wrap gap-2">
    ${items}
  </div>
</nav>`;
  }

  private getSizeClass(count: number, min: number, max: number): string {
    if (max === min) return 'text-sm';
    
    const ratio = (count - min) / (max - min);
    if (ratio > 0.75) return 'text-lg font-medium';
    if (ratio > 0.5) return 'text-base';
    if (ratio > 0.25) return 'text-sm';
    return 'text-xs';
  }

  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
