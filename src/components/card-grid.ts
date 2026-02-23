import { Component, type ComponentProps } from './component.js';
import type { TagDef } from '../templates/tag-registry.js';

export type CardColor = 'blue' | 'green' | 'purple' | 'orange' | 'cyan' | 'pink' | 'amber' | 'red' | 'teal' | 'gray';

export interface CardItem {
  /** Emoji icon */
  icon: string;
  /** Card heading */
  title: string;
  /** Card body text */
  description: string;
  /** If set, card becomes a clickable link with hover effects */
  href?: string;
  /** Background color for the icon container (feature-style) */
  color?: CardColor;
}

export interface CardGridProps extends ComponentProps {
  /** Section heading */
  heading: string;
  /** Optional subtitle below the heading */
  subtitle?: string;
  /** Array of cards */
  items: CardItem[];
}

const ICON_BG: Record<CardColor, string> = {
  blue: 'bg-blue-100',
  green: 'bg-green-100',
  purple: 'bg-purple-100',
  orange: 'bg-orange-100',
  cyan: 'bg-cyan-100',
  pink: 'bg-pink-100',
  amber: 'bg-amber-100',
  red: 'bg-red-100',
  teal: 'bg-teal-100',
  gray: 'bg-gray-100',
};

/**
 * CardGrid component — a flexible responsive grid of icon cards.
 *
 * Replaces the old FeatureGrid and ShowcaseGrid components with
 * a single generic implementation. Each card can optionally:
 * - be a link (when `href` is set → anchor tag with hover effects)
 * - have a colored icon background (when `color` is set)
 *
 * Data-driven from frontmatter arrays.
 */
export class CardGrid extends Component<CardGridProps> {
  render(): string {
    const { heading, subtitle, items } = this.props;

    if (items.length === 0) return '';

    const subtitleHtml = subtitle
      ? `\n    <p class="text-lg text-gray-500 max-w-2xl mx-auto">${this.escapeHtml(subtitle)}</p>`
      : '';

    const cards = items.map(item => {
      const bg = item.color ? ICON_BG[item.color] ?? ICON_BG.gray : '';
      const iconContainerClass = bg
        ? `w-12 h-12 ${bg} rounded-lg flex items-center justify-center text-2xl mb-4`
        : 'text-3xl mb-3';

      const iconHtml = `<div class="${iconContainerClass}">${item.icon}</div>`;
      const titleHtml = `<h3 class="text-lg font-semibold text-gray-900 mb-${item.href ? '1' : '2'}${item.href ? ' group-hover:text-blue-600 transition-colors' : ''}">${this.escapeHtml(item.title)}</h3>`;
      const descClass = item.href ? 'text-gray-500 text-sm' : 'text-gray-600 text-sm leading-relaxed';
      const descHtml = `<p class="${descClass}">${this.escapeHtml(item.description)}</p>`;

      if (item.href) {
        return `    <a href="${item.href}" class="group block bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-lg hover:border-blue-300 transition-all">
      ${iconHtml}
      ${titleHtml}
      ${descHtml}
    </a>`;
      }

      return `    <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      ${iconHtml}
      ${titleHtml}
      ${descHtml}
    </div>`;
    }).join('\n');

    return `<section class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
  <div class="text-center mb-14">
    <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">${this.escapeHtml(heading)}</h2>${subtitleHtml}
  </div>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
${cards}
  </div>
</section>`;
  }
}

export const tagDefs: TagDef[] = [
  {
    tag: 'feature-grid',
    label: 'Feature Grid',
    icon: '🔲',
    description: 'Responsive card grid from frontmatter Features object.',
    frontmatterKey: 'Features',
    interfaceName: 'CardGridProps',
    resolve: (ctx) => {
      const fg = ctx.frontmatter['Features'] as CardGridProps | undefined;
      if (!fg || !fg.items || fg.items.length === 0) return '';
      return CardGrid.render(fg);
    },
  },
  {
    tag: 'showcase-grid',
    label: 'Showcase Grid',
    icon: '🖼️',
    description: 'Responsive card grid from frontmatter Showcase object.',
    frontmatterKey: 'Showcase',
    interfaceName: 'CardGridProps',
    resolve: (ctx) => {
      const sg = ctx.frontmatter['Showcase'] as CardGridProps | undefined;
      if (!sg || !sg.items || sg.items.length === 0) return '';
      return CardGrid.render(sg);
    },
  },
];
