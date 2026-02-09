import { Component, type ComponentProps } from './component.js';

export interface ProductProps extends ComponentProps {
  /** Product slug / identifier used for cart operations */
  id: string;
  /** Display title */
  title: string;
  /** Formatted price string, e.g. '$14.99' */
  price?: string;
  /** URL to product image (omit for a placeholder) */
  image?: string;
  /** Short product description */
  description?: string;
}

/**
 * Product component — renders a product card with an Add-to-Cart button.
 *
 * The Add button calls the client-side CartAPI (or queues the call if
 * the API hasn't initialised yet). The bundled product-hydrate module
 * also binds `.flint-add-to-cart` buttons for a belt-and-suspenders approach.
 */
export class Product extends Component<ProductProps> {
  render(): string {
    const { id, title, price = '', description = '', image, className } = this.props;
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
        aria-label="Add ${this.escapeHtml(title)} to cart"
      >Add to Cart</button>
    </div>
  </div>
</article>`;
  }
}
