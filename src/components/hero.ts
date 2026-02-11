import { Component, type ComponentProps } from './component.js';

export interface CtaButton {
  /** Button text */
  label: string;
  /** Link target */
  href: string;
}

export interface HeroProps extends ComponentProps {
  /** Small uppercase text above the heading */
  tagline?: string;
  /** Main headline */
  heading: string;
  /** Paragraph below the heading */
  subtitle?: string;
  /** Primary call-to-action button (solid white) */
  primaryCta: CtaButton;
  /** Secondary call-to-action button (outlined) */
  secondaryCta?: CtaButton;
}

/**
 * Hero component — renders a full-width gradient hero section
 * with tagline, heading, subtitle, and one or two CTA buttons.
 *
 * Data-driven from frontmatter `Hero:` field.
 */
export class Hero extends Component<HeroProps> {
  render(): string {
    const { tagline, heading, subtitle, primaryCta, secondaryCta } = this.props;

    const taglineHtml = tagline
      ? `<p class="text-blue-200 text-sm font-semibold tracking-widest uppercase mb-4">${this.escapeHtml(tagline)}</p>`
      : '';

    const subtitleHtml = subtitle
      ? `<p class="text-lg sm:text-xl text-blue-100 max-w-2xl mx-auto mb-10">${this.escapeHtml(subtitle)}</p>`
      : '';

    const secondaryHtml = secondaryCta
      ? `\n      <a href="${secondaryCta.href}" class="inline-flex items-center justify-center px-8 py-3.5 border-2 border-white/30 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors text-base">${this.escapeHtml(secondaryCta.label)}</a>`
      : '';

    return `<section class="relative bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white overflow-hidden">
  <div class="absolute inset-0 opacity-10">
    <div class="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl"></div>
    <div class="absolute bottom-10 right-10 w-96 h-96 bg-blue-300 rounded-full blur-3xl"></div>
  </div>
  <div class="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center">
    ${taglineHtml}
    <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6">${this.escapeHtml(heading)}</h1>
    ${subtitleHtml}
    <div class="flex flex-col sm:flex-row gap-4 justify-center">
      <a href="${primaryCta.href}" class="inline-flex items-center justify-center px-8 py-3.5 bg-white text-blue-700 font-semibold rounded-lg shadow-lg hover:bg-blue-50 transition-colors text-base">${this.escapeHtml(primaryCta.label)}</a>${secondaryHtml}
    </div>
  </div>
</section>`;
  }
}
