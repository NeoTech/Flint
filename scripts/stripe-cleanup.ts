/**
 * Stripe cleanup script
 *
 * Removes all Stripe Products, Prices, and Payment Links that were created by
 * Flint (identified by metadata.flint_id). Clears the stripe_price_id and
 * stripe_payment_link fields in products.yaml so the next `bun run build:sync`
 * recreates everything from scratch.
 *
 * Usage:
 *   bun run stripe:cleanup          — interactive confirmation required
 *   bun run stripe:cleanup --force  — skip confirmation (for CI)
 *
 * What it does:
 *   1. List all Stripe Products with metadata.flint_id set
 *   2. Deactivate all Payment Links for those products
 *   3. Archive all Prices for those products
 *   4. Archive the Products themselves (Stripe does not allow hard-deleting products with prices)
 *   5. Clear stripe_price_id + stripe_payment_link in products.yaml
 *
 * After running, use `bun run build:sync:force` to recreate everything.
 */

import Stripe from 'stripe';
import * as fs from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { getStripeClient } from './stripe-sync.js';
import { type ProductCatalogue } from './products-schema.js';

const ROOT = process.cwd();
const YAML_PATH = join(ROOT, 'products.yaml');
const FORCE = process.argv.includes('--force');

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function confirm(message: string): Promise<boolean> {
  process.stdout.write(`\n${message} [y/N] `);
  const buf = Buffer.alloc(4);
  const n = fs.readSync(0, buf, 0, 4, null);
  return buf.slice(0, n).toString().trim().toLowerCase() === 'y';
}

function clearYaml(): void {
  const raw = fs.readFileSync(YAML_PATH, 'utf-8');
  const parsed = yaml.load(raw) as ProductCatalogue;

  if (!parsed?.products) return;

  for (const product of parsed.products) {
    (product as Record<string, unknown>).stripe_price_id = '';
    (product as Record<string, unknown>).stripe_payment_link = '';
  }

  fs.writeFileSync(YAML_PATH, yaml.dump(parsed, { lineWidth: 120, quotingType: '"' }), 'utf-8');
  console.log('  ✔ Cleared stripe_price_id and stripe_payment_link in products.yaml');
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function cleanup(): Promise<void> {
  console.log('\n🧹 Stripe Cleanup — Flint-managed products\n');

  const stripe = getStripeClient();
  const keyPreview = (process.env.STRIPE_SECRET_KEY || '').slice(0, 14) + '...';
  console.log(`  Using key: ${keyPreview}`);

  // 1. Find all Flint-managed products
  console.log('\n  Searching for Flint-managed products...');
  const allProducts: Stripe.Product[] = [];
  for await (const product of stripe.products.list({ limit: 100 })) {
    if (product.metadata?.flint_id) {
      allProducts.push(product);
    }
  }

  if (allProducts.length === 0) {
    console.log('  ✔ No Flint-managed products found in Stripe. Nothing to do.\n');
    return;
  }

  console.log(`\n  Found ${allProducts.length} Flint-managed product(s):`);
  for (const p of allProducts) {
    const status = p.active ? 'active' : 'archived';
    console.log(`    • ${p.metadata.flint_id} — ${p.name} (${status})`);
  }

  // 2. Confirm
  if (!FORCE) {
    const go = await confirm(
      `  ⚠  This will archive ${allProducts.length} product(s) and all their prices in Stripe.\n` +
      '     products.yaml will be updated to clear all stripe IDs.\n' +
      '     Run `bun run build:sync:force` afterwards to recreate them.\n\n' +
      '  Continue?'
    );
    if (!go) {
      console.log('\n  Aborted.\n');
      process.exit(0);
    }
  }

  console.log('');

  // 3. Deactivate Payment Links + archive Prices + archive Products
  for (const product of allProducts) {
    const flintId = product.metadata.flint_id;
    console.log(`  Processing: ${flintId} (${product.id})`);

    // Deactivate all Payment Links for this product
    const links: Stripe.PaymentLink[] = [];
    for await (const link of stripe.paymentLinks.list({ limit: 100 })) {
      // Check if this payment link includes a price from this product
      const lineItems = await stripe.paymentLinks.listLineItems(link.id, { limit: 10 });
      const belongsToProduct = lineItems.data.some(
        (item) => (item.price as Stripe.Price)?.product === product.id
      );
      if (belongsToProduct) links.push(link);
    }

    for (const link of links) {
      if (link.active) {
        await stripe.paymentLinks.update(link.id, { active: false });
        console.log(`    ✔ Deactivated payment link: ${link.id}`);
      }
    }

    // Archive all prices for this product
    const prices: Stripe.Price[] = [];
    for await (const price of stripe.prices.list({ product: product.id, limit: 100 })) {
      prices.push(price);
    }

    for (const price of prices) {
      if (price.active) {
        await stripe.prices.update(price.id, { active: false });
        console.log(`    ✔ Archived price: ${price.id}`);
      }
    }

    // Archive the product
    if (product.active) {
      await stripe.products.update(product.id, { active: false });
      console.log(`    ✔ Archived product: ${product.id}`);
    } else {
      console.log(`    ℹ Product already archived: ${product.id}`);
    }
  }

  // 4. Clear products.yaml
  console.log('\n  Updating products.yaml...');
  clearYaml();

  console.log('\n✅ Cleanup complete!\n');
  console.log('  Run `bun run build:sync:force` to recreate all products in Stripe.\n');
}

cleanup().catch((err) => {
  console.error('\n❌ Cleanup failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
