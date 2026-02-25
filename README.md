# Flint Static

A TypeScript static site generator. Write Markdown content, build to plain HTML/CSS/JS, deploy anywhere.

**Tech:** Bun · TypeScript (strict) · Marked · HTMX 2 · Tailwind CSS 3 · Rspack · Stripe

---

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.0

---

## Quick Start

```bash
bun install
bun run dev        # Dev server at http://localhost:3000 (HMR via Rspack)
bun run build      # Compile content/ → dist/
```

---

## Project Structure

```
content/              ← Markdown pages with YAML frontmatter
  index.md            ← Homepage
  blog/               ← Blog section
    index.md          ← Listing page
    *.md              ← Individual posts
  shop/               ← Product pages (generated from products.yaml)
    index.md
    *.md
functions/            ← Checkout server (serverless mode only)
  checkout-handler.ts ← Platform-agnostic checkout logic
  checkout-server.ts  ← Bun HTTP adapter (port 3001)
  checkout-cloudflare.ts ← Cloudflare Worker adapter
src/
  components/         ← Reusable server-rendered UI (TypeScript → HTML strings)
  client/             ← Browser JS (cart, nav, product hydration) — bundled by Rspack
  core/               ← Build engine (markdown, frontmatter, builder)
  styles/             ← Tailwind CSS entry point
scripts/              ← Build scripts (Stripe sync, product generation, deploy)
themes/
  default/
    templates/        ← HTML layouts with {{tag}} placeholders
static/               ← Static assets copied to dist/ as-is
products.yaml         ← Product catalogue
dist/                 ← Generated site output (git-ignored)
manager/              ← Flint Static Manager web UI (separate Bun server)
```

---

## Content Authoring

Add a `.md` file to `content/` with YAML frontmatter:

```markdown
---
title: My Post
Short-URI: my-post
Type: post
Category: Tutorials
Labels:
  - typescript
Parent: blog
Order: 1
Author: Your Name
Date: 2026-02-05
Description: Short summary for SEO and social previews
---

Write **standard Markdown** here.
```

### Key frontmatter fields

| Field | Purpose |
|-------|---------|
| `Short-URI` | Stable URL slug (survives file renames) |
| `Parent` | Builds page hierarchy — sets breadcrumbs and tree menus |
| `Type` | `page` (default), `post`, `product` |
| `Category` | Groups content — auto-generates category index |
| `Labels` | Tag list — generates label clouds with post counts |
| `Order` | Navigation order within a section |
| `Template` | Override the HTML template for this page |

See [docs/content-model.md](docs/content-model.md) for the full field reference.

### HTMX in content

Link syntax with HTMX attributes:

```markdown
[Load it](/fragments/greeting.html){hx-get hx-target="#output" hx-swap="innerHTML"}
```

Or raw HTML blocks:

````markdown
:::html
<button hx-get="/fragments/greeting.html" hx-target="#result" hx-swap="innerHTML">
  Click Me
</button>
<div id="result"></div>
:::
````

---

## Components

Reusable server-rendered UI. Extend `Component<T>` and implement `render()`:

```typescript
import { Component, type ComponentProps } from './component.js';

interface CardProps extends ComponentProps {
  title: string;
  description: string;
}

class Card extends Component<CardProps> {
  render(): string {
    return `
      <div class="${this.classNames('rounded-lg border p-6')}">
        <h3>${this.escapeHtml(this.props.title)}</h3>
        <p>${this.escapeHtml(this.props.description)}</p>
      </div>
    `;
  }
}
```

Register the component tag in `src/index.ts`, then use `{{card title="..." description="..."}}` in any template.

See [docs/components.md](docs/components.md) for the full API.

---

## Shop & Products

### 1. Define products in `products.yaml`

```yaml
- id: red-plate
  name: Red Plate
  description: A vibrant hand-painted ceramic dinner plate.
  price_cents: 1800
  image: "���️"
  order: 1
```

### 2. Sync to Stripe and build

```bash
# First time, or after changing prices — creates/updates Stripe products
bun run build:sync

# Day-to-day rebuild (no Stripe API calls)
bun run build
```

`build:sync` writes Stripe price IDs back into `products.yaml` and regenerates product pages. Always run it before deploying after price changes.

### 3. Required environment variables

Create a `.env` file at the project root:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
CHECKOUT_MODE=payment-links
```

### Checkout modes

**`payment-links`** (default) — zero infrastructure required
Each product gets a Stripe Payment Link at build time. Cart clicks redirect to Stripe hosted checkout. One product per session. Works on any static host.

**`serverless`** — multi-item cart
Items accumulate in an encrypted IndexedDB cart. Checkout POSTs to a server that creates a Stripe Checkout Session.

Additional `.env` for serverless mode:

```env
CHECKOUT_MODE=serverless
CHECKOUT_RUNTIME=cloudflare   # or: bun
CHECKOUT_ENDPOINT=https://your-worker.workers.dev
CART_ENCRYPTION_KEY=          # generate: openssl rand -hex 32
```

#### Running the checkout server

| Runtime | Command | Notes |
|---------|---------|-------|
| Bun (local/VPS) | `bun run serve:checkout` | Port 3001 |
| Cloudflare Workers | `bun run deploy:checkout:cloudflare` | Edge-deployed |

See [docs/ecommerce.md](docs/ecommerce.md) for the full Stripe setup, test cards, and CI/CD workflow.

---

## Manager

Flint Static Manager is a separate Bun HTTP server (`manager/`) that provides a web UI for managing one or more Flint Static sites — edit pages, sync products, trigger builds, deploy.

### Run locally

```bash
cd manager
cp .env.docker.example .env   # edit MANAGER_API_KEY
bun --hot server.ts            # http://localhost:8080
```

Required env vars:

```env
MANAGER_API_KEY=    # generate: openssl rand -hex 32
MANAGER_PORT=8080
```

### Run with Docker (Traefik + optional ngrok tunnel)

The manager ships with a Docker Compose stack: Traefik as the reverse proxy and optional ngrok for public tunnel access.

```bash
cd manager
cp .env.docker.example .env
# Edit .env — set MANAGER_API_KEY at minimum
# Set NGROK_AUTHTOKEN if you want the public tunnel

# Start without tunnel
docker compose up -d

# Start with ngrok tunnel
docker compose --profile tunnel up -d
```

Files:

| File | Purpose |
|------|---------|
| `manager/Dockerfile` | Multi-stage Bun build (oven/bun:1, Debian) |
| `manager/docker-compose.yml` | Traefik + ngrok + manager services |
| `manager/traefik.yml` | Traefik v3 static config (HTTP-only, ping healthcheck) |
| `manager/ngrok.yml` | ngrok v3 agent config (tunnels to Traefik port 80) |
| `manager/.env.docker.example` | All required and optional env vars with documentation |

**Note:** Site paths in `manager.config.yaml` must be absolute container paths matching your volume mounts (e.g. `/sites/main`), not relative paths.

### Manager commands (run from `manager/`)

```bash
bun --hot server.ts       # Dev with hot reload
bun server.ts             # Production
bun test --no-watch       # Run tests once
bunx tsc --noEmit         # Type check
```

---

## Deploy

Flint Static outputs plain files to `dist/`. Deploy that directory to any static host.

For platform-specific setup, required tokens, and free tier limits see [content/hosting.md](content/hosting.md).

| Platform | Static site | Serverless checkout |
|----------|-------------|---------------------|
| GitHub Pages | Yes | No — use `payment-links` mode |
| Cloudflare Pages + Workers | Yes | Yes |
| Vercel | Yes | Yes |
| Netlify | Yes | Yes |

```bash
# Deploy static site to Cloudflare Pages
bun run deploy:cloudflare:pages
```

After changing `products.yaml`, always run `bun run build:sync` before deploying.

---

## Commands Reference

### Site

| Command | Description |
|---------|-------------|
| `bun run dev` | Dev server at port 3000 with HMR |
| `bun run build` | Compile `content/` → `dist/` |
| `bun run build:sync` | Stripe sync + build (run after changing `products.yaml`) |
| `bun run build:sync:force` | Force-recreate all Stripe Payment Links + build |
| `bun run generate` | Regenerate product pages from `products.yaml` |
| `bun run stripe:cleanup` | Archive all Flint Static-managed Stripe products and clear YAML IDs |
| `bun run serve:checkout` | Start Bun checkout server (dev, port 3001) |
| `bun run start:checkout` | Start Bun checkout server (production) |
| `bun run deploy:checkout:cloudflare` | Deploy checkout function to Cloudflare Workers |
| `bun run deploy:cloudflare:pages` | Deploy static site to Cloudflare Pages |

### Quality

| Command | Description |
|---------|-------------|
| `bun run test:run` | Run all tests once |
| `bun run test` | Test watch mode |
| `bun run typecheck` | TypeScript type checking |
| `bun run lint` | ESLint check |
| `bun run lint:fix` | ESLint auto-fix |

---

## Testing

Tests are co-located with source files (`*.test.ts`). Run from the project root:

```bash
bun run test:run
```

The suite covers: builder, components, markdown pipeline, HTMX directives, Stripe sync, product generation, cart API, and nav toggle.

---

## License

MIT
