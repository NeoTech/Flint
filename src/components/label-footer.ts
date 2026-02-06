import { Component, type ComponentProps } from './component.js';

export interface LabelFooterProps extends ComponentProps {
  labels: string[];
}

/**
 * Color palette for label badges — cycles through these for visual variety.
 */
const LABEL_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-green-100', text: 'text-green-700' },
  { bg: 'bg-purple-100', text: 'text-purple-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-teal-100', text: 'text-teal-700' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  { bg: 'bg-orange-100', text: 'text-orange-700' },
];

/**
 * LabelFooter component — renders a site-wide footer with all labels
 * as styled badge spans. Labels are deduplicated, sorted alphabetically,
 * and assigned rotating color classes for visual variety.
 */
export class LabelFooter extends Component<LabelFooterProps> {
  render(): string {
    const { labels, className } = this.props;

    // Deduplicate and sort
    const unique = [...new Set(labels)].sort((a, b) => a.localeCompare(b));

    if (unique.length === 0) {
      return '';
    }

    const badges = unique.map((label, i) => {
      const color = LABEL_COLORS[i % LABEL_COLORS.length];
      return `<a href="#" class="label-link text-sm ${color.bg} ${color.text} px-3 py-1 rounded-full cursor-pointer hover:opacity-80 transition-opacity" data-label="${label}">${label}</a>`;
    }).join('\n      ');

    const extraClass = className ? ` ${className}` : '';

    return `<footer class="border-t border-gray-200 mt-12 pt-8 pb-8${extraClass}">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Labels</h3>
    <div class="flex flex-wrap gap-2">
      ${badges}
    </div>
  </div>
</footer>`;
  }
}
