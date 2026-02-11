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

describe('Product detail view', () => {
  const detailProps = {
    id: 'blue-mug',
    title: 'Blue Ceramic Mug',
    price: '$12.00',
    description: 'A beautiful hand-crafted ceramic mug.',
    image: '☕',
    detail: true,
  };

  it('should render a detail layout when detail=true', () => {
    const html = Product.render(detailProps);
    expect(html).toContain('product-detail');
    expect(html).not.toContain('product-card');
  });

  it('should render a large image/emoji area', () => {
    const html = Product.render(detailProps);
    expect(html).toContain('text-8xl');
    expect(html).toContain('☕');
  });

  it('should render an image tag for URL images in detail view', () => {
    const html = Product.render({ ...detailProps, image: '/img/mug.jpg' });
    expect(html).toContain('<img');
    expect(html).toContain('/img/mug.jpg');
  });

  it('should render a stock badge', () => {
    const html = Product.render(detailProps);
    expect(html).toContain('In Stock');
  });

  it('should render the price prominently', () => {
    const html = Product.render(detailProps);
    expect(html).toContain('$12.00');
    expect(html).toContain('text-3xl');
  });

  it('should render the description', () => {
    const html = Product.render(detailProps);
    expect(html).toContain('A beautiful hand-crafted ceramic mug.');
  });

  it('should render Add to Cart button with correct data attributes', () => {
    const html = Product.render(detailProps);
    expect(html).toContain('flint-add-to-cart');
    expect(html).toContain('data-id="blue-mug"');
    expect(html).toContain('data-qty="1"');
  });

  it('should escape HTML in detail view', () => {
    const html = Product.render({
      ...detailProps,
      title: '<script>xss</script>',
      description: '<img onerror=alert(1)>',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<img onerror');
  });

  it('should render card view when detail is false', () => {
    const html = Product.render({ ...detailProps, detail: false });
    expect(html).toContain('product-card');
    expect(html).not.toContain('product-detail');
  });
});
