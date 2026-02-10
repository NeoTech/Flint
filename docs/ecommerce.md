# E-commerce Integration (Flint)

This document describes the lightweight, fully client-side e-commerce system built into Flint. No backend server is required — the entire checkout flow runs in the browser using Stripe.js and client-only `redirectToCheckout`.

---

## Architecture Overview

```
content/shop/blue-mug.md   ← Product defined in Markdown frontmatter
        │
        ▼  (build)
dist/static/products/index.json   ← Auto-generated product index
dist/shop/index.html              ← Shop listing via :::children type=product
dist/shop/blue-mug/index.html     ← Product detail page
        │
        ▼  (browser)
CartAPI (IndexedDB)  →  Stripe.js redirectToCheckout  →  Stripe hosted checkout
```

### Key Modules

| Module | Purpose |
|--------|---------|
| `src/components/cart.ts` | Server-rendered cart placeholder HTML (hydrated client-side) |
| `src/components/product.ts` | Server-rendered product card with `.flint-add-to-cart` buttons. **Data-driven** — the `{{product}}` tag reads `Short-URI`, `PriceCents`, `Description`, and `Image` from the page's frontmatter. |
| `src/client/cart-api.ts` | Client-side cart — IndexedDB persistence with optional AES-GCM encryption |
| `src/client/cart-hydrate.ts` | Cart UI hydration: renders items, totals, qty ±, remove, Stripe checkout |
| `src/client/product-hydrate.ts` | Binds Add-to-Cart buttons to CartAPI, shows "✓ Added!" feedback |
| `src/core/builder.ts` | Auto-generates `dist/static/products/index.json` from `Type: product` pages |

---

## Adding a Product

Products are ordinary Markdown files with `Type: product` in frontmatter. No static JSON or HTML fragments are needed.

### 1. Create the Markdown file

```markdown
---
title: Blue Ceramic Mug
Short-URI: blue-mug
Template: shop
Type: product
Category: Shop
Order: 1
Labels:
  - shop
Parent: shop
Author: System
Date: 2024-02-01
Description: A beautiful hand-crafted ceramic mug.
PriceCents: 1200
Currency: usd
StripePriceId: price_1QxYourRealStripeTestPriceId
Image: ☕
Keywords:
  - shop
  - mug
---

# Blue Ceramic Mug

Product detail content goes here...
```

**Product-specific frontmatter fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `Type: product` | Yes | Marks this page as a product |
| `PriceCents` | Yes | Price in cents (e.g. `1200` = $12.00) |
| `Currency` | No | ISO currency code (default: `usd`) |
| `StripePriceId` | Yes | Stripe Price ID from your Stripe Dashboard |
| `Image` | No | Image URL or emoji for product card thumbnails |

> **Note:** `Price-Cents` and `Stripe-Price-Id` (hyphenated) are also accepted.

### 2. The build does the rest

Running `npm run build` will:
- Render the product detail page to `dist/shop/blue-mug/index.html`
- Include it in the shop listing via `:::children type=product`
- Auto-generate `dist/static/products/index.json` with all product metadata

### 3. Shop listing template

The shop page (`content/shop/index.md`) uses `:::children` with `type=product` to render only product children:

```markdown
:::children sort=order type=product class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6"
<article class="product-card ...">
  <a href="{url}">
    <span>{image}</span>
    <h3>{title}</h3>
    <p>{description}</p>
  </a>
  <div>
    <span>{price}</span>
    <button class="flint-add-to-cart" data-id="{short-uri}" data-qty="1">Add to Cart</button>
  </div>
</article>
:::
```

Available product placeholders: `{title}`, `{url}`, `{description}`, `{price}`, `{image}`, `{short-uri}`, `{price-cents}`, `{currency}`, `{stripe-price-id}`.

---

## Stripe Configuration

### How it works

Flint uses **client-only Stripe Checkout** via `Stripe(publishableKey).redirectToCheckout({ lineItems })`. This means:

- **No backend** — the site can be hosted on GitHub Pages, Netlify, etc.
- **Only the publishable key** is used — never the secret key
- **Stripe Price IDs** are embedded in product frontmatter and passed directly to Stripe
- Stripe handles the entire payment page, PCI compliance, and card processing

### Getting your Stripe keys

1. Sign up / log in at [dashboard.stripe.com](https://dashboard.stripe.com)
2. Make sure you're in **Test mode** (toggle in top-right)
3. Go to **Developers → API keys**
4. Copy the **Publishable key** (`pk_test_...`)

### Creating products in Stripe

1. Go to [dashboard.stripe.com/test/products](https://dashboard.stripe.com/test/products)
2. Click **Add product**
3. Set the name (e.g. "Blue Ceramic Mug"), price ($12.00), and one-time payment
4. After saving, click the price row to reveal the **Price ID** (`price_1Qx...`)
5. Copy this into your Markdown frontmatter as `StripePriceId`

### Injecting the key

The publishable key is injected at runtime via `window.__FLINT_CONFIG__`:

```typescript
// src/index.ts
(window as any).__FLINT_CONFIG__ = {
  stripePublishableKey: 'pk_test_YOUR_KEY_HERE',
  successUrl: window.location.origin + '/shop?success=true',
  cancelUrl: window.location.origin + '/shop?cancelled=true',
};
```

For production, inject via environment variable at build time using Rspack's `DefinePlugin`:

```typescript
// rspack.config.ts
new rspack.DefinePlugin({
  'process.env.STRIPE_PUBLISHABLE_KEY': JSON.stringify(
    process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_FALLBACK'
  ),
}),
```

Then reference `process.env.STRIPE_PUBLISHABLE_KEY` in `src/index.ts`.

---

## Testing the Checkout Flow

### Level 1 — Unit tests (no Stripe, no browser)

Test the cart-to-lineItems data transformation:

```typescript
it('builds correct lineItems from cart + product index', () => {
  const cart = [{ id: 'blue-mug', quantity: 2 }];
  const index = { 'blue-mug': { stripe_price_id: 'price_1Example' } };

  const lineItems = cart.map(item => ({
    price: index[item.id].stripe_price_id,
    quantity: item.quantity,
  }));

  expect(lineItems).toEqual([{ price: 'price_1Example', quantity: 2 }]);
});
```

Run with: `npm run test:run`

### Level 2 — Test mode (real browser, fake money)

1. Set `stripePublishableKey` to your `pk_test_...` key
2. Set `StripePriceId` in product frontmatter to real Stripe test Price IDs
3. Build and start the dev server: `npm run build && npm run dev`
4. Open `http://localhost:8080/shop`
5. Add a product to cart, then click **Checkout**
6. Stripe redirects to its hosted checkout page
7. Use a test card number:

| Card Number | Behaviour |
|-------------|-----------|
| `4242 4242 4242 4242` | ✅ Succeeds |
| `4000 0000 0000 3220` | 🔐 Requires 3D Secure |
| `4000 0000 0000 9995` | ❌ Declined |
| `4000 0025 0000 3155` | 🔐 Requires authentication |

Use any future expiry date and any 3-digit CVC.

### Level 3 — Production (live keys, real charges)

1. Add `STRIPE_PUBLISHABLE_KEY` (`pk_live_...`) as a GitHub Actions secret
2. Reference it in your deploy workflow:

```yaml
- name: Build site
  run: npm run build
  env:
    STRIPE_PUBLISHABLE_KEY: ${{ secrets.STRIPE_PUBLISHABLE_KEY }}
```

3. Rspack's `DefinePlugin` injects the key into the client bundle at build time

---

## Cart Persistence

The cart is stored in **IndexedDB** (`flint-db` database, `kv` store):

- On HTTPS: cart data is encrypted with AES-GCM via the Web Crypto API
- On HTTP (local dev): falls back to plain JSON (crypto.subtle is unavailable)
- The `CartAPI` dispatches `cart:updated` and `cart:ready` CustomEvents for UI hydration

---

## Security Notes

- **Never commit secret keys.** Only the Stripe publishable key (`pk_test_` / `pk_live_`) is used in the client bundle — this is safe by design.
- For production, inject the publishable key via CI/CD environment variables, not hardcoded in source.
- If you later need server-side checkout sessions, use Stripe Payment Links or add a serverless function — keep the secret key on the server only.
- Cart encryption (AES-GCM) is a defence-in-depth measure for the local IndexedDB store; it is not a substitute for Stripe's payment security.
