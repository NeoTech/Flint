import { Component, type ComponentProps } from './component.js';
import type { TagDef } from '../templates/tag-registry.js';

export type SkillColor = 'green' | 'blue' | 'purple' | 'amber' | 'gray' | 'rose' | 'teal';

export interface SkillInfo {
  /** Skill directory name */
  name: string;
  /** Emoji icon */
  icon: string;
  /** Short description */
  description: string;
  /** Keyword tags shown as badges */
  tags: string[];
  /** Color theme for badges */
  color: SkillColor;
}

export interface SkillCardsProps extends ComponentProps {
  skills: SkillInfo[];
}

/** Badge color mappings for each theme. */
const COLOR_MAP: Record<SkillColor, { bg: string; text: string }> = {
  green:  { bg: 'bg-green-100',  text: 'text-green-800' },
  blue:   { bg: 'bg-blue-100',   text: 'text-blue-800' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-800' },
  amber:  { bg: 'bg-amber-100',  text: 'text-amber-800' },
  gray:   { bg: 'bg-gray-200',   text: 'text-gray-700' },
  rose:   { bg: 'bg-rose-100',   text: 'text-rose-800' },
  teal:   { bg: 'bg-teal-100',   text: 'text-teal-800' },
};

/**
 * SkillCards component — renders a responsive grid of skill
 * info cards, each with an icon, description, and colored tags.
 *
 * The last card spans full width when the total is odd.
 */
export class SkillCards extends Component<SkillCardsProps> {
  render(): string {
    const { skills } = this.props;

    if (skills.length === 0) {
      return '';
    }

    const isOddCount = skills.length % 2 !== 0;

    const cards = skills.map((skill, index) => {
      const colors = COLOR_MAP[skill.color] ?? COLOR_MAP.gray;
      const isLastOdd = isOddCount && index === skills.length - 1;
      const spanClass = isLastOdd ? ' sm:col-span-2' : '';

      const badges = skill.tags.map(tag =>
        `<span class="text-xs ${colors.bg} ${colors.text} px-2 py-0.5 rounded-full">${this.escapeHtml(tag)}</span>`
      ).join('\n        ');

      const badgesHtml = skill.tags.length > 0
        ? `\n      <div class="flex flex-wrap gap-1.5">\n        ${badges}\n      </div>`
        : '';

      return `<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow${spanClass}">
    <div class="flex items-center gap-2 mb-2">
      <span class="text-lg">${skill.icon}</span>
      <h3 class="text-base font-semibold text-gray-900 m-0">${this.escapeHtml(skill.name)}</h3>
    </div>
    <p class="text-sm text-gray-600 mb-3">${this.escapeHtml(skill.description)}</p>${badgesHtml}
  </div>`;
    }).join('\n  ');

    return `<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 mb-8">
  ${cards}
</div>`;
  }
}

export const tagDefs: TagDef[] = [
  {
    tag: 'skill-cards',
    label: 'Skill Cards',
    icon: '🃏',
    description: 'Grid of skill info cards from frontmatter Skills array.',
    frontmatterKey: 'Skills',
    interfaceName: 'SkillInfo[]',
    resolve: (ctx) => {
      const skills = ctx.frontmatter['Skills'] as SkillInfo[] | undefined;
      if (!skills || !Array.isArray(skills) || skills.length === 0) return '';
      return SkillCards.render({ skills });
    },
  },
];
