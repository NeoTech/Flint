<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/HTMX-2.0-3366CC?logo=htmx&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/Bun_test-515_tests-f472b6?logo=bun&logoColor=white" />
  <img src="https://img.shields.io/badge/Stripe-payments-635BFF?logo=stripe&logoColor=white" />
  <img src="https://img.shields.io/badge/Cloudflare_Workers-edge-F38020?logo=cloudflare&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-yellow" />
</p>

# ⚡ Flint

**Strike markdown. Get a blazing-fast website.**

Flint is a zero-compromise static site generator that turns Markdown files into beautiful, interactive websites — powered by TypeScript, styled with Tailwind CSS, and supercharged with HTMX. No React. No Vue. No bloat. Just content in, website out.

---

## 🤔 Why Flint?

Most static site generators make you choose: **simple but ugly**, or **pretty but complex**. Flint refuses that tradeoff.

| Pain Point | Flint's Answer |
|---|---|
| "I need a framework for interactivity" | HTMX gives you dynamic behavior **from HTML attributes** — no JS framework required |
| "SSGs are hard to customize" | Component-driven architecture with a clean `Component<T>` base class |
| "Markdown is too limited" | Extended frontmatter with categories, labels, hierarchy, ordering — your content is structured data |
| "Testing is an afterthought" | **515 tests** baked in from day one. Every module has co-located test files |
| "Build tools are a nightmare" | Rspack builds in **under 100ms**. Hot reload included |
| "E-commerce needs a big backend" | Stripe Payment Links need zero server. Multi-item cart uses a 50-line Cloudflare Worker |

---

## 🚀 Get Started in 60 Seconds

### Prerequisites

Install [Bun](https://bun.sh) (fast JavaScript runtime & package manager):

```bash
# macOS / Linux
curl -fsSL https://bun.sh/install | bash

# Windows
powershell -c "irm bun.sh/install.ps1 | iex"
```

### Setup

```bash
# Clone the repo
git clone https://github.com/your-username/flint.git
cd flint

# Install dependencies
bun install

# Start the dev server with hot reload
bun run dev

# Build the production site
bun run build
```

Your site is now in `dist/`. Deploy it anywhere — GitHub Pages, Netlify, Cloudflare, or a $5 VPS.

---

## 🛒 Shop & Products Quick Start

Products are managed from a single file — `products.yaml` at the project root. No manual Markdown files, no Stripe Dashboard clicks.

**1. Add a product:**

```yaml
# products.yaml
products:
  - id: red-plate
    title: Red Dinner Plate
    description: A vibrant hand-painted ceramic dinner plate.
    price_cents: 1800
    image: "🍽️"
    order: 2
```

**2. Sync to Stripe and build:**

```bash
# First time / after price changes — creates products in Stripe
bun run build:sync

# Day-to-day — just builds the site
bun run build
```

**3. Start the dev server:**

```bash
bun run dev
# Open http://localhost:3000/shop
```

That's it. The build generates product Markdown pages from the YAML, syncs prices to Stripe, and renders the shop. See [docs/ecommerce.md](docs/ecommerce.md) for full setup (Stripe sandbox keys, CI/CD, test cards).

### Checkout modes

**`payment-links`** (default — zero infrastructure)  
Each product gets a pre-generated Stripe Payment Link created at build time. Clicking Add to Cart goes straight to Stripe's hosted page — no server needed. One product per session.

**`serverless`** (multi-item cart)  
Items accumulate in an encrypted IndexedDB cart. Checkout POSTs the full cart to a checkout server which creates a Stripe Checkout Session. Choose your runtime:

| Runtime | How to run | Best for |
|---------|-----------|----------|
| **Bun server** | `bun run serve:checkout` | Local dev, self-hosted VPS |
| **Cloudflare Workers** | `bun run deploy:checkout:cloudflare` | Production — edge-deployed, scales to zero |

Set `CHECKOUT_MODE=serverless`, `CHECKOUT_RUNTIME=cloudflare` (or `bun`), and `CHECKOUT_ENDPOINT` to the server URL in `.env`. See [docs/ecommerce.md](docs/ecommerce.md) for the full GitHub Actions and Cloudflare setup.

---

## 📁 Project Structure

```
├── content/              ← Your content lives here (Markdown + YAML frontmatter)
│   ├── index.md          ← Homepage
│   ├── about.md          ← Static pages
│   ├── htmx.md           ← Interactive HTMX demos
│   ├── agent.md          ← Agent & Skills info page
│   ├── blog/             ← Blog section with posts
│   │   ├── index.md      ← Blog listing page
│   │   └── *.md          ← Individual posts
│   └── shop/             ← E-commerce section
│       ├── index.md      ← Shop listing page
│       └── *.md          ← Product pages (generated from products.yaml)
├── functions/            ← Checkout server
│   ├── checkout-handler.ts      ← Platform-agnostic checkout logic
│   ├── checkout-server.ts       ← Bun HTTP adapter
│   └── checkout-cloudflare.ts   ← Cloudflare Worker adapter
├── templates/            ← HTML page layouts with {{tag}} placeholders
├── src/
│   ├── components/       ← Reusable server-rendered UI components
│   ├── client/           ← Browser-side JS (cart, product hydration, nav)
│   ├── core/             ← Engine (markdown, frontmatter, templates, builder)
│   ├── templates/        ← Tag engine and template registry
│   └── styles/           ← Tailwind CSS entry point
├── scripts/              ← Build scripts (Stripe sync, product generation, cleanup, CF deploy)
├── static/               ← Static assets (copied to dist as-is)
├── products.yaml         ← Single source of truth for all products
├── wrangler.toml         ← Cloudflare Worker config
├── .github/skills/       ← AI agent skill definitions
└── dist/                 ← Generated site (git-ignored)
```

---

## ✍️ Content Authoring

Create a Markdown file, add frontmatter, and you're done. Flint handles the rest.

```markdown
---
title: My Awesome Post
Short-URI: awesome-post
Type: post
Category: Tutorials
Labels:
  - typescript
  - beginner
Parent: blog
Order: 1
Author: Your Name
Date: 2026-02-05
Description: A short summary for SEO and social previews
Keywords:
  - tutorial
  - getting-started
---

# Your Content Here

Write **standard Markdown** with full HTML support.
```

### What the frontmatter gives you

| Field | What it does |
|---|---|
| `Parent` | Builds page hierarchy — automatic breadcrumbs & tree menus |
| `Category` | Groups content — auto-generated category indexes |
| `Labels` | Tags content — label clouds with post counts |
| `Order` | Controls navigation order — no config files to maintain |
| `Short-URI` | Stable permalinks that survive file renames |

---

## ⚡ HTMX — Interactivity Without the Baggage

Flint has first-class HTMX support. Add dynamic behavior using a special Markdown syntax:

```markdown
[Load Content](/fragments/greeting.html){hx-get hx-target="#output" hx-swap="innerHTML"}
```

Or use raw HTML blocks for full control:

````markdown
:::html
<button hx-get="/fragments/greeting.html"
        hx-target="#result"
        hx-swap="innerHTML"
        class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
  Click Me
</button>
<div id="result"></div>
:::
````

HTMX is bundled offline — no CDN dependency, no extra requests.

---

## 🧩 Component Architecture

Build UI with TypeScript classes that return HTML strings. Pure, testable, composable.

```typescript
import { Component, type ComponentProps } from './component.js';

interface CardProps extends ComponentProps {
  title: string;
  description: string;
}

class Card extends Component<CardProps> {
  render(): string {
    return `
      <div class="${this.classNames('rounded-lg border p-6 shadow-sm')}">
        <h3 class="text-lg font-semibold">${this.escapeHtml(this.props.title)}</h3>
        <p class="mt-2 text-gray-600">${this.escapeHtml(this.props.description)}</p>
      </div>
    `;
  }
}
```

No virtual DOM. No hydration. No runtime overhead. Just strings.

---

## 🧪 Test-First, Always

Every module ships with co-located tests. 38 test files, 515 tests, all green.

```bash
# Run tests once
bun run test:run

# Watch mode during development
bun run test

# Type-check without emitting
bun run typecheck

# Lint
bun run lint
```

---

## 📦 The Stack

| Layer | Tool | Why |
|---|---|---|
| **Runtime** | Bun | Fast installs, native TypeScript execution, no transpiler needed |
| **Language** | TypeScript 5.7 (strict) | Type safety without compromise |
| **Markdown** | Marked 15 | Fast, extensible, standards-compliant |
| **Frontmatter** | gray-matter | Battle-tested YAML parsing |
| **Interactivity** | HTMX 2.0 | Dynamic HTML without a JS framework |
| **Styling** | Tailwind CSS 3.4 | Utility-first, zero unused CSS in prod |
| **Bundler** | Rspack | Rust-powered builds — 5-10x faster than Webpack |
| **Payments** | Stripe | Products, prices, checkout sessions, payment links |
| **Edge functions** | Cloudflare Workers | Serverless checkout — globally distributed, zero cold start |
| **Testing** | Bun test runner + happy-dom | Lightning-fast unit tests with DOM support |
| **Linting** | ESLint + @typescript-eslint | Consistent code quality |

**Production dependencies: 3** (site). The checkout Worker adds Stripe SDK — only runs server-side, never in the browser.

---

## 🛠️ Commands

| Command | Description |
|---|---|
| `bun run dev` | Start dev server with hot reload (port 3000) |
| `bun run build` | Generate production site to `dist/` |
| `bun run build:sync` | Sync products to Stripe + build site |
| `bun run build:sync:force` | Force-recreate all Stripe Payment Links + build |
| `bun run generate` | Generate product pages from `products.yaml` |
| `bun run serve:checkout` | Start Bun checkout server (dev, port 3001) |
| `bun run start:checkout` | Start Bun checkout server (production) |
| `bun run deploy:checkout:cloudflare` | Deploy checkout function to Cloudflare Workers |
| `bun run stripe:cleanup` | Archive all Flint-managed Stripe products + clear YAML IDs |
| `bun run test` | Run tests in watch mode |
| `bun run test:run` | Run tests once |
| `bun run typecheck` | TypeScript type checking |
| `bun run lint` | ESLint check |
| `bun run lint:fix` | ESLint auto-fix |

---

## 🌐 Deploy Anywhere

Flint generates plain HTML, CSS, and JS. Deploy the `dist/` folder to:

- **GitHub Pages** — free, automatic with Actions
- **Netlify / Vercel** — drag-and-drop or git push
- **Cloudflare Pages / S3 / any CDN** — edge-cached globally
- **Any web server** — it's just files
- **ngrok** — built-in support for tunnel previews during development

### Checkout server (serverless mode only)

If you're using `CHECKOUT_MODE=serverless`, you also need a checkout server to create Stripe Checkout Sessions:

| Where | Command | Notes |
|-------|---------|-------|
| **Cloudflare Workers** | `bun run deploy:checkout:cloudflare` | Recommended for production — edge-deployed, scales to zero |
| **Local / VPS (Bun)** | `bun run start:checkout` | Self-hosted, set `CHECKOUT_ENDPOINT` to your server URL |

See [docs/ecommerce.md](docs/ecommerce.md) for the full GitHub Actions workflow and required secrets.

---

## 📄 License

MIT — do whatever you want with it.

---

<p align="center">
  <strong>Stop configuring. Start publishing.</strong><br/>
  <em>Flint — because your content deserves better than a 200MB node_modules folder.</em>
</p>
