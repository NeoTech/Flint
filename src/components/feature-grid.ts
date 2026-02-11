import { Component, type ComponentProps } from './component.js';

export type FeatureColor = 'blue' | 'green' | 'purple' | 'orange' | 'cyan' | 'pink' | 'amber' | 'red' | 'teal' | 'gray';

export interface FeatureItem {
  /** Emoji icon */
  icon: string;
  /** Card heading */
  title: string;
  /** Card body text */
  description: string;
  /** Background color for the icon container */
  color: FeatureColor;
}

export interface FeatureGridProps extends ComponentProps {
  /** Section heading */
  heading: string;
  /** Optional subtitle below the heading */
  subtitle?: string;
  /** Array of feature cards */
  features: FeatureItem[];
}

const ICON_BG: Record<FeatureColor, string> = {
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
 * FeatureGrid component — renders a responsive grid of feature
 * cards, each with an emoji icon, title, and description.
 *
 * Data-driven from frontmatter `Features:` array.
 */
export class FeatureGrid extends Component<FeatureGridProps> {
  render(): string {
    const { heading, subtitle, features } = this.props;

    if (features.length === 0) return '';

    const subtitleHtml = subtitle
      ? `<p class="text-lg text-gray-500 max-w-2xl mx-auto">${this.escapeHtml(subtitle)}</p>`
      : '';

    const cards = features.map(f => {
      const bg = ICON_BG[f.color] ?? ICON_BG.gray;
      return `    <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div class="w-12 h-12 ${bg} rounded-lg flex items-center justify-center text-2xl mb-4">${f.icon}</div>
      <h3 class="text-lg font-semibold text-gray-900 mb-2">${this.escapeHtml(f.title)}</h3>
      <p class="text-gray-600 text-sm leading-relaxed">${this.escapeHtml(f.description)}</p>
    </div>`;
    }).join('\n');

    return `<section class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
  <div class="text-center mb-14">
    <h2 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">${this.escapeHtml(heading)}</h2>
    ${subtitleHtml}
  </div>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
${cards}
  </div>
</section>`;
  }
}
