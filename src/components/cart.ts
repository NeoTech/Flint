import { Component, type ComponentProps } from './component.js';

export interface CartProps extends ComponentProps {
  /** Initial item count to display (server-side hint, hydrated client-side) */
  initialCount?: number;
}

/**
 * Cart component — renders a lightweight cart widget placeholder.
 *
 * The server renders the structural HTML (toggle button, panel, items list,
 * totals, checkout button). All interactive behaviour is handled by the
 * bundled client-side hydration module (`src/client/cart-hydrate.ts`).
 */
export class Cart extends Component<CartProps> {
  render(): string {
    const { className } = this.props;
    const extraClass = className ? ` ${className}` : '';

    return `<div id="flint-cart" class="relative${extraClass}" aria-label="Shopping cart">
  <button id="flint-cart-toggle" class="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors" aria-expanded="false" aria-controls="flint-cart-panel">
    🛒 Cart (<span id="flint-cart-count">0</span>)
  </button>
  <div id="flint-cart-panel" class="hidden absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl p-4 z-50" role="dialog" aria-label="Cart contents">
    <h3 class="text-sm font-semibold text-gray-700 mb-2">Your Cart</h3>
    <div id="flint-cart-items" class="space-y-2 max-h-60 overflow-y-auto" aria-live="polite">
      <div class="text-sm text-gray-400">Cart is empty</div>
    </div>
    <div class="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
      <div id="flint-cart-total" class="text-sm font-semibold">Total: $0.00</div>
      <button id="flint-cart-checkout" class="bg-green-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-green-700 transition-colors">Checkout</button>
    </div>
  </div>
</div>`;
  }
}
