import { Component, type ComponentProps } from './component.js';

export interface CtaButton {
  /** Button text */
  label: string;
  /** Link target */
  href: string;
}

export interface CallToActionProps extends ComponentProps {
  /** Main heading */
  heading: string;
  /** Paragraph below the heading */
  subtitle?: string;
  /** Primary button (solid white) */
  primaryCta: CtaButton;
  /** Secondary button (outlined) */
  secondaryCta?: CtaButton;
}

/**
 * CallToAction component — renders a full-width gradient section
 * with a heading, subtitle, and one or two CTA buttons.
 *
 * Data-driven from frontmatter `CTA:` field.
 */
export class CallToAction extends Component<CallToActionProps> {
  render(): string {
    const { heading, subtitle, primaryCta, secondaryCta } = this.props;

    const subtitleHtml = subtitle
      ? `<p class="text-blue-100 text-lg mb-8 max-w-xl mx-auto">${this.escapeHtml(subtitle)}</p>`
      : '';

    const secondaryHtml = secondaryCta
      ? `\n      <a href="${secondaryCta.href}" class="inline-flex items-center justify-center px-8 py-3.5 border-2 border-white/30 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors text-base">${this.escapeHtml(secondaryCta.label)}</a>`
      : '';

    return `<section class="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
    <h2 class="text-3xl sm:text-4xl font-bold mb-4">${this.escapeHtml(heading)}</h2>
    ${subtitleHtml}
    <div class="flex flex-col sm:flex-row gap-4 justify-center">
      <a href="${primaryCta.href}" class="inline-flex items-center justify-center px-8 py-3.5 bg-white text-blue-700 font-semibold rounded-lg shadow-lg hover:bg-blue-50 transition-colors text-base">${this.escapeHtml(primaryCta.label)}</a>${secondaryHtml}
    </div>
  </div>
</section>`;
  }
}
