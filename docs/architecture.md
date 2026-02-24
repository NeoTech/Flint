# Architecture

Flint is a static site generator built around a simple pipeline: **Markdown in → HTML out**. This document explains the high-level architecture, data flow, and the design decisions behind each layer.

## System Overview

```
content/*.md          src/components/         src/core/
┌──────────────┐     ┌───────────────────┐   ┌──────────────────────┐
│ YAML         │     │ Component<T>      │   │ frontmatter.ts       │
│ Frontmatter  │────▶│ Navigation        │   │ page-metadata.ts     │
│ + Markdown   │     │ TreeMenu          │   │ markdown.ts          │
│ body         │     │ CategoryNav       │   │ htmx-markdown.ts     │
└──────┬───────┘     │ LabelCloud        │   │ html-blocks.ts       │
       │             │ LabelFooter       │   │ hierarchy.ts         │
       │             │ Product / Cart    │   │ index-generator.ts   │
       │             │ CtaSection        │   │ children-directive.ts │
       │             │ CardGrid          │   │ builder.ts           │
       │             │ StatsBar          │   └──────────┬───────────┘
       │             │ SkillCards        │              │
       │             │ Gadget / LabelIndex│             │
       │             └───────┬───────────┘              │
       │                     │                          │
       │             templates/              src/templates/
       │             ┌───────────────────┐   ┌──────────────────────┐
       │             │ default.html      │   │ tag-engine.ts        │
       │             │ blank.html        │   │ template-registry.ts │
       │             │ blog-post.html    │   │ helpers.ts           │
       │             │ shop.html         │   └──────────┬───────────┘
       │             │ agent-info.html   │              │
       │             │ product-demo.html │              │
       │             │ component-demo.html│             │
       │             └───────┬───────────┘              │
       ▼                     ▼                          ▼
  ┌─────────────────────────────────────────────────────┘
  │                  Build Pipeline
  │  ┌─────────────────────────────────────────────────┐
  │  │ 1. Scan content/ for *.md files                 │
  │  │ 2. Parse YAML frontmatter → PageMetadata        │
  │  │ 3. Generate navigation from Parent: root pages  │
  │  │ 4. Preprocess: extract :::html blocks           │
  │  │ 5. Preprocess: convert [text](url){hx-attrs}   │
  │  │ 6. Compile Markdown → HTML (marked)             │
  │  │ 7. Restore raw HTML blocks                      │
  │  │ 8. Resolve {{tag}} placeholders in template     │
  │  │ 9. Write to dist/ with clean URLs               │
  │  └─────────────────────────────────────────────────┘
  │
  ▼
dist/
├── index.html
├── about/index.html
├── blog/index.html
├── blog/post-slug/index.html
└── assets/
    ├── main.css   (Tailwind, built by Rspack)
    └── main.js    (HTMX bundle, built by Rspack)
```

## Three Layers

### 1. Core (`src/core/`)

The engine. Stateless functions and classes that parse, compile, and build.

| Module | Responsibility |
|---|---|
| `frontmatter.ts` | Splits YAML header from Markdown body using `gray-matter` |
| `page-metadata.ts` | Normalises raw frontmatter into a typed `PageMetadata` object |
| `markdown.ts` | Compiles Markdown to HTML (orchestrates the preprocessing pipeline) |
| `htmx-markdown.ts` | Converts `[text](url){hx-attrs}` links into HTMX-powered elements |
| `html-blocks.ts` | Extracts `:::html` / `:::` blocks before compilation, restores after |
| `hierarchy.ts` | Builds the page tree from `Parent` fields (breadcrumbs, tree menus) |
| `index-generator.ts` | Generates category and label index pages from metadata |
| `builder.ts` | Orchestrator — scans, processes, writes the entire site |

### 2. Components (`src/components/`)

Pure rendering functions. Each component extends `Component<T>`, accepts typed props, and returns an HTML string. No side effects, no DOM manipulation.

| Component | Purpose |
|---|---|
| `Component<T>` | Abstract base class — provides `render()`, `escapeHtml()`, `classNames()` |
| `Navigation` | Top-level nav bar with active state and HTMX boost support |
| `TreeMenu` | Hierarchical sidebar navigation (collapsible tree) |
| `CategoryNav` | Pill-style category filter links with counts |
| `LabelCloud` | Weighted tag cloud with size scaling by frequency |
| `LabelFooter` | Label badges displayed at the bottom of pages |
| `Product` | Product card with image, price, and Add-to-Cart button (data-driven from frontmatter) |
| `Cart` | Cart placeholder HTML, hydrated client-side |
| `CtaSection` | Gradient CTA section — hero or banner variant (data-driven from frontmatter) |
| `CardGrid` | Responsive grid of icon cards — plain or linked (data-driven from frontmatter) |
| `StatsBar` | Dark row of headline statistics with coloured values (data-driven from frontmatter) |
| `Gadget` | Interactive component demo widget |
| `SkillCards` | Responsive grid of skill info cards with coloured badges (data-driven from frontmatter) |
| `LabelIndex` | Label index page with page listings |

### 3. Templates (`templates/` + `src/templates/`)

HTML template files with `{{tag}}` placeholders. Templates are plain HTML — no TypeScript required to create or modify them.

**Template files** (`templates/`):

| File | Purpose |
|---|---|
| `default.html` | Standard page layout with navigation, content area, and label footer |
| `blank.html` | Minimal shell — content and scripts only |
| `blog-post.html` | Article layout with byline header, narrower max-width |
| `shop.html` | E-commerce layout with cart sidebar |
| `agent-info.html` | Two-column layout with skill cards and sidebar |
| `landing.html` | Landing page with hero, feature grid, stats, showcase, CTA |
| `product-demo.html` | Product detail page with product card |
| `product-detail.html` | Product detail page with cart widget |
| `component-demo.html` | Interactive component demo layout |

**Template engine** (`src/templates/`):

| Module | Responsibility |
|---|---|
| `tag-engine.ts` | Resolves `{{tag}}` placeholders to HTML (switch on tag name). Handles `{{#if tag}}...{{/if}}` conditionals. |
| `template-registry.ts` | Stores named HTML templates, renders them via the tag engine. `loadTemplatesFromDir()` reads `.html` files from disk. |
| `helpers.ts` | Shared HTML generators for `<head>` and foot scripts |

Content files select their template via `Template: <name>` in frontmatter. The tag engine resolves placeholders like `{{head}}`, `{{navigation}}`, `{{content}}`, `{{label-footer}}`, etc. See [templates.md](templates.md) for the full tag reference.

### 4. Build & Config (root + `scripts/`)

| File | Purpose |
|---|---|
| `scripts/build.ts` | Entry point: creates `SiteBuilder`, runs build, copies static assets |
| `scripts/deploy-pages.ts` | Deploys the static site to Cloudflare Pages via the **Direct Upload API** (fetch-based, no wrangler). Scans `dist/`, computes MD5 hashes, uploads missing files in batches, creates deployment record. Reads `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CF_PAGES_PROJECT` from `.env`. Run: `bun run deploy:cloudflare:pages` |
| `scripts/deploy-cloudflare.ts` | Deploys the Cloudflare Worker (checkout function) via `bunx wrangler deploy`. Run: `bun run deploy:checkout:cloudflare` |
| `rspack.config.ts` | Bundles `src/index.ts` → JS + CSS for the browser (HTMX, Tailwind) |
| `package.json` | Scripts: `dev`, `build`, `test`, `lint`, `typecheck` |

## Data Flow in Detail

### Phase 1: Parse

```
content/blog/post.md
  │
  ├── gray-matter ──▶ { data: { title, Category, Labels, Parent, Order, ... },
  │                     content: "# Markdown body..." }
  │
  └── parsePageMetadata() ──▶ PageMetadata {
        shortUri: "my-post",
        title: "My Post",
        type: "post",
        category: "Tutorials",
        labels: ["htmx", "beginner"],
        parent: "blog",
        order: 1,
        ...
      }
```

### Phase 2: Navigation

The builder reads metadata from **all** content files, then:

1. **Filters** pages where `parent === 'root'` → top-level navigation items
2. **Sorts** by `order` (ascending), then alphabetically
3. For each page being rendered, marks the matching nav item as `active`

### Phase 3: Compile

The Markdown body passes through three stages:

```
  Raw markdown (with :::html blocks and [text](url){hx-attrs})
      │
      ▼
  extractHtmlBlocks()       → replaces :::html/:::: with <!--HTML_BLOCK_N--> placeholders
      │
      ▼
  processHtmxMarkdown()    → converts [text](url){hx-get hx-target=#id} to <a hx-get=...>
      │
      ▼
  marked.parse()           → standard Markdown → HTML compilation
      │
      ▼
  restoreHtmlBlocks()      → replaces <!--HTML_BLOCK_N--> with original raw HTML
      │
      ▼
  Final HTML string
```

### Phase 4: Render

The template engine selects an HTML template (based on `Template` frontmatter) and resolves all `{{tag}}` placeholders:

```
  templates/default.html
      │
      ▼
  processTemplate(html, context)
      │
      ├── {{#if navigation}} → conditionally include block
      ├── {{head}}           → renderHead() → <!DOCTYPE html><html><head>...</head>
      ├── {{navigation}}     → Navigation.render() → <nav>...</nav>
      ├── {{content}}        → compiled Markdown HTML
      ├── {{hero}}           → CtaSection.render(frontmatter, hero variant) (data-driven)
      ├── {{call-to-action}} → CtaSection.render(frontmatter, banner variant) (data-driven)
      ├── {{feature-grid}}   → CardGrid.render(frontmatter) (data-driven)
      ├── {{showcase-grid}}  → CardGrid.render(frontmatter) (data-driven)
      ├── {{stats-bar}}      → StatsBar.render(frontmatter) (data-driven)
      ├── {{product}}        → Product.render(frontmatter) → product card (data-driven)
      ├── {{skill-cards}}    → SkillCards.render(frontmatter) → skill grid (data-driven)
      ├── {{cart}}           → Cart.render() → cart placeholder
      ├── {{gadget}}         → Gadget.render() → component demo
      ├── {{label-footer}}   → LabelFooter.render() → <footer>...</footer>
      └── {{foot-scripts}}   → renderFootScripts() → <script src="main.js">
      │
      ▼
  Final HTML document string
```

### Phase 5: Write

Output paths are derived from the page's `Short-URI` (flat clean URLs):

| Input | Short-URI | Output |
|---|---|---|
| `content/index.md` | *(any)* | `dist/index.html` |
| `content/about.md` | `about` | `dist/about/index.html` |
| `content/blog/index.md` | `blog` | `dist/blog/index.html` |
| `content/blog/post.md` | `getting-started` | `dist/getting-started/index.html` |

## Design Decisions

### Why TypeScript classes for components?

Components are just functions that return strings. The class pattern (`Component<T>`) provides:
- **Typed props** via generics — compile-time safety
- **Shared utilities** — `escapeHtml()`, `classNames()`
- **Static `render()`** — one-liner instantiation: `Navigation.render({ items })`

No virtual DOM, no runtime. The output is a string that gets written to a file.

### Why HTML templates with `{{tag}}` placeholders?

Templates define page structure (where navigation, content, and footer go). This is a layout concern, not a logic concern. Plain HTML files with `{{tag}}` placeholders let you:
- **Create templates without TypeScript** — just HTML
- **See the structure at a glance** — no class hierarchies or render methods
- **Add new templates in seconds** — copy an HTML file, set `Template: name` in frontmatter

Components handle the complex rendering (navigation trees, label clouds). Templates just compose those components into a page. The tag engine bridges the two layers.

### Why preprocessors instead of marked plugins?

Marked plugins operate at the token level. HTMX attribute syntax (`{hx-get ...}`) and raw HTML blocks (`:::html`) are easier to handle as **text transforms before marked runs**. This keeps each concern isolated and independently testable.

### Why HTMX instead of a JS framework?

Flint generates static HTML. HTMX adds interactivity by loading HTML fragments on demand — no client-side routing, no hydration, no build step for the interactive parts. The HTMX library (14 KB) is bundled offline via Rspack.

### Why Rspack?

Rspack handles the **browser bundle** (Tailwind CSS + HTMX JS). The **site build** uses Bun to run TypeScript directly. This separation means:
- `bun run build` → Bun compiles Markdown → HTML (fast, native TS execution)
- `bun run dev` → Rspack serves `dist/` with HMR for CSS/JS changes

### Why co-located tests?

Every module has a `.test.ts` file next to it. This makes it obvious which tests cover which code, and ensures tests are updated when the module changes. The project has **461 tests** across 34 test files.

### Why data-driven components?

Many tags (`{{hero}}`, `{{call-to-action}}`, `{{feature-grid}}`, `{{showcase-grid}}`, `{{stats-bar}}`, `{{product}}`, `{{skill-cards}}`) read their props directly from `ctx.frontmatter` in the tag engine rather than receiving hardcoded values. This means **content files drive component data** — the YAML frontmatter is the single source of truth. Adding a new product, skill card, or landing page section means editing a Markdown file, not touching TypeScript. The tag engine maps frontmatter keys to typed component props. Some components serve multiple tags via a variant prop (e.g. `CtaSection` renders both `{{hero}}` and `{{call-to-action}}`; `CardGrid` renders both `{{feature-grid}}` and `{{showcase-grid}}`).

## Deployment

### Static Site → Cloudflare Pages

`scripts/deploy-pages.ts` uses the **Cloudflare Pages Direct Upload API** (pure `fetch`, no wrangler dependency):

1. Scans `dist/` recursively and computes an MD5 hash for every file
2. Requests an upload JWT from the CF API (`POST /pages/projects/:project/uploadToken`)
3. Sends the full hash manifest to CF to learn which files are missing from its cache (`POST /pages/assets/check-missing`)
4. Uploads only the missing files in batches of 50 (`POST /pages/assets/upload`)
5. Upserts the complete hash map (`POST /pages/assets/upsert-hashes`)
6. Creates the deployment record via a FormData POST (`POST /pages/projects/:project/deployments`)

This approach is reliable in non-TTY subprocess contexts (CI, manager SSE streams) where `wrangler pages deploy` can fail due to its local hash cache or TTY detection.

### Cloudflare Worker → Checkout Server

`scripts/deploy-cloudflare.ts` deploys the checkout `Worker` (serverless function) via `bunx wrangler deploy`. This is a separate flow from the static site deploy.

### Manager: Combined Build + Deploy

The Flint Manager (`manager/`) exposes a unified build+deploy route:

| Route | Handler | Purpose |
|---|---|---|
| `POST /sites/:id/build` | `handleBuild` | Build only (SSE log) |
| `POST /sites/:id/deploy/:target` | `handleDeploy` | Deploy only (SSE log) |
| `POST /sites/:id/build-and-deploy/:target` | `handleBuildAndDeploy` | Chain build + deploy in a single SSE stream |

The manager UI presents target-specific **"Build + Deploy"** buttons and a separate **"Build only"** button. `handleBuildAndDeploy` uses `spawnChained` to sequence the build steps and the deploy steps, streaming all output to the client.
