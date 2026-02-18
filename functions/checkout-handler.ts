/**
 * Checkout Handler — platform-agnostic core logic
 *
 * Contains no platform-specific imports (no Bun, no Cloudflare, no Node HTTP).
 * Both the Bun server and Cloudflare Worker adapters import from here.
 *
 * Adapters are responsible for:
 *  - Parsing the incoming HTTP request
 *  - Building a CheckoutConfig from their platform's env vars
 *  - Calling handleCheckout() and serialising the response
 */

import Stripe from 'stripe';

/* ------------------------------------------------------------------ */
/*  CORS                                                               */
/* ------------------------------------------------------------------ */

// Wildcard CORS is safe here: STRIPE_SECRET_KEY never leaves the server;
// the only response is a Stripe-hosted checkout URL.
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

/**
 * Returns CORS headers that reflect the request origin when it is allowed.
 * Falls back to wildcard when no allowedOrigins are configured.
 * Kept for use by the Bun server which supports more restrictive CORS in dev.
 */
export function getCorsHeaders(
  requestOrigin: string | undefined,
  allowedOrigins: string[] = [],
  siteUrl = '',
  isDev = false,
): Record<string, string> {
  const origin = requestOrigin ?? '';
  const allowed = [
    ...allowedOrigins,
    ...(siteUrl ? [siteUrl.replace(/\/$/, '')] : []),
  ];

  const isAllowed =
    (isDev && (origin.startsWith('http://localhost') || origin.startsWith('https://localhost'))) ||
    allowed.includes(origin) ||
    allowed.length === 0;

  return {
    'Access-Control-Allow-Origin': isAllowed ? (origin || '*') : (allowed[0] ?? '*'),
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export function corsJson(
  body: unknown,
  status = 200,
  corsHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(corsHeaders ?? CORS_HEADERS),
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CheckoutRequestBody {
  items: Array<{ priceId: string; qty: number }>;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutConfig {
  /** 'required' collects billing address on every checkout; 'auto' only when needed */
  billingAddress?: 'required' | 'auto';
  /** ISO 3166-1 alpha-2 country codes allowed for shipping, e.g. ['US','GB'] */
  shippingCountries?: string[];
}

/* ------------------------------------------------------------------ */
/*  Core handler                                                       */
/* ------------------------------------------------------------------ */

export async function handleCheckout(
  body: CheckoutRequestBody,
  stripe: Stripe,
  siteUrl: string,
  config?: CheckoutConfig,
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
  const cancelUrl = body.cancelUrl || siteUrl;

  const billingAddress = config?.billingAddress ?? 'required';
  const shippingCountries = (
    config?.shippingCountries ?? ['US', 'GB']
  ) as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[];

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
