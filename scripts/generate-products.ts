/**
 * Generate content/shop/<id>.md files from products.yaml
 *
 * Called as the first step of the build pipeline.
 * Generated files are ephemeral — gitignored and recreated every build.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { stringifyFrontmatter } from '../src/core/frontmatter.js';
import { normaliseProduct, type ProductEntry, type ProductCatalogue } from './products-schema.js';

const ROOT = process.cwd();
const YAML_PATH = join(ROOT, 'products.yaml');
const SHOP_DIR = join(ROOT, 'content', 'shop');

/**
 * Read and parse products.yaml into ProductEntry[]
 */
export function loadProductCatalogue(): ProductEntry[] {
  const raw = readFileSync(YAML_PATH, 'utf-8');
  const parsed = yaml.load(raw) as ProductCatalogue;

  if (!parsed?.products || !Array.isArray(parsed.products)) {
    throw new Error('products.yaml must contain a top-level "products" array');
  }

  return parsed.products.map((entry) => normaliseProduct(entry as Record<string, unknown>));
}

/**
 * Build frontmatter data for a product markdown file
 */
function buildFrontmatter(product: ProductEntry): Record<string, unknown> {
  const today = new Date().toISOString().split('T')[0];
  return {
    title: product.title,
    'Short-URI': product.id,
    Template: 'product-detail',
    Type: 'product',
    Category: 'Shop',
    Order: product.order,
    Labels: product.labels,
    Parent: 'shop',
    Author: 'System',
    Date: today,
    Description: product.description,
    PriceCents: product.price_cents,
    Currency: product.currency,
    StripePriceId: product.stripe_price_id || `price_placeholder_${product.id}`,
    StripePaymentLink: product.stripe_payment_link || '',
    Image: product.image,
    Keywords: product.labels,
  };
}

/** Marker written into the scaffold body so we can detect unedited files. */
const SCAFFOLD_MARKER = '<!-- flint:scaffold';

/**
 * Remove previously generated product .md files (not index.md).
 * Files that have had the scaffold marker removed are treated as user-edited
 * and are preserved; only unedited scaffold files are deleted.
 */
function cleanGeneratedFiles(): void {
  mkdirSync(SHOP_DIR, { recursive: true });
  const files = readdirSync(SHOP_DIR);
  for (const file of files) {
    if (file === 'index.md') continue; // preserve hand-authored index
    if (!file.endsWith('.md')) continue;
    const filePath = join(SHOP_DIR, file);
    try {
      const existing = readFileSync(filePath, 'utf-8');
      // Only delete if the file still contains the scaffold marker (i.e. unedited)
      if (existing.includes(SCAFFOLD_MARKER)) {
        rmSync(filePath);
      }
    } catch {
      // File unreadable — delete and regenerate
      rmSync(filePath);
    }
  }
}

/**
 * Generate all product markdown files from the catalogue
 */
export function generateProducts(): void {
  const products = loadProductCatalogue();
  cleanGeneratedFiles();

  for (const product of products) {
    const filePath = join(SHOP_DIR, `${product.id}.md`);
    // Skip files that exist and have already been customised (no scaffold marker)
    try {
      const existing = readFileSync(filePath, 'utf-8');
      if (!existing.includes(SCAFFOLD_MARKER)) {
        continue; // user-edited — leave it alone
      }
    } catch {
      // File doesn't exist — generate it
    }

    const frontmatter = buildFrontmatter(product);
    const scaffoldBody = `${SCAFFOLD_MARKER} — remove this comment line to preserve your edits across builds -->

## Details

<!-- Add a spec table here, e.g.:
| | |
|---|---|
| **Material** | ... |
| **Dimensions** | ... |
-->

## Care Instructions

<!-- Add care and handling instructions here. -->
`;
    const content = stringifyFrontmatter(frontmatter, `\n${scaffoldBody}`);
    writeFileSync(filePath, content, 'utf-8');
  }

  console.log(`✓ Generated ${products.length} product page(s) from products.yaml`);
}

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('generate-products.ts')) {
  generateProducts();
}
