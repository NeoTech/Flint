/**
 * Bun Serverless Checkout Function
 *
 * Creates Stripe Checkout Sessions from cart lineItems.
 * Used when CHECKOUT_MODE=serverless in .env.
 *
 * Run:   bun run serve:checkout   (dev, reads .env)
 *        bun run start:checkout   (production)
 *
 * POST /checkout
 *   Body: { items: [{ priceId: string; qty: number }], successUrl?: string, cancelUrl?: string }
 *   Returns: { url: string }
 *
 * GET /health
 *   Returns: { ok: true }
 */

import Stripe from 'stripe';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

function readEnvFile(): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(join(ROOT, '.env'), 'utf-8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#') && l.includes('='))
        .map((l) => {
          const idx = l.indexOf('=');
          return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()] as [string, string];
        }),
    );
  } catch {
    return {};
  }
}

function getEnv(key: string): string {
  return process.env[key] || readEnvFile()[key] || '';
}

export function getStripeSecret(): string {
  const key = getEnv('STRIPE_SECRET_KEY');
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY not set. Add it to .env or set as an environment variable.',
    );
  }
  return key;
}

function getSiteUrl(): string {
  return (getEnv('SITE_URL') || 'http://localhost:3000').replace(/\/$/, '');
}

function getPort(): number {
  return parseInt(getEnv('CHECKOUT_PORT') || '3001', 10);
}

/* ------------------------------------------------------------------ */
/*  CORS helpers                                                       */
/* ------------------------------------------------------------------ */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function corsJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

/* ------------------------------------------------------------------ */
/*  Request handlers                                                   */
/* ------------------------------------------------------------------ */

export interface CheckoutRequestBody {
  items: Array<{ priceId: string; qty: number }>;
  successUrl?: string;
  cancelUrl?: string;
}

export async function handleCheckout(
  body: CheckoutRequestBody,
  stripe: Stripe,
  siteUrl: string,
): Promise<{ url: string }> {
  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    throw new Error('items array is required and must not be empty');
  }

  for (const item of body.items) {
    if (!item.priceId || typeof item.priceId !== 'string') {
      throw new Error('Each item must have a priceId string');
    }
    if (!item.qty || typeof item.qty !== 'number' || item.qty < 1) {
      throw new Error('Each item must have a qty >= 1');
    }
  }

  const successUrl = body.successUrl || `${siteUrl}/checkout/success`;
  const cancelUrl = body.cancelUrl || `${siteUrl}/checkout/cancel`;

  const billingAddress = (getEnv('STRIPE_BILLING_ADDRESS') || 'required') as 'required' | 'auto';
  const shippingCountries = (getEnv('STRIPE_SHIPPING_COUNTRIES') || 'US,GB')
    .split(',')
    .map(c => c.trim()) as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[];

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: body.items.map((item) => ({
      price: item.priceId,
      quantity: item.qty,
    })),
    billing_address_collection: billingAddress,
    shipping_address_collection: { allowed_countries: shippingCountries },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  if (!session.url) {
    throw new Error('Stripe did not return a session URL');
  }

  return { url: session.url };
}

/* ------------------------------------------------------------------ */
/*  Bun HTTP server                                                    */
/* ------------------------------------------------------------------ */

export function createServer(stripe: Stripe, siteUrl: string) {
  return Bun.serve({
    port: getPort(),
    async fetch(req) {
      const url = new URL(req.url);

      // CORS preflight
      if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }

      // Health check
      if (url.pathname === '/health' && req.method === 'GET') {
        return corsJson({ ok: true });
      }

      // Checkout
      if (url.pathname === '/checkout' && req.method === 'POST') {
        let body: CheckoutRequestBody;
        try {
          body = (await req.json()) as CheckoutRequestBody;
        } catch {
          return corsJson({ error: 'Invalid JSON body' }, 400);
        }

        try {
          const result = await handleCheckout(body, stripe, siteUrl);
          return corsJson(result);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          console.error('checkout error:', message);
          return corsJson({ error: message }, 400);
        }
      }

      return corsJson({ error: 'Not found' }, 404);
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Entry point                                                        */
/* ------------------------------------------------------------------ */

if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('checkout-server.ts')
) {
  const stripe = new Stripe(getStripeSecret());
  const siteUrl = getSiteUrl();
  const server = createServer(stripe, siteUrl);
  console.log(`\n🚀 Checkout server running at http://localhost:${server.port}`);
  console.log(`   POST /checkout  — create Stripe Checkout Session`);
  console.log(`   GET  /health    — health check`);
  console.log(`   SITE_URL: ${siteUrl}\n`);
}
