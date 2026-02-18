# E-commerce Integration (Flint)

This document describes the lightweight e-commerce system built into Flint. No backend server is required by default — choose between two checkout modes depending on your hosting setup.

---

## Architecture Overview

```
products.yaml                     ← Single source of truth for all products
        │
        ├──(--stripe-sync)→ Stripe API   ← Create/update Products + Prices + Payment Links
        │                     │
        │                     └─→ writes stripe_price_id + stripe_payment_link back to products.yaml
        │
        ├──(generate)→ content/shop/<id>.md   ← Ephemeral, gitignored
        │
        │  (build)
        │
        ▼
dist/static/products/index.json   ← Auto-generated product index (includes payment links)
dist/shop/index.html              ← Shop listing via :::children type=product
dist/shop/<id>/index.html         ← Product detail pages
        │
        ▼  (browser)

  payment-links mode (default, no server):
    └→ Add to Cart button → window.location.href = stripe_payment_link

  serverless mode (multi-item cart):
    └→ CartAPI (IndexedDB) → POST /checkout to Bun server → Stripe Checkout Session URL → redirect
```

### Key Modules

| Module | Purpose |
|--------|---------|
| `products.yaml` | Product catalogue — all product data lives here |
| `scripts/products-schema.ts` | TypeScript types + validation for product entries |
| `scripts/generate-products.ts` | Generates `content/shop/*.md` from `products.yaml` |
| `scripts/stripe-sync.ts` | Creates/updates Stripe Products + Prices, writes back IDs |
| `scripts/obfuscate-key.ts` | XOR-obfuscates the Stripe publishable key for the client bundle |
| `src/components/cart.ts` | Server-rendered cart placeholder HTML (hydrated client-side) |
| `src/components/product.ts` | Server-rendered product card with `.flint-add-to-cart` buttons |
| `src/client/cart-api.ts` | Client-side cart — IndexedDB persistence with optional AES-GCM encryption |
| `src/client/cart-hydrate.ts` | Cart UI hydration: renders items, totals, qty ±, remove, Stripe checkout |
| `src/client/product-hydrate.ts` | Binds Add-to-Cart buttons to CartAPI, shows "✓ Added!" feedback |
| `src/core/builder.ts` | Auto-generates `dist/static/products/index.json` from `Type: product` pages |

---

## Product Catalogue (`products.yaml`)

All products are defined in a single YAML file at the project root. This is the **only file you edit** to manage products.

```yaml
products:
  - id: blue-mug                         # URL slug (required, unique)
    title: Blue Ceramic Mug              # Display name (required)
    description: >-                      # Short description (required)
      A beautiful hand-crafted ceramic mug.
    price_cents: 1200                    # $12.00 (required)
    currency: usd                        # ISO 4217, default: usd
    image: "☕"                           # Emoji or URL, default: 📦
    order: 1                             # Sort order on shop page, default: 100
    labels:                              # For filtering/cross-referencing
      - shop
      - mug
    stripe_price_id: ""                  # Written by --stripe-sync
    stripe_payment_link: ""              # Written by --stripe-sync (Payment Link URL)
    body: |                              # Optional extra Markdown content
      ## Details
      | Material | Ceramic |
```

### Product fields reference

| Field | Required | Type | Default | Notes |
|-------|----------|------|---------|-------|
| `id` | Yes | string | — | URL slug, used as filename + cart ID |
| `title` | Yes | string | — | Product display name |
| `description` | Yes | string | — | Short description |
| `price_cents` | Yes | number | — | Price in smallest currency unit |
| `currency` | No | string | `usd` | ISO 4217 code |
| `image` | No | string | `📦` | Emoji or image URL |
| `order` | No | number | `100` | Sort position on shop page |
| `labels` | No | string[] | `[shop]` | Labels for cross-referencing |
| `stripe_price_id` | No | string | `""` | Written back by `--stripe-sync` |
| `stripe_payment_link` | No | string | `""` | Stripe Payment Link URL — written back by `--stripe-sync` |
| `body` | No | string | `""` | Extra Markdown rendered on the product page |

---

## Build Pipeline

### Commands

| Command | What it does |
|---------|-------------|
| `bun run generate` | Only generate `.md` files from `products.yaml` (quick preview) |
| `bun run build` | Generate products → build site |
| `bun run build:sync` | Generate → Stripe sync (Prices + Payment Links) → re-generate → build |
| `bun run serve:checkout` | Start the Bun checkout server on port 3001 (dev mode, reads `.env`) |
| `bun run start:checkout` | Start in production mode (`NODE_ENV=production`) |
| `bun run dev` | Start dev server (serves what's already in `dist/`) |

**Typical workflows:**

```bash
# Day-to-day development
bun run build && bun run dev

# After changing prices or adding products
bun run build:sync && bun run dev

# Just preview the generated markdown
bun run generate
```

> **Note:** `build` and `build:sync` both call `generate` internally — you never need to chain them manually.

---

## Checkout Modes

Set `CHECKOUT_MODE` in `.env` to control how checkout works. The default is `payment-links`.

### Mode 1: `payment-links` (default — no server)

Each product gets a pre-generated [Stripe Payment Link](https://stripe.com/docs/payment-links) created by `--stripe-sync` and stored in `stripe_payment_link`. Clicking the product’s “Add to Cart” button navigates directly to that link.

**Pros:** Zero infrastructure. Works on any static host (GitHub Pages, Netlify, Vercel, etc.).  
**Cons:** One product per checkout session. Multi-item cart checkout shows an error — user must buy each product individually.

```
# .env
CHECKOUT_MODE=payment-links
SITE_URL=https://yoursite.com       # Used as after_completion redirect
```

Workflow:
```bash
bun run build:sync   # Creates Payment Links in Stripe, writes URLs to products.yaml
bun run build        # Builds site with payment links embedded in product cards
bun run dev          # Click "Add to Cart" → navigates directly to Stripe
```

### Mode 2: `serverless` (multi-item cart)

The cart works normally (add multiple products, manage quantities). Clicking **Checkout** POSTs the cart to a [Bun HTTP server](../functions/checkout-server.ts) which creates a Stripe Checkout Session and returns a URL.

**Pros:** Full multi-item cart. One checkout for all items.  
**Cons:** Requires hosting a Bun server alongside the static site.

```
# .env
CHECKOUT_MODE=serverless
CHECKOUT_ENDPOINT=http://localhost:3001    # URL the browser POSTs to
CHECKOUT_PORT=3001                         # Port the Bun server listens on
SITE_URL=https://yoursite.com
```

Workflow:
```bash
# Terminal 1 — checkout server
bun run serve:checkout

# Terminal 2 — site
bun run build && bun run dev
```

The server exposes:
- `POST /checkout` — body `{ items: [{ priceId, qty }], successUrl?, cancelUrl? }` — returns `{ url }`
- `GET /health` — returns `{ ok: true }`

For production, set `CHECKOUT_ENDPOINT` to the public URL of your deployed server and run `bun run start:checkout` on your server.

---

1. **Generate products** — reads `products.yaml`, writes ephemeral `content/shop/<id>.md` files
2. **SiteBuilder.build()** — compiles all Markdown to HTML, generates `dist/static/products/index.json`
3. **Copy static assets**

### Sync build (`bun run build:sync`)

1. **Generate products** (same as above)
2. **Stripe sync** — for each product in `products.yaml`:
   - Finds or creates a Stripe Product (matched by `metadata.flint_id`)
   - Compares price — if changed, archives old Stripe Price, creates new one
   - Writes real `stripe_price_id` back to `products.yaml`
3. **Re-generate products** (so `.md` files get the real price IDs)
4. **SiteBuilder.build()** + copy static assets

---

## Stripe Sandbox Setup

### 1. Create a Stripe account

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com) and sign up (free)
2. You **do not** need to activate your account for test mode

### 2. Enable test mode

1. In the top-left of the Stripe Dashboard, confirm the toggle says **"Test mode"** (the header bar turns orange)
2. All products, prices, and payments created in test mode use fake money

### 3. Get your API keys

1. Navigate to **Developers → API keys**
2. Copy the **Publishable key** — starts with `pk_test_`
3. Click **"Reveal test key"** next to the Secret key — starts with `sk_test_` — copy it

### 4. Create your `.env` file

Create a `.env` file at the project root (it is gitignored):

```
STRIPE_SECRET_KEY=sk_test_51T25yi...your_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_51T25yi...your_key_here

# Checkout mode: payment-links (default, no server) or serverless (multi-item, needs Bun server)
CHECKOUT_MODE=payment-links

# Bun checkout server — only needed when CHECKOUT_MODE=serverless
CHECKOUT_ENDPOINT=http://localhost:3001
CHECKOUT_PORT=3001

# Site URL — used for Payment Link redirects and checkout success/cancel pages
SITE_URL=http://localhost:3000
```

### 5. Run the sync

```bash
bun run build:sync
```

This will:
- Create products in your Stripe test account
- Write real `stripe_price_id` values back to `products.yaml`
- Build the site with valid checkout links

### 6. Verify in the Stripe Dashboard

Go to [dashboard.stripe.com/test/products](https://dashboard.stripe.com/test/products) — you should see your products listed with correct names, descriptions, and prices.

### 7. CI/CD setup (GitHub Actions)

See the [CI/CD section](#cicd--github-actions) below for the full workflow file and secret configuration.

---

## Development vs Production Modes

### Development mode

Local development uses test Stripe keys, `localhost` URLs, and HTTP (no encryption).

**Typical `.env` for local development:**

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

CHECKOUT_MODE=payment-links
CHECKOUT_ENDPOINT=http://localhost:3001
CHECKOUT_PORT=3001
SITE_URL=http://localhost:3000
```

**Workflow:**

```bash
# First time or after changing prices
bun run build:sync     # Syncs Prices + Payment Links to Stripe test account

# Day-to-day
bun run build && bun run dev

# If using serverless mode — run in a second terminal
bun run serve:checkout
```

Known development behaviour:
- Cart data is stored as **plain JSON** in IndexedDB (AES-GCM requires HTTPS)
- Stripe.js will warn: *"You may test your Stripe.js integration over HTTP"* — this is expected
- `ERR_BLOCKED_BY_CLIENT` on `r.stripe.com` is Stripe telemetry blocked by ad blockers — harmless
- Payment Links redirect to Stripe's hosted page using test card numbers

### Production mode

Production uses live Stripe keys, a real domain, and HTTPS.

**Environment variables for production** (set via CI/CD secrets or host dashboard — no `.env` file on the server):

| Variable | Value | Where used |
|----------|-------|------------|
| `STRIPE_SECRET_KEY` | `sk_live_...` | Build time — `bun run build:sync` only |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | Build time — injected (obfuscated) into JS bundle |
| `CHECKOUT_MODE` | `payment-links` or `serverless` | Build time — baked into JS bundle |
| `CHECKOUT_ENDPOINT` | `https://checkout.yoursite.com` | Build time — baked into JS bundle |
| `CHECKOUT_PORT` | `3001` (or your port) | Runtime — Bun checkout server only |
| `SITE_URL` | `https://yoursite.com` | Build time — Payment Link redirect URLs |

> **Switch to live keys by changing `sk_test_` → `sk_live_` and `pk_test_` → `pk_live_`.** Run `bun run build:sync` once with live keys to create live Stripe Products + Payment Links. The `stripe_price_id` and `stripe_payment_link` values in `products.yaml` will be overwritten with live IDs.

**Production checkout server** (`serverless` mode only):

```bash
# On your server — reads STRIPE_SECRET_KEY from environment, not .env
STRIPE_SECRET_KEY=sk_live_... SITE_URL=https://yoursite.com bun run start:checkout
```

---

## CI/CD — GitHub Actions

### Required secrets

Go to your repository → **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret name | Value | Notes |
|-------------|-------|-------|
| `STRIPE_SECRET_KEY` | `sk_test_...` or `sk_live_...` | Used by `--stripe-sync` at build time only |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_...` or `pk_live_...` | Injected (obfuscated) into client bundle |

For `payment-links` mode, also add:

| Secret/variable name | Value | Notes |
|----------------------|-------|-------|
| `SITE_URL` | `https://yoursite.com` | Used to set `after_completion` redirect on Payment Links |

For `serverless` mode, also add:

| Secret/variable name | Value | Notes |
|----------------------|-------|-------|
| `CHECKOUT_ENDPOINT` | `https://checkout.yoursite.com` | Public URL of your deployed Bun checkout server |

### Workflow file — `payment-links` mode (static host, no server)

Save as `.github/workflows/deploy.yml`:

```yaml
name: Build & Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Sync products to Stripe & build
        run: bun run build:sync
        env:
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
          STRIPE_PUBLISHABLE_KEY: ${{ secrets.STRIPE_PUBLISHABLE_KEY }}
          CHECKOUT_MODE: payment-links
          SITE_URL: ${{ secrets.SITE_URL }}

      # Commit the updated products.yaml (contains new stripe_price_id + stripe_payment_link)
      - name: Commit updated products.yaml
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "chore: update stripe_price_id and stripe_payment_link [skip ci]"
          file_pattern: products.yaml

      # Deploy dist/ to your host — replace this step as needed
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

### Workflow file — `serverless` mode (Bun checkout server + static site)

The static site is deployed as above. The checkout server is deployed separately:

```yaml
name: Build & Deploy (Serverless)

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Sync products to Stripe & build
        run: bun run build:sync
        env:
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
          STRIPE_PUBLISHABLE_KEY: ${{ secrets.STRIPE_PUBLISHABLE_KEY }}
          CHECKOUT_MODE: serverless
          CHECKOUT_ENDPOINT: ${{ secrets.CHECKOUT_ENDPOINT }}
          SITE_URL: ${{ secrets.SITE_URL }}

      - name: Commit updated products.yaml
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "chore: update stripe_price_id [skip ci]"
          file_pattern: products.yaml

      # Deploy static site
      - name: Deploy static site
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist

      # Deploy checkout server — adjust for your host (Railway, Fly.io, VPS, etc.)
      - name: Deploy checkout server
        run: echo "Add your server deploy step here (e.g. fly deploy, railway up)"
        env:
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
          SITE_URL: ${{ secrets.SITE_URL }}
```

### Why `products.yaml` is committed back

`bun run build:sync` writes real `stripe_price_id` and `stripe_payment_link` values back to `products.yaml`. Committing this file ensures:
- The next build doesn't re-create Prices/Links unnecessarily
- Developers pulling the branch get the current Stripe IDs
- The `[skip ci]` message prevents an infinite trigger loop

If you prefer not to commit `products.yaml` from CI, remove the auto-commit step — the sync will re-run on every deploy (harmless but slower).

---

## Publishable Key Obfuscation

The Stripe publishable key is **not** stored as a plaintext string in the client bundle. Instead:

1. At build time, `scripts/obfuscate-key.ts` reads `STRIPE_PUBLISHABLE_KEY` from `.env`
2. It generates a random XOR mask and XOR'd data (two hex strings)
3. These are injected into the bundle via Rspack's `DefinePlugin` as `__STRIPE_KEY_MASK__` and `__STRIPE_KEY_DATA__`
4. At runtime, `cart-hydrate.ts` XOR-decodes the key before passing it to Stripe.js

> **Note:** This is cosmetic obfuscation. Stripe publishable keys are *designed* to be public — this just prevents naive bundle scraping. The key can always be recovered by a determined actor.

---

## Stripe Sync — How Price Changes Work

Stripe Prices are **immutable** — you can't change the amount on an existing Price. When `price_cents` changes in `products.yaml`:

1. The sync script detects the mismatch between `products.yaml` and the active Stripe Price
2. It **archives** the old Price (`active: false`)
3. It **creates** a new Price with the updated amount
4. It writes the new `stripe_price_id` back to `products.yaml`

This means the Stripe Dashboard always shows the full price history for each product.

---

## Adding a New Product

1. Add an entry to `products.yaml`:

```yaml
products:
  # ... existing products ...
  - id: red-kettle
    title: Red Enamel Kettle
    price_cents: 3400
    description: A classic stovetop enamel kettle in cherry red.
    image: "🫖"
    order: 2
```

2. Run `bun run build:sync` to create it in Stripe and get a real price ID
3. The build automatically generates the Markdown file and renders it on the shop page

That's it — no manual Markdown files, no Stripe Dashboard clicks.

---

## Shop Listing Template

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

Available product placeholders: `{title}`, `{url}`, `{description}`, `{price}`, `{image}`, `{short-uri}`, `{price-cents}`, `{currency}`, `{stripe-price-id}`, `{stripe-payment-link}`.

---

## Testing

### Unit tests (no Stripe key needed)

```bash
bun run test:run
```

Tests product schema validation, YAML generation, and key obfuscation. The Stripe integration tests auto-skip when no valid key is available.

### Integration tests (requires valid `sk_test_` key in `.env`)

```bash
bun test scripts/stripe-sync.test.ts
```

Creates a real product in Stripe test mode, verifies price creation/archival, and checks that `products.yaml` is updated.

### Manual checkout test

1. Run `bun run build:sync` (populates real Stripe Price IDs)
2. Start the dev server: `bun run dev`
3. Open `http://localhost:3000/shop`
4. Add a product, click **Checkout**
5. Use test cards:

| Card Number | Behaviour |
|-------------|-----------|
| `4242 4242 4242 4242` | ✅ Succeeds |
| `4000 0000 0000 3220` | 🔐 Requires 3D Secure |
| `4000 0000 0000 9995` | ❌ Declined |
| `4000 0025 0000 3155` | 🔐 Requires authentication |

Use any future expiry date and any 3-digit CVC.

---

## Cart Persistence

The cart is stored in **IndexedDB** (`flint-db` database, `kv` store):

- On HTTPS: cart data is encrypted with AES-GCM via the Web Crypto API
- On HTTP (local dev): falls back to plain JSON (crypto.subtle is unavailable)
- The `CartAPI` dispatches `cart:updated` and `cart:ready` CustomEvents for UI hydration

---

## Security Notes

- **Never commit `.env`** — it is gitignored. Only the publishable key reaches the client bundle (XOR-obfuscated).
- The Stripe secret key (`sk_test_` / `sk_live_`) is used **only at build time** for `--stripe-sync`. It is never included in any client bundle.
- For production, inject both keys via CI/CD secrets.
- Cart encryption (AES-GCM) is a defence-in-depth measure for the local IndexedDB store; it is not a substitute for Stripe's payment security.
