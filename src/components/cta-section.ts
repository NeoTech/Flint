import { Component, type ComponentProps } from './component.js';

/** Reusable CTA button shape — shared across all CTA sections. */
export interface CtaButton {
  /** Button text */
  label: string;
  /** Link target */
  href: string;
}

export interface CtaSectionProps extends ComponentProps {
  /**
   * Visual variant:
   * - `'hero'` — large h1, decorative blur circles, tagline slot (page hero)
   * - `'banner'` — smaller h2, clean gradient, no tagline (mid/end-page CTA)
   *
   * Defaults to `'hero'`.
   */
  variant?: 'hero' | 'banner';
  /** Small uppercase text above the heading (hero variant only) */
  tagline?: string;
  /** Main headline */
  heading: string;
  /** Paragraph below the heading */
  subtitle?: string;
  /** Primary button (solid white) */
  primaryCta: CtaButton;
  /** Secondary button (outlined) */
  secondaryCta?: CtaButton;
}

/**
 * CtaSection component — a flexible gradient call-to-action section
 * that works as both a page hero (variant='hero') and a conversion
 * banner (variant='banner').
 *
 * Replaces the old Hero and CallToAction components with a single
 * generic implementation.
 *
 * Data-driven from frontmatter `Hero:` / `CTA:` fields.
 */
export class CtaSection extends Component<CtaSectionProps> {
  render(): string {
    const {
      variant = 'hero',
      tagline,
      heading,
      subtitle,
      primaryCta,
      secondaryCta,
    } = this.props;

    const isHero = variant === 'hero';

    // Decorative blur circles — hero only
    const decorHtml = isHero
      ? `\n  <div class="absolute inset-0 opacity-10">
    <div class="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl"></div>
    <div class="absolute bottom-10 right-10 w-96 h-96 bg-blue-300 rounded-full blur-3xl"></div>
  </div>`
      : '';

    // Tagline — hero only
    const taglineHtml = isHero && tagline
      ? `<p class="text-blue-200 text-sm font-semibold tracking-widest uppercase mb-4">${this.escapeHtml(tagline)}</p>\n    `
      : '';

    // Heading — h1 for hero, h2 for banner
    const headingTag = isHero ? 'h1' : 'h2';
    const headingClass = isHero
      ? 'text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6'
      : 'text-3xl sm:text-4xl font-bold mb-4';
    const headingHtml = `<${headingTag} class="${headingClass}">${this.escapeHtml(heading)}</${headingTag}>`;

    // Subtitle
    const subtitleClass = isHero
      ? 'text-lg sm:text-xl text-blue-100 max-w-2xl mx-auto mb-10'
      : 'text-blue-100 text-lg mb-8 max-w-xl mx-auto';
    const subtitleHtml = subtitle
      ? `\n    <p class="${subtitleClass}">${this.escapeHtml(subtitle)}</p>`
      : '';

    // CTA buttons
    const secondaryHtml = secondaryCta
      ? `\n      <a href="${secondaryCta.href}" class="inline-flex items-center justify-center px-8 py-3.5 border-2 border-white/30 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors text-base">${this.escapeHtml(secondaryCta.label)}</a>`
      : '';

    // Section wrapper
    const sectionClass = isHero
      ? 'relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white overflow-hidden'
      : 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white';
    const innerClass = isHero
      ? 'relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center'
      : 'max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center';

    return `<section class="${sectionClass}">${decorHtml}
  <div class="${innerClass}">
    ${taglineHtml}${headingHtml}${subtitleHtml}
    <div class="flex flex-col sm:flex-row gap-4 justify-center">
      <a href="${primaryCta.href}" class="inline-flex items-center justify-center px-8 py-3.5 bg-white text-blue-700 font-semibold rounded-lg shadow-lg hover:bg-blue-50 transition-colors text-base">${this.escapeHtml(primaryCta.label)}</a>${secondaryHtml}
    </div>
  </div>
</section>`;
  }
}
