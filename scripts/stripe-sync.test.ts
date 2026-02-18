/**
 * Stripe sync integration tests
 *
 * These tests require a real STRIPE_SECRET_KEY to run.
 * They are auto-skipped if the key is not available.
 *
 * Run with: STRIPE_SECRET_KEY=sk_test_... bun test scripts/stripe-sync.test.ts
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const YAML_PATH = join(ROOT, 'products.yaml');

function hasStripeKey(): boolean {
  if (process.env.STRIPE_SECRET_KEY) return true;
  try {
    const envFile = readFileSync(join(ROOT, '.env'), 'utf-8');
    return /^STRIPE_SECRET_KEY=sk_test_/m.test(envFile);
  } catch {
    return false;
  }
}

/**
 * Validate the key actually works before running the full suite.
 * Prevents noisy 401 failures when the key is expired/revoked.
 */
async function validateStripeKey(): Promise<boolean> {
  if (!hasStripeKey()) return false;
  try {
    const { getStripeClient } = await import('./stripe-sync.js');
    const stripe = getStripeClient();
    await stripe.products.list({ limit: 1 });
    return true;
  } catch {
    return false;
  }
}

let stripeKeyValid = false;
try {
  stripeKeyValid = await validateStripeKey();
} catch {
  stripeKeyValid = false;
}

const describeStripe = stripeKeyValid ? describe : describe.skip;

describeStripe('stripe-sync (integration)', () => {
  let originalYaml: string;

  beforeAll(() => {
    originalYaml = readFileSync(YAML_PATH, 'utf-8');
  });

  test('stripeSync creates products and writes back price IDs', async () => {
    // Dynamic import to avoid loading Stripe when key is absent
    const { stripeSync } = await import('./stripe-sync.js');

    const results = await stripeSync();
    expect(results.length).toBeGreaterThan(0);

    for (const result of results) {
      expect(result.stripe_price_id).toMatch(/^price_/);
      expect(result.stripe_product_id).toMatch(/^prod_/);
      expect(['created', 'updated', 'skipped']).toContain(result.action);
    }

    // Verify products.yaml was updated
    const updatedYaml = readFileSync(YAML_PATH, 'utf-8');
    for (const result of results) {
      expect(updatedYaml).toContain(result.stripe_price_id);
    }
  }, 30000); // 30s timeout for Stripe API calls

  test('second sync skips unchanged products', async () => {
    const { stripeSync } = await import('./stripe-sync.js');

    const results = await stripeSync();
    const skipped = results.filter((r) => r.action === 'skipped');
    expect(skipped.length).toBe(results.length);
  }, 30000);
});

describe('stripe-sync (unit — no API key needed)', () => {
  test('module exports stripeSync function', async () => {
    const mod = await import('./stripe-sync.js');
    expect(typeof mod.stripeSync).toBe('function');
  });

  test('module exports getStripeClient function', async () => {
    const mod = await import('./stripe-sync.js');
    expect(typeof mod.getStripeClient).toBe('function');
  });
});
