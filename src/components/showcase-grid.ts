import { Component, type ComponentProps } from './component.js';

export interface ShowcaseItem {
  /** Emoji icon */
  icon: string;
  /** Card heading */
  title: string;
  /** Card body text */
  description: string;
  /** Link target */
  href: string;
}

export interface ShowcaseGridProps extends ComponentProps {
  /** Section heading */
  heading: string;
  /** Optional subtitle below the heading */
  subtitle?: string;
  /** Array of showcase cards */
  items: ShowcaseItem[];
}

/**
 * ShowcaseGrid component — renders a responsive grid of linked
 * showcase cards, each with an icon, title, description, and href.
 *
 * Data-driven from frontmatter `Showcase:` array.
 */
export class ShowcaseGrid extends Component<ShowcaseGridProps> {
  render(): string {
    const { heading, subtitle, items } = this.props;

    if (items.length === 0) return '';

    const subtitleHtml = subtitle
      ? `<p class="text-lg text-gray-500 max-w-xl mx-auto">${this.escapeHtml(subtitle)}</p>`
      : '';

    const cards = items.map(item =>
      `    <a href="${item.href}" class="group block bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-lg hover:border-blue-300 transition-all">
      <div class="text-3xl mb-3">${item.icon}</div>
      <h3 class="text-lg font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">${this.escapeHtml(item.title)}</h3>
      <p class="text-gray-500 text-sm">${this.escapeHtml(item.description)}</p>
    </a>`
    ).join('\n');

    return `<section class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
  <div class="text-center mb-12">
    <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">${this.escapeHtml(heading)}</h2>
    ${subtitleHtml}
  </div>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
${cards}
  </div>
</section>`;
  }
}
