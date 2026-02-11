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
 * Navigation component - renders a responsive navigation bar.
 *
 * On md+ screens, links display inline in a horizontal row.
 * Below md, links collapse behind a hamburger toggle button and
 * render in a vertical dropdown panel (`#flint-nav-menu`).
 *
 * The toggle behaviour is handled client-side by `src/client/nav-toggle.ts`.
 */
export class Navigation extends Component<NavigationProps> {
  render(): string {
    const { items, className = '' } = this.props;

    const navClasses = this.classNames(
      'bg-white shadow-sm border-b border-gray-200',
      className
    );

    const desktopLinks = items
      .map(item => this.renderLink(item, 'desktop'))
      .join('\n');

    const mobileLinks = items
      .map(item => this.renderLink(item, 'mobile'))
      .join('\n');

    const hamburger = `<button
          id="flint-nav-toggle"
          class="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-blue-600 hover:bg-gray-100 transition-colors"
          aria-label="Toggle navigation"
          aria-expanded="false"
          aria-controls="flint-nav-menu"
        ><svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg></button>`;

    const mobileMenu = `<div id="flint-nav-menu" class="hidden md:hidden border-t border-gray-200 bg-white">
        <div class="px-4 py-3 space-y-1">
${mobileLinks}
        </div>
      </div>`;

    return `<nav class="${navClasses}">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex h-16 items-center justify-between">
        <div class="hidden md:flex items-center gap-2">
${desktopLinks}
        </div>
        ${hamburger}
      </div>
    </div>
    ${mobileMenu}
</nav>`;
  }

  /** Render a single nav link for either desktop or mobile context */
  private renderLink(item: NavItem, mode: 'desktop' | 'mobile'): string {
    const isActive = item.active;
    const hxBoostAttr = item.hxBoost ? ' hx-boost="true"' : '';
    const ariaCurrent = isActive ? ' aria-current="page"' : '';

    if (mode === 'mobile') {
      const mobileClasses = this.classNames(
        'block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200',
        isActive
          ? 'text-blue-600 bg-blue-50'
          : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
      );
      return `          <a href="${item.href}" class="${mobileClasses}"${hxBoostAttr}${ariaCurrent}>${item.label}</a>`;
    }

    const desktopClasses = this.classNames(
      'px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200',
      isActive
        ? 'text-blue-600 bg-blue-50'
        : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
    );
    return `          <a href="${item.href}" class="${desktopClasses}"${hxBoostAttr}${ariaCurrent}>${item.label}</a>`;
  }
}
