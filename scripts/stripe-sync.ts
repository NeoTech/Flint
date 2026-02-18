/**
 * Stripe product/price sync
 *
 * Activated only when --stripe-sync is passed to the build command.
 * Reads products.yaml, creates or updates Stripe Products and Prices,
 * then writes real stripe_price_id values back to products.yaml.
 *
 * Requires STRIPE_SECRET_KEY in .env or environment.
 */

import Stripe from 'stripe';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { normaliseProduct, type ProductEntry, type ProductCatalogue } from './products-schema.js';

const ROOT = process.cwd();
const YAML_PATH = join(ROOT, 'products.yaml');

export interface SyncResult {
  id: string;
  action: 'created' | 'updated' | 'skipped';
  stripe_product_id: string;
  stripe_price_id: string;
  stripe_payment_link: string;
}

/**
 * Create a Stripe client from the secret key.
 * First checks env, then falls back to .env file parsing.
 */
export function getStripeClient(): Stripe {
  let key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    try {
      const envFile = readFileSync(join(ROOT, '.env'), 'utf-8');
      const match = envFile.match(/^STRIPE_SECRET_KEY=(.+)$/m);
      if (match) key = match[1].trim();
    } catch {
      // .env may not exist
    }
  }

  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY not found. Set it in .env or as an environment variable.\n' +
      'See docs/ecommerce.md for Stripe sandbox setup instructions.'
    );
  }

  return new Stripe(key);
}

/**
 * Load products from the YAML file
 */
function loadProducts(): ProductEntry[] {
  const raw = readFileSync(YAML_PATH, 'utf-8');
  const parsed = yaml.load(raw) as ProductCatalogue;
  if (!parsed?.products || !Array.isArray(parsed.products)) {
    throw new Error('products.yaml must contain a top-level "products" array');
  }
  return parsed.products.map((e) => normaliseProduct(e as Record<string, unknown>));
}

/**
 * Find or create a Stripe Product by flint_id metadata
 */
async function findOrCreateProduct(
  stripe: Stripe,
  product: ProductEntry,
): Promise<{ stripeProduct: Stripe.Product; created: boolean; updated: boolean }> {
  // Search for existing product by metadata
  const existing = await stripe.products.search({
    query: `metadata["flint_id"]:"${product.id}"`,
  });

  if (existing.data.length > 0) {
    const sp = existing.data[0];
    // Update name/description/tax_code if they changed
    const needsUpdate =
      sp.name !== product.title ||
      sp.description !== product.description ||
      sp.tax_code !== (product.tax_code ?? null);

    if (needsUpdate) {
      const updated = await stripe.products.update(sp.id, {
        name: product.title,
        description: product.description,
        ...(product.tax_code ? { tax_code: product.tax_code } : { tax_code: '' }),
      });
      return { stripeProduct: updated, created: false, updated: true };
    }
    return { stripeProduct: sp, created: false, updated: false };
  }

  // Create new product
  const created = await stripe.products.create({
    name: product.title,
    description: product.description,
    metadata: { flint_id: product.id },
    ...(product.tax_code ? { tax_code: product.tax_code } : {}),
  });

  return { stripeProduct: created, created: true, updated: false };
}

/**
 * Ensure the correct price exists for a product.
 * If price_cents changed, archive old price and create a new one.
 */
async function ensurePrice(
  stripe: Stripe,
  stripeProduct: Stripe.Product,
  product: ProductEntry,
  existingPriceId: string,
): Promise<{ priceId: string; action: 'created' | 'skipped' | 'updated' }> {
  // Check if the existing price ID is still valid and matches
  if (existingPriceId && existingPriceId !== '' && !existingPriceId.startsWith('price_placeholder_')) {
    try {
      const existingPrice = await stripe.prices.retrieve(existingPriceId);
      if (
        existingPrice.active &&
        existingPrice.unit_amount === product.price_cents &&
        existingPrice.currency === product.currency
      ) {
        return { priceId: existingPriceId, action: 'skipped' };
      }

      // Price amount changed — archive old price
      await stripe.prices.update(existingPriceId, { active: false });
    } catch {
      // Price doesn't exist in Stripe — will create a new one
    }
  }

  // List active prices for this product to find a matching one
  const prices = await stripe.prices.list({
    product: stripeProduct.id,
    active: true,
    limit: 100,
  });

  const matching = prices.data.find(
    (p) => p.unit_amount === product.price_cents && p.currency === product.currency,
  );

  if (matching) {
    return { priceId: matching.id, action: 'skipped' };
  }

  // Archive any other active prices for this product (one price per product policy)
  for (const p of prices.data) {
    if (p.active) {
      await stripe.prices.update(p.id, { active: false });
    }
  }

  // Create new price
  const newPrice = await stripe.prices.create({
    product: stripeProduct.id,
    unit_amount: product.price_cents,
    currency: product.currency,
  });

  return {
    priceId: newPrice.id,
    action: existingPriceId && !existingPriceId.startsWith('price_placeholder_') ? 'updated' : 'created',
  };
}

/**
 * Read SITE_URL from environment or .env file.
 * Used as the after_completion redirect for Payment Links.
 */
function getSiteUrl(): string {
  let siteUrl = process.env.SITE_URL;

  if (!siteUrl) {
    try {
      const envFile = readFileSync(join(ROOT, '.env'), 'utf-8');
      const match = envFile.match(/^SITE_URL=(.+)$/m);
      if (match) siteUrl = match[1].trim();
    } catch {
      // .env may not exist
    }
  }

  return (siteUrl || 'http://localhost:3000').replace(/\/$/, '');
}

/**
 * Find or create a Stripe Payment Link for a given price ID.
 * If one already exists for this price (checked by metadata), reuse it.
 * If the price changed (priceId differs from existing link's price), create a new link.
 */
async function ensurePaymentLink(
  stripe: Stripe,
  priceId: string,
  product: ProductEntry,
  existingLink: string,
  force = false,
): Promise<string> {
  const siteUrl = getSiteUrl();
  const successUrl = `${siteUrl}/checkout/success`;

  const billingAddress = (process.env.STRIPE_BILLING_ADDRESS || 'required') as 'required' | 'auto';
  const shippingCountries = (process.env.STRIPE_SHIPPING_COUNTRIES || 'US,GB')
    .split(',')
    .map(c => c.trim()) as Stripe.PaymentLink.ShippingAddressCollection.AllowedCountry[];

  // Check for an existing active link — unless force is set, reuse it if still valid
  if (existingLink && existingLink.startsWith('https://')) {
    try {
      const links = await stripe.paymentLinks.list({ limit: 100, active: true });
      const match = links.data.find(
        (l) => l.metadata?.['flint_id'] === product.id && l.active,
      );
      if (match) {
        if (!force) {
          const items = await stripe.paymentLinks.listLineItems(match.id, { limit: 1 });
          const samePriceId = items.data[0]?.price?.id === priceId;
          const hasBilling = match.billing_address_collection === billingAddress;
          const hasShipping = match.shipping_address_collection != null &&
            match.shipping_address_collection.allowed_countries?.length > 0;
          const sameSuccessUrl =
            match.after_completion?.type === 'redirect' &&
            match.after_completion.redirect?.url === successUrl;

          if (samePriceId && hasBilling && hasShipping && sameSuccessUrl) {
            return match.url;
          }
        }
        // Force mode, price changed, or address settings differ — deactivate and recreate
        await stripe.paymentLinks.update(match.id, { active: false });
      }
    } catch {
      // continue to create a new link
    }
  }

  // Create a new Payment Link
  const link = await stripe.paymentLinks.create({
    line_items: [{ price: priceId, quantity: 1 }],
    billing_address_collection: billingAddress,
    shipping_address_collection: { allowed_countries: shippingCountries },
    after_completion: {
      type: 'redirect',
      redirect: { url: successUrl },
    },
    metadata: { flint_id: product.id },
  });

  return link.url;
}

/**
 * Write updated stripe_price_id and stripe_payment_link values back to products.yaml
 */
function writeBackPriceIds(results: SyncResult[]): void {
  const rawYaml = readFileSync(YAML_PATH, 'utf-8');
  let updated = rawYaml;

  for (const result of results) {
    // Patch stripe_price_id
    const pricePattern = new RegExp(
      `(- id: ${result.id}[\\s\\S]*?stripe_price_id:\\s*)["']?[^\\n]*["']?`,
    );
    updated = updated.replace(pricePattern, `$1"${result.stripe_price_id}"`);

    // Patch stripe_payment_link
    const linkPattern = new RegExp(
      `(- id: ${result.id}[\\s\\S]*?stripe_payment_link:\\s*)["']?[^\\n]*["']?`,
    );
    updated = updated.replace(linkPattern, `$1"${result.stripe_payment_link}"`);
  }

  writeFileSync(YAML_PATH, updated, 'utf-8');
}

/**
 * Sync all products to Stripe and write back price IDs.
 * Pass force=true to deactivate and recreate all Payment Links (e.g. after changing SITE_URL).
 */
export async function stripeSync(force = false): Promise<SyncResult[]> {
  const stripe = getStripeClient();
  const products = loadProducts();
  const results: SyncResult[] = [];

  if (force) {
    console.log(`\n🔄 Force-syncing ${products.length} product(s) to Stripe (Payment Links will be recreated)...\n`);
  } else {
    console.log(`\n🔄 Syncing ${products.length} product(s) to Stripe...\n`);
  }

  for (const product of products) {
    const { stripeProduct, created: productCreated, updated: productUpdated } = await findOrCreateProduct(stripe, product);

    const { priceId, action: priceAction } = await ensurePrice(
      stripe,
      stripeProduct,
      product,
      product.stripe_price_id,
    );

    const paymentLink = await ensurePaymentLink(stripe, priceId, product, product.stripe_payment_link, force);

    const action: SyncResult['action'] =
      productCreated ? 'created' :
      priceAction === 'created' ? 'created' :
      priceAction === 'updated' || productUpdated ? 'updated' :
      'skipped';

    results.push({
      id: product.id,
      action,
      stripe_product_id: stripeProduct.id,
      stripe_price_id: priceId,
      stripe_payment_link: paymentLink,
    });

    const icon = action === 'created' ? '✨' : action === 'updated' ? '🔄' : '✓';
    console.log(`  ${icon} ${product.title} (${product.id}) — ${action} — ${priceId} — ${paymentLink}`);
  }

  // Write back price IDs to products.yaml
  writeBackPriceIds(results);
  console.log(`\n✓ Stripe sync complete. Updated products.yaml with price IDs.\n`);

  return results;
}

// Allow direct execution
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('stripe-sync.ts')) {
  const force = process.argv.includes('--force');
  stripeSync(force).catch((err) => {
    console.error('❌ Stripe sync failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
