<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/HTMX-2.0-3366CC?logo=htmx&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/Vitest-162_tests-6E9F18?logo=vitest&logoColor=white" />
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
| "Testing is an afterthought" | **162 tests** baked in from day one. Every module has co-located test files |
| "Build tools are a nightmare" | Rspack builds in **under 100ms**. Hot reload included |

---

## 🚀 Get Started in 60 Seconds

```bash
# Clone the repo
git clone https://github.com/your-username/flint.git
cd flint

# Install dependencies
npm install

# Start the dev server with hot reload
npm run dev

# Build the production site
npm run build
```

Your site is now in `dist/`. Deploy it anywhere — GitHub Pages, Netlify, Cloudflare, or a $5 VPS.

---

## 📁 Project Structure

```
├── content/              ← Your content lives here (Markdown + YAML frontmatter)
│   ├── index.md          ← Homepage
│   ├── about.md          ← Static pages
│   ├── htmx.md           ← Interactive HTMX demos
│   └── blog/             ← Blog section with posts
│       ├── index.md      ← Blog listing page
│       └── *.md          ← Individual posts
├── src/
│   ├── components/       ← Reusable UI components (layout, navigation, etc.)
│   ├── core/             ← Engine (markdown, frontmatter, templates, builder)
│   └── styles/           ← Tailwind CSS entry point
├── static/               ← Static assets (copied to dist as-is)
├── scripts/              ← Build scripts
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

Every module ships with co-located tests. 15 test files, 162 assertions, all green.

```bash
# Run tests once
npm run test:run

# Watch mode during development
npm run test

# Type-check without emitting
npm run typecheck

# Lint
npm run lint
```

---

## 📦 The Stack

| Layer | Tool | Why |
|---|---|---|
| **Language** | TypeScript 5.7 (strict) | Type safety without compromise |
| **Markdown** | Marked 15 | Fast, extensible, standards-compliant |
| **Frontmatter** | gray-matter | Battle-tested YAML parsing |
| **Interactivity** | HTMX 2.0 | Dynamic HTML without a JS framework |
| **Styling** | Tailwind CSS 3.4 | Utility-first, zero unused CSS in prod |
| **Bundler** | Rspack | Rust-powered builds — 5-10x faster than Webpack |
| **Testing** | Vitest + happy-dom | Lightning-fast unit tests with DOM support |
| **Linting** | ESLint + @typescript-eslint | Consistent code quality |

**Production dependencies: 3.** That's not a typo.

---

## 🛠️ Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload (port 8080) |
| `npm run build` | Generate production site to `dist/` |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |

---

## 🌐 Deploy Anywhere

Flint generates plain HTML, CSS, and JS. Deploy the `dist/` folder to:

- **GitHub Pages** — free, automatic with Actions
- **Netlify / Vercel** — drag-and-drop or git push
- **Cloudflare Pages** — edge-cached globally
- **Any web server** — it's just files
- **ngrok** — built-in support for tunnel previews during development

---

## 📄 License

MIT — do whatever you want with it.

---

<p align="center">
  <strong>Stop configuring. Start publishing.</strong><br/>
  <em>Flint — because your content deserves better than a 200MB node_modules folder.</em>
</p>
