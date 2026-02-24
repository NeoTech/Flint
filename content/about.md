---
title: About
Short-URI: about
Template: default
Type: page
Category: Documentation
Order: 2
Labels:
  - about
  - info
Parent: root
Author: System
Date: 2024-01-20
Description: About this static site generator
Keywords:
  - about
  - documentation
---

# About This Project

This static site generator demonstrates a modern approach to building websites — including a full e-commerce pipeline with Stripe, a multi-item cart, and serverless checkout.

## Technology Stack

| Technology | Purpose |
|------------|---------|
| TypeScript | Type-safe development |
| Rspack | Fast bundling with Rust |
| Markdown | Content authoring |
| HTMX | Dynamic interactions |
| Tailwind CSS | Styling |
| Bun | Runtime, test runner, checkout server |
| Cloudflare Workers | Serverless checkout function (edge-deployed) |
| Stripe | Payments, products, checkout sessions |

## Architecture

The project follows a **test-first, component-driven** architecture:

1. **Core Layer** — Frontmatter parsing, Markdown compilation
2. **Component Layer** — Reusable UI components
3. **Template Layer** — Page assembly
4. **Build Layer** — File processing and output
5. **E-commerce Layer** — Stripe sync, cart, checkout server

## Checkout Modes

The cart supports two checkout strategies — choose the one that fits your hosting setup.

### Payment Links (default — no server)

```
Add to Cart → window.location.href = stripe_payment_link
```

Each product gets a pre-generated [Stripe Payment Link](https://stripe.com/docs/payment-links) created at build time by `bun run build:sync`. Clicking **Add to Cart** navigates directly to that product's hosted Stripe page — no server involved.

**Best for:** Simple stores, GitHub Pages, any static host.  
**Limitation:** One product per checkout session. No multi-item cart.

### Serverless (multi-item cart)

```
Add to Cart → IndexedDB cart → POST /checkout → Stripe Session URL → redirect
```

Items accumulate in a persistent cart (stored in IndexedDB, AES-GCM encrypted on HTTPS). Clicking **Checkout** posts the full cart to a checkout server, which creates a Stripe Checkout Session and returns the redirect URL.

**Best for:** Stores where customers buy multiple items at once.  
**Requires:** A running checkout server — either a local Bun process or a deployed Cloudflare Worker.

## Checkout Runtimes (serverless mode)

When `CHECKOUT_MODE=serverless`, you choose where the checkout server runs:

### Bun Server

```bash
bun run serve:checkout   # dev — reads .env
bun run start:checkout   # production
```

A lightweight Bun HTTP server (`functions/checkout-server.ts`) that handles `POST /checkout` and `GET /health`. Needs to be hosted on a VPS, Railway, Fly.io, or similar.

### Cloudflare Workers

```bash
bun run deploy:checkout:cloudflare
```

The same checkout logic (`functions/checkout-cloudflare.ts`) deployed as a Cloudflare Worker — globally distributed, no server to manage, scales to zero. The deploy script bundles the function, sets secrets, and enables the `*.workers.dev` subdomain automatically.

Set `CHECKOUT_RUNTIME=cloudflare` and `CHECKOUT_ENDPOINT` to the Worker URL in your `.env` and GitHub repository variables.

## Deploying the Static Site

The static site itself is deployed to **Cloudflare Pages** via a custom Direct Upload API implementation — no wrangler CLI needed:

```bash
bun run build:sync          # (if products changed) sync Stripe + rebuild
bun run deploy:cloudflare:pages   # upload dist/ → Cloudflare Pages
```

`scripts/deploy-pages.ts` scans `dist/`, computes MD5 hashes, uploads only changed files in batches, and creates a deployment record — all via plain `fetch()` calls to the Cloudflare API. This works reliably in CI, subprocesses, and the Flint Manager.

### Flint Manager — Build + Deploy

The [Flint Manager](https://github.com/flint-project/manager) has a **Build \& Deploy** page that combines both steps in one click:

- **Build + Deploy** buttons per platform (Cloudflare Pages, Vercel, Netlify, GitHub Pages) — compiles the site, then deploys, with a live streaming log
- **Build only** button — compile without deploying
- Deploy targets are automatically enabled based on which credentials are set in `.env`

### Required Credentials

| Var | Purpose |
|-----|---------|
| `CLOUDFLARE_API_TOKEN` | Scoped token with **Cloudflare Pages:Edit** — required for Pages deploy |
| `CLOUDFLARE_ACCOUNT_ID` | Your CF account ID |
| `CF_PAGES_PROJECT` | Pages project name |
| `CF_PAGES_DIR` | Build output dir (default: `dist`) |

## Development Workflow

```
Write Test → Implement → Pass Test → Refactor → Commit
```

All features are developed test-first using Bun test.

## HTMX on a Static Site

Even without a backend API, HTMX works great on static sites by loading **HTML fragments**:

<button 
  class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
  hx-get="/fragments/about-greeting.html" 
  hx-target="#greeting"
  hx-swap="innerHTML">
  Say Hello
</button>

<div id="greeting" class="mt-4 p-4 bg-gray-100 rounded">
  Click the button to load a static HTML fragment!
</div>

The trick is pre-building small `.html` fragments at build time and serving them as static files. See the [HTMX Demo](/htmx) for more examples.

## Source Code

- `src/core/` — Core functionality (parsing, compilation)
- `src/components/` — UI components
- `src/client/` — Browser-side JS (cart, checkout, navigation)
- `functions/` — Checkout server (Bun adapter + Cloudflare Worker adapter)
- `scripts/` — Build scripts (Stripe sync, product generation, cleanup, Cloudflare deploy)
- `content/` — Markdown content files

[← Back to Home](/)
