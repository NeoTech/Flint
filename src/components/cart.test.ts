import { describe, it, expect } from 'vitest';
import { Cart } from './cart.js';

describe('Cart', () => {
  it('should render a container with id "flint-cart"', () => {
    const html = Cart.render({});

    expect(html).toContain('id="flint-cart"');
  });

  it('should render a toggle button', () => {
    const html = Cart.render({});

    expect(html).toContain('id="flint-cart-toggle"');
    expect(html).toContain('Cart');
  });

  it('should render a cart count span', () => {
    const html = Cart.render({});

    expect(html).toContain('id="flint-cart-count"');
    expect(html).toContain('>0</span>');
  });

  it('should render a hidden cart panel', () => {
    const html = Cart.render({});

    expect(html).toContain('id="flint-cart-panel"');
    expect(html).toContain('hidden');
  });

  it('should render a cart items container', () => {
    const html = Cart.render({});

    expect(html).toContain('id="flint-cart-items"');
  });

  it('should render a total display', () => {
    const html = Cart.render({});

    expect(html).toContain('id="flint-cart-total"');
    expect(html).toContain('$0.00');
  });

  it('should render a checkout button', () => {
    const html = Cart.render({});

    expect(html).toContain('id="flint-cart-checkout"');
    expect(html).toContain('Checkout');
  });

  it('should include ARIA attributes for accessibility', () => {
    const html = Cart.render({});

    expect(html).toContain('aria-label="Shopping cart"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="flint-cart-panel"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('role="dialog"');
  });

  it('should accept custom className', () => {
    const html = Cart.render({ className: 'my-cart-style' });

    expect(html).toContain('my-cart-style');
  });

  it('should show empty cart message by default', () => {
    const html = Cart.render({});

    expect(html).toContain('Cart is empty');
  });
});
