import { Component, type ComponentProps } from './component.js';
import type { TagDef } from '../templates/tag-registry.js';

export type StatColor = 'blue' | 'green' | 'purple' | 'orange' | 'cyan' | 'pink' | 'amber' | 'red' | 'teal' | 'gray';

export interface StatItem {
  /** The prominent number or value */
  value: string;
  /** Label below the value */
  label: string;
  /** Accent color for the value text */
  color: StatColor;
}

export interface StatsBarProps extends ComponentProps {
  stats: StatItem[];
}

const VALUE_COLOR: Record<StatColor, string> = {
  blue: 'text-blue-400',
  green: 'text-green-400',
  purple: 'text-purple-400',
  orange: 'text-orange-400',
  cyan: 'text-cyan-400',
  pink: 'text-pink-400',
  amber: 'text-amber-400',
  red: 'text-red-400',
  teal: 'text-teal-400',
  gray: 'text-gray-400',
};

/**
 * StatsBar component — renders a dark-background row of
 * headline statistics with colored values and labels.
 *
 * Data-driven from frontmatter `Stats:` array.
 */
export class StatsBar extends Component<StatsBarProps> {
  render(): string {
    const { stats } = this.props;

    if (stats.length === 0) return '';

    const cols = stats.length <= 2 ? 'grid-cols-' + String(stats.length) : 'grid-cols-2 sm:grid-cols-4';

    const items = stats.map(s => {
      const color = VALUE_COLOR[s.color] ?? VALUE_COLOR.gray;
      return `      <div>
        <p class="text-3xl sm:text-4xl font-extrabold ${color}">${this.escapeHtml(s.value)}</p>
        <p class="text-gray-400 text-sm mt-1">${this.escapeHtml(s.label)}</p>
      </div>`;
    }).join('\n');

    return `<section class="bg-gray-900 text-white">
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
    <div class="grid ${cols} gap-8 text-center">
${items}
    </div>
  </div>
</section>`;
  }
}

export const tagDefs: TagDef[] = [
  {
    tag: 'stats-bar',
    label: 'Stats Bar',
    icon: '📊',
    description: 'Dark-background statistics bar from frontmatter Stats array.',
    frontmatterKey: 'Stats',
    interfaceName: 'StatsBarProps',
    resolve: (ctx) => {
      const sb = ctx.frontmatter['Stats'] as StatsBarProps | undefined;
      if (!sb || !sb.stats || sb.stats.length === 0) return '';
      return StatsBar.render(sb);
    },
  },
];
