import { Component, type ComponentProps } from './component.js';

export interface ProductProps extends ComponentProps {
  /** Product slug / identifier used for cart operations */
  id: string;
  /** Display title */
  title: string;
  /** Formatted price string, e.g. '$14.99' */
  price?: string;
  /** URL or emoji to display as the product image */
  image?: string;
  /** Short product description */
  description?: string;
  /** When true, render a full-page detail layout instead of a compact card */
  detail?: boolean;
  /** Stripe Payment Link URL — used in payment-links checkout mode */
  stripePaymentLink?: string;
}

/**
 * Product component — renders either a compact card (for listings) or
 * a full-page detail hero (for individual product pages).
 *
 * The Add button calls the client-side CartAPI (or queues the call if
 * the API hasn't initialised yet). The bundled product-hydrate module
 * also binds `.flint-add-to-cart` buttons for a belt-and-suspenders approach.
 */
export class Product extends Component<ProductProps> {
  render(): string {
    const { detail } = this.props;
    return detail ? this.renderDetail() : this.renderCard();
  }

  /** Returns true when the image value is an emoji rather than a URL */
  private isEmoji(value: string): boolean {
    // Emoji-only strings contain no ASCII letters, digits or slashes
    return !/[a-zA-Z0-9/]/.test(value);
  }

  /** Compact card for listing pages */
  private renderCard(): string {
    const { id, title, price = '', description = '', image, className, stripePaymentLink } = this.props;
    const extraClass = className ? ` ${className}` : '';

    const imageHtml = image
      ? `<img src="${this.escapeHtml(image)}" alt="${this.escapeHtml(title)}" class="max-w-full max-h-full object-contain" />`
      : `<span class="text-4xl">📦</span>`;

    return `<article class="product-card border border-gray-200 rounded-lg p-6 flex flex-col sm:flex-row gap-6 items-start${extraClass}">
  <div class="w-full sm:w-40 h-40 bg-gray-50 flex items-center justify-center overflow-hidden rounded-lg shrink-0">
    ${imageHtml}
  </div>
  <div class="flex-1">
    <h2 class="text-xl font-bold mb-1">${this.escapeHtml(title)}</h2>
    <p class="text-gray-600 mb-3">${this.escapeHtml(description)}</p>
    <div class="flex items-center gap-4">
      ${price ? `<span class="text-lg font-semibold text-gray-900">${this.escapeHtml(price)}</span>` : ''}
      <button
        class="flint-add-to-cart bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        data-id="${this.escapeHtml(id)}"
        data-qty="1"
        ${stripePaymentLink ? `data-payment-link="${this.escapeHtml(stripePaymentLink)}"` : ''}
        aria-label="Add ${this.escapeHtml(title)} to cart"
      >Add to Cart</button>
    </div>
  </div>
</article>`;
  }

  /** Full-page detail hero for individual product pages */
  private renderDetail(): string {
    const { id, title, price = '', description = '', image, stripePaymentLink } = this.props;

    const imageHtml = image && this.isEmoji(image)
      ? `<span class="text-8xl">${image}</span>`
      : image
        ? `<img src="${this.escapeHtml(image)}" alt="${this.escapeHtml(title)}" class="max-w-full max-h-full object-contain" />`
        : `<span class="text-8xl">📦</span>`;

    return `<section class="product-detail flex flex-col md:flex-row gap-8 mt-6">
  <div class="md:w-1/2">
    <div class="w-full h-72 bg-gray-50 flex items-center justify-center rounded-xl border border-gray-200">
      ${imageHtml}
    </div>
  </div>
  <div class="md:w-1/2 flex flex-col justify-center">
    <span class="inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded w-fit mb-3">In Stock</span>
    ${price ? `<p class="text-3xl font-bold text-gray-900 mb-2">${this.escapeHtml(price)}</p>` : ''}
    <p class="text-gray-600 mb-6">${this.escapeHtml(description)}</p>
    <div class="flex items-center gap-4">
      <button
        class="flint-add-to-cart bg-blue-600 text-white px-6 py-3 rounded-lg text-base font-medium hover:bg-blue-700 transition-colors"
        data-id="${this.escapeHtml(id)}"
        data-qty="1"
        ${stripePaymentLink ? `data-payment-link="${this.escapeHtml(stripePaymentLink)}"` : ''}
        aria-label="Add ${this.escapeHtml(title)} to cart"
      >Add to Cart</button>
    </div>
  </div>
</section>`;
  }
}
