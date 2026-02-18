/**
 * Bun HTTP adapter for the Flint checkout handler.
 *
 * Wraps the platform-agnostic handleCheckout() in a Bun.serve() server.
 * Used when CHECKOUT_MODE=serverless and CHECKOUT_RUNTIME=bun.
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
import {
  handleCheckout,
  corsJson,
  getCorsHeaders,
  type CheckoutRequestBody,
  type CheckoutConfig,
} from './checkout-handler.js';

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
/*  Re-export handler types for backward compatibility                 */
/* ------------------------------------------------------------------ */

export { handleCheckout, type CheckoutRequestBody } from './checkout-handler.js';

/* ------------------------------------------------------------------ */
/*  Bun HTTP server                                                    */
/* ------------------------------------------------------------------ */

export function createServer(stripe: Stripe, siteUrl: string) {
  const allowedOrigins = (getEnv('ALLOWED_ORIGINS') || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const isDev = getEnv('NODE_ENV') !== 'production';

  return Bun.serve({
    port: getPort(),
    async fetch(req) {
      const origin = req.headers.get('Origin') ?? undefined;
      const cors = getCorsHeaders(origin, allowedOrigins, siteUrl, isDev);
      const url = new URL(req.url);

      // CORS preflight
      if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: cors });
      }

      // Health check
      if (url.pathname === '/health' && req.method === 'GET') {
        return corsJson({ ok: true }, 200, cors);
      }

      // Checkout
      if (url.pathname === '/checkout' && req.method === 'POST') {
        let body: CheckoutRequestBody;
        try {
          body = (await req.json()) as CheckoutRequestBody;
        } catch {
          return corsJson({ error: 'Invalid JSON body' }, 400, cors);
        }

        try {
          const config: CheckoutConfig = {
            billingAddress: (getEnv('STRIPE_BILLING_ADDRESS') || 'required') as 'required' | 'auto',
            shippingCountries: (getEnv('STRIPE_SHIPPING_COUNTRIES') || 'US,GB')
              .split(',')
              .map((c) => c.trim()),
          };
          const result = await handleCheckout(body, stripe, siteUrl, config);
          return corsJson(result, 200, cors);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          console.error('checkout error:', message);
          return corsJson({ error: message }, 400, cors);
        }
      }

      return corsJson({ error: 'Not found' }, 404, cors);
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
