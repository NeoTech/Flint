import { Component, type ComponentProps } from './component.js';

export interface NavItem {
  label: string;
  href: string;
  active?: boolean;
  hxBoost?: boolean;
  order?: number;
}

export interface NavigationProps extends ComponentProps {
  items: NavItem[];
}

/**
 * Navigation component - renders a navigation menu with HTMX support
 */
export class Navigation extends Component<NavigationProps> {
  render(): string {
    const { items, className = '' } = this.props;

    const navClasses = this.classNames(
      'bg-white shadow-sm border-b border-gray-200',
      className
    );

    const itemsHtml = items
      .map(item => {
        const isActive = item.active;
        const linkClasses = this.classNames(
          'px-4 py-2 text-sm font-medium transition-colors duration-200',
          isActive
            ? 'text-blue-600 bg-blue-50'
            : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
        );

        const hxBoostAttr = item.hxBoost ? ' hx-boost="true"' : '';
        const ariaCurrent = isActive ? ' aria-current="page"' : '';

        return `            <a href="${item.href}" class="${linkClasses}"${hxBoostAttr}${ariaCurrent}>${item.label}</a>`;
      })
      .join('\n');

    return `<nav class="${navClasses}">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex space-x-4 h-16 items-center">
${itemsHtml}
        </div>
    </div>
</nav>`;
  }
}
