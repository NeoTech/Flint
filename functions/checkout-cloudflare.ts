/**
 * Cloudflare Worker adapter for the Flint checkout handler.
 *
 * Wraps the platform-agnostic handleCheckout() for the Cloudflare Workers
 * runtime. Secrets are injected via the Workers environment (env.*) — never
 * hard-coded here.
 *
 * Deploy:   bun run deploy:checkout:cloudflare
 * Test locally: wrangler dev functions/checkout-cloudflare.ts
 *
 * All four vars below are set as Worker secrets by the deploy script from .env.
 * The code-level defaults below are only a fallback for `wrangler dev` local
 * testing and will never apply in a deployed Worker.
 *
 *   STRIPE_SECRET_KEY          (required secret)
 *   SITE_URL                   (required secret)
 *   STRIPE_BILLING_ADDRESS     (optional secret — fallback: 'required')
 *   STRIPE_SHIPPING_COUNTRIES  (optional secret — fallback: 'US,GB' for local dev only)
 */

import Stripe from 'stripe';
import {
  handleCheckout,
  corsJson,
  CORS_HEADERS,
  type CheckoutRequestBody,
  type CheckoutConfig,
} from './checkout-handler.js';

export interface Env {
  STRIPE_SECRET_KEY: string;
  SITE_URL: string;
  STRIPE_BILLING_ADDRESS?: string;
  STRIPE_SHIPPING_COUNTRIES?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight — wildcard is safe; secret key never leaves this Worker
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health' && request.method === 'GET') {
      return corsJson({ ok: true });
    }

    // Checkout
    if (url.pathname === '/checkout' && request.method === 'POST') {
      let body: CheckoutRequestBody;
      try {
        body = (await request.json()) as CheckoutRequestBody;
      } catch {
        return corsJson({ error: 'Invalid JSON body' }, 400);
      }

      try {
        // Use fetch-based HTTP client for Cloudflare Workers compatibility
        const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
          httpClient: Stripe.createFetchHttpClient(),
          telemetry: false,
        });
        const siteUrl = (env.SITE_URL || '').replace(/\/$/, '');
        const config: CheckoutConfig = {
          billingAddress: ((env.STRIPE_BILLING_ADDRESS || 'required') as 'required' | 'auto'),
          shippingCountries: (env.STRIPE_SHIPPING_COUNTRIES || 'US,GB')
            .split(',')
            .map((c) => c.trim()),
        };
        const result = await handleCheckout(body, stripe, siteUrl, config);
        return corsJson(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return corsJson({ error: message }, 400);
      }
    }

    return corsJson({ error: 'Not found' }, 404);
  },
};
