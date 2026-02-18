import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { handleCheckout, type CheckoutRequestBody } from './checkout-server.js';
import type Stripe from 'stripe';

/* ------------------------------------------------------------------ */
/*  Mock Stripe client                                                 */
/* ------------------------------------------------------------------ */

function makeStripeMock(sessionUrl = 'https://checkout.stripe.com/pay/cs_test_abc') {
  return {
    checkout: {
      sessions: {
        create: mock(async () => ({
          id: 'cs_test_abc',
          url: sessionUrl,
        })),
      },
    },
  } as unknown as Stripe;
}

/* ------------------------------------------------------------------ */
/*  handleCheckout unit tests                                          */
/* ------------------------------------------------------------------ */

describe('handleCheckout', () => {
  it('should create a session and return url', async () => {
    const stripe = makeStripeMock();
    const result = await handleCheckout(
      {
        items: [{ priceId: 'price_123', qty: 1 }],
      },
      stripe,
      'http://localhost:3000',
    );
    expect(result.url).toBe('https://checkout.stripe.com/pay/cs_test_abc');
  });

  it('should pass multiple line items to Stripe', async () => {
    const stripe = makeStripeMock();
    const body: CheckoutRequestBody = {
      items: [
        { priceId: 'price_aaa', qty: 2 },
        { priceId: 'price_bbb', qty: 1 },
      ],
    };
    await handleCheckout(body, stripe, 'http://localhost:3000');

    const createCall = (stripe.checkout.sessions.create as ReturnType<typeof mock>).mock.calls[0];
    expect(createCall[0].line_items).toEqual([
      { price: 'price_aaa', quantity: 2 },
      { price: 'price_bbb', quantity: 1 },
    ]);
  });

  it('should use successUrl and cancelUrl from request body when provided', async () => {
    const stripe = makeStripeMock();
    await handleCheckout(
      {
        items: [{ priceId: 'price_xyz', qty: 1 }],
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      },
      stripe,
      'http://localhost:3000',
    );

    const createCall = (stripe.checkout.sessions.create as ReturnType<typeof mock>).mock.calls[0];
    expect(createCall[0].success_url).toBe('https://example.com/success');
    expect(createCall[0].cancel_url).toBe('https://example.com/cancel');
  });

  it('should fall back to siteUrl for success/cancel when not in body', async () => {
    const stripe = makeStripeMock();
    await handleCheckout(
      { items: [{ priceId: 'price_xyz', qty: 1 }] },
      stripe,
      'https://mysite.com',
    );

    const createCall = (stripe.checkout.sessions.create as ReturnType<typeof mock>).mock.calls[0];
    expect(createCall[0].success_url).toBe('https://mysite.com/checkout/success');
    expect(createCall[0].cancel_url).toBe('https://mysite.com/checkout/cancel');
  });

  it('should throw when items array is empty', async () => {
    const stripe = makeStripeMock();
    await expect(
      handleCheckout({ items: [] }, stripe, 'http://localhost:3000'),
    ).rejects.toThrow('items array is required and must not be empty');
  });

  it('should throw when an item has no priceId', async () => {
    const stripe = makeStripeMock();
    await expect(
      handleCheckout(
        { items: [{ priceId: '', qty: 1 }] },
        stripe,
        'http://localhost:3000',
      ),
    ).rejects.toThrow('priceId string');
  });

  it('should throw when an item has qty < 1', async () => {
    const stripe = makeStripeMock();
    await expect(
      handleCheckout(
        { items: [{ priceId: 'price_abc', qty: 0 }] },
        stripe,
        'http://localhost:3000',
      ),
    ).rejects.toThrow('qty >= 1');
  });

  it('should throw when stripe returns no url', async () => {
    const stripe = {
      checkout: {
        sessions: {
          create: mock(async () => ({ id: 'cs_test_abc', url: null })),
        },
      },
    } as unknown as Stripe;

    await expect(
      handleCheckout(
        { items: [{ priceId: 'price_abc', qty: 1 }] },
        stripe,
        'http://localhost:3000',
      ),
    ).rejects.toThrow('session URL');
  });
});
