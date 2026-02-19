import { describe, test, expect } from 'bun:test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { normaliseProduct, PRODUCT_DEFAULTS } from './products-schema.js';
import { generateProducts, loadProductCatalogue } from './generate-products.js';

const ROOT = process.cwd();
const SHOP_DIR = join(ROOT, 'content', 'shop');

/* ------------------------------------------------------------------ */
/*  products-schema tests                                             */
/* ------------------------------------------------------------------ */
describe('products-schema', () => {
  test('normaliseProduct fills defaults', () => {
    const entry = normaliseProduct({
      id: 'test-item',
      title: 'Test Item',
      description: 'A test',
      price_cents: 500,
    });

    expect(entry.currency).toBe(PRODUCT_DEFAULTS.currency);
    expect(entry.image).toBe(PRODUCT_DEFAULTS.image);
    expect(entry.order).toBe(PRODUCT_DEFAULTS.order);
    expect(entry.labels).toEqual(PRODUCT_DEFAULTS.labels);
    expect(entry.stripe_price_id).toBe('');
  });

  test('normaliseProduct preserves explicit values', () => {
    const entry = normaliseProduct({
      id: 'mug',
      title: 'Mug',
      description: 'A mug',
      price_cents: 1200,
      currency: 'eur',
      image: '☕',
      order: 1,
      labels: ['shop', 'mug'],
      stripe_price_id: 'price_abc',
      body: '## Details',
    });

    expect(entry.currency).toBe('eur');
    expect(entry.image).toBe('☕');
    expect(entry.order).toBe(1);
    expect(entry.stripe_price_id).toBe('price_abc');
  });

  test('normaliseProduct throws on missing id', () => {
    expect(() => normaliseProduct({ title: 'X', description: 'X', price_cents: 1 })).toThrow('id');
  });

  test('normaliseProduct throws on missing title', () => {
    expect(() => normaliseProduct({ id: 'x', description: 'X', price_cents: 1 })).toThrow('title');
  });

  test('normaliseProduct throws on missing description', () => {
    expect(() => normaliseProduct({ id: 'x', title: 'X', price_cents: 1 })).toThrow('description');
  });

  test('normaliseProduct throws on missing price_cents', () => {
    expect(() => normaliseProduct({ id: 'x', title: 'X', description: 'X' })).toThrow('price_cents');
  });
});

/* ------------------------------------------------------------------ */
/*  generate-products tests                                           */
/* ------------------------------------------------------------------ */
describe('generate-products', () => {
  test('loadProductCatalogue parses products.yaml', () => {
    const products = loadProductCatalogue();
    expect(products.length).toBeGreaterThan(0);
    expect(products[0].id).toBe('blue-mug');
    expect(products[0].price_cents).toBe(1200);
  });

  test('generateProducts creates .md files', () => {
    generateProducts();

    const mdPath = join(SHOP_DIR, 'blue-mug.md');
    expect(existsSync(mdPath)).toBe(true);

    const content = readFileSync(mdPath, 'utf-8');
    expect(content).toContain('title: Blue Ceramic Mug');
    expect(content).toContain('Type: product');
    expect(content).toContain('Template: product-detail');
    expect(content).toContain('PriceCents: 1200');
    expect(content).toContain('Parent: shop');
  });

  test('generateProducts preserves index.md', () => {
    generateProducts();
    expect(existsSync(join(SHOP_DIR, 'index.md'))).toBe(true);
  });

  test('generated file contains body content', () => {
    generateProducts();
    const content = readFileSync(join(SHOP_DIR, 'blue-mug.md'), 'utf-8');
    expect(content).toContain('## Details');
    expect(content).toContain('## Care Instructions');
  });
});
