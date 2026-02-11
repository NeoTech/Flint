import { describe, it, expect } from 'bun:test';
import { Product } from './product.js';

describe('Product', () => {
  const defaultProps = {
    id: 'blue-mug',
    title: 'Blue Ceramic Mug',
  };

  it('should render an article element', () => {
    const html = Product.render(defaultProps);

    expect(html).toContain('<article');
    expect(html).toContain('product-card');
  });

  it('should render the product title', () => {
    const html = Product.render(defaultProps);

    expect(html).toContain('Blue Ceramic Mug');
  });

  it('should render the price when provided', () => {
    const html = Product.render({ ...defaultProps, price: '$12.00' });

    expect(html).toContain('$12.00');
  });

  it('should omit price element when not provided', () => {
    const html = Product.render(defaultProps);

    expect(html).not.toContain('font-semibold text-gray-900');
  });

  it('should render the description', () => {
    const html = Product.render({ ...defaultProps, description: 'A lovely mug' });

    expect(html).toContain('A lovely mug');
  });

  it('should render an image when provided', () => {
    const html = Product.render({ ...defaultProps, image: '/img/mug.jpg' });

    expect(html).toContain('<img');
    expect(html).toContain('/img/mug.jpg');
  });

  it('should render a placeholder when no image provided', () => {
    const html = Product.render(defaultProps);

    expect(html).toContain('📦');
    expect(html).not.toContain('<img');
  });

  it('should render an Add to Cart button with correct data attributes', () => {
    const html = Product.render(defaultProps);

    expect(html).toContain('flint-add-to-cart');
    expect(html).toContain('data-id="blue-mug"');
    expect(html).toContain('data-qty="1"');
    expect(html).toContain('Add to Cart');
  });

  it('should include an aria-label on the Add button', () => {
    const html = Product.render(defaultProps);

    expect(html).toContain('aria-label="Add Blue Ceramic Mug to cart"');
  });

  it('should escape HTML in title and description', () => {
    const html = Product.render({
      id: 'test',
      title: '<script>alert("xss")</script>',
      description: '<img onerror=alert(1)>',
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    // The raw <img tag must be escaped so the browser won't parse it
    expect(html).not.toContain('<img onerror');
    expect(html).toContain('&lt;img onerror=alert(1)&gt;');
  });

  it('should accept custom className', () => {
    const html = Product.render({ ...defaultProps, className: 'featured' });

    expect(html).toContain('featured');
  });
});
