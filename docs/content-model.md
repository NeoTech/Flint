# Content Model

Every Markdown file in `content/` is a page. Its YAML frontmatter is the page's structured metadata — the "database record" that drives navigation, hierarchy, categorisation, SEO, and rendering.

## Frontmatter Fields

### Required

| Field | Type | Example | Purpose |
|---|---|---|---|
| `Short-URI` | `string` | `getting-started-htmx` | Unique page identifier. Used for hierarchy lookups, URL generation, and internal linking. Must be alphanumeric with hyphens/underscores. |

### Recommended

| Field | Type | Default | Example | Purpose |
|---|---|---|---|---|
| `title` | `string` | value of `Short-URI` | `Getting Started with HTMX` | Page title. Used in `<title>`, navigation labels, index listings. |
| `Type` | `page \\| post \\| section \\| product` | `page` | `post` | Page type. `section` pages act as containers (e.g. blog index). `post` pages are leaf content. `product` pages are e-commerce items. `page` is a generic standalone page. |
| `Parent` | `string` | `root` | `blog` | The `Short-URI` of this page's parent. Pages with `Parent: root` appear in the top navigation bar. |
| `Order` | `number` | `999` | `2` | Sort position within sibling pages. Lower numbers appear first. Pages with the same order sort alphabetically by title. |

### Optional — Categorisation

| Field | Type | Default | Example | Purpose |
|---|---|---|---|---|
| `Category` | `string` | `""` | `Tutorials` | **One** category per page. Drives the `CategoryNav` component and auto-generated category index pages. |
| `Labels` | `string[]` | `[]` | `[htmx, beginner, css]` | **Many** labels per page. Drives the `LabelCloud` component and auto-generated label index pages. |

### Optional — Metadata

| Field | Type | Default | Example | Purpose |
|---|---|---|---|---|
| `Author` | `string` | `""` | `Jane Developer` | Author attribution. Available for templates and index listings. |
| `Date` | `string (ISO)` | `null` | `2026-02-01` | Publication date. Used for sorting posts chronologically in indexes. |
| `Description` | `string` | `""` | `A short summary for SEO` | Page description. Rendered as `<meta name="description">`. Shown in index listings. |
| `Keywords` | `string[]` | `[]` | `[htmx, tutorial]` | SEO keywords. Collected across pages for index page metadata. |

### Optional — Product Fields

Used with `Type: product` pages. See [ecommerce.md](ecommerce.md) for full details.

| Field | Type | Default | Example | Purpose |
|---|---|---|---|---|
| `PriceCents` | `number` | — | `1200` | Price in cents (e.g. `1200` = $12.00). The `{{product}}` tag formats this automatically. |
| `Currency` | `string` | `usd` | `usd` | ISO currency code. |
| `StripePriceId` | `string` | — | `price_1QxABC...` | Stripe Price ID from your Stripe Dashboard. |
| `Image` | `string` | — | `☕` or URL | Image URL or emoji for product card thumbnails. |

### Optional — Component Data Fields

Arbitrary YAML that drives **data-driven components**. Any key in frontmatter flows through to `TemplateContext.frontmatter` where the tag engine can read it.

| Field | Type | Example | Used by |
|---|---|---|---|
| `Hero` | `CtaSectionProps` | See index.md | `{{hero}}` tag → CtaSection component (hero variant) |
| `CTA` | `CtaSectionProps` | See index.md | `{{call-to-action}}` tag → CtaSection component (banner variant) |
| `Features` | `CardGridProps` | See index.md | `{{feature-grid}}` tag → CardGrid component |
| `Showcase` | `CardGridProps` | See index.md | `{{showcase-grid}}` tag → CardGrid component |
| `Stats` | `StatsBarProps` | See index.md | `{{stats-bar}}` tag → StatsBar component |
| `Skills` | `SkillInfo[]` | See agent.md | `{{skill-cards}}` tag → SkillCards component |

**CtaSection props** (`Hero:` / `CTA:`): `heading`, `subtitle?`, `tagline?` (hero only), `primaryCta: { label, href }`, `secondaryCta?: { label, href }`.

**CardGrid props** (`Features:` / `Showcase:`): `heading`, `subtitle?`, `items[]` where each item has `icon`, `title`, `description`, `href?`, `color?`.

**StatsBar props** (`Stats:`): `stats[]` where each stat has `value`, `label`, `color`.

The `Skills` array contains objects with: `name`, `icon`, `description`, `tags` (string[]), `color` (green\|blue\|purple\|amber\|gray\|rose\|teal).

## Complete Example

```yaml
---
title: Getting Started with HTMX
Short-URI: getting-started-htmx
Type: post
Category: Tutorials
Labels:
  - htmx
  - beginner
  - javascript
Parent: blog
Order: 1
Author: Jane Developer
Date: 2026-02-01
Description: Learn how to add dynamic behavior to your static site
Keywords:
  - htmx
  - tutorial
  - beginner
---
```

## How Each Field Drives the System

### `Parent` → Navigation + Hierarchy

```
Parent: root          → Appears in the top navigation bar
Parent: blog          → Child of the blog section page
Parent: (omitted)     → Defaults to root
```

The `Parent` field builds a tree:

```
root
├── Home         (Parent: root, Order: 1)
├── About        (Parent: root, Order: 2)
├── HTMX Demo    (Parent: root, Order: 3)
├── Component    (Parent: root, Order: 4)
├── Blog         (Parent: root, Order: 4)
│   ├── Getting Started with HTMX    (Parent: blog, Order: 1)
│   ├── Tailwind Patterns            (Parent: blog, Order: 2)
│   ├── Static Sites Are Back        (Parent: blog, Order: 3)
│   └── Markdown Workflows           (Parent: blog, Order: 4)
├── Shop         (Parent: root, Order: 5)
│   └── Blue Mug                     (Parent: shop, Order: 1)
└── Agent        (Parent: root, Order: 6)
```

This tree powers:
- **Top navigation** — filtered to `Parent: root`, sorted by `Order`
- **Tree menus** — `TreeMenu` component renders the full hierarchy
- **Breadcrumbs** — `generateBreadcrumbs()` walks the tree from root to current page

### `Order` → Sorting

Pages are sorted by `Order` ascending, then alphabetically by `title` for ties. The default `999` ensures unordered pages appear last.

### `Category` → Grouping (one per page)

Categories provide primary classification. The `index-generator.ts` module auto-generates an index page for each unique category:

```
/category/tutorials   → lists all pages with Category: Tutorials
/category/deep-dives  → lists all pages with Category: Deep Dives
```

The `CategoryNav` component renders pill-style filter buttons with counts.

### `Labels` → Tagging (many per page)

Labels are cross-cutting concerns. A page can have any number. The `index-generator.ts` module auto-generates an index page for each unique label:

```
/label/htmx       → lists all pages tagged with htmx
/label/beginner   → lists all pages tagged with beginner
```

The `LabelCloud` component renders a weighted tag cloud where size scales with frequency.

### `Category` vs `Labels`

| | Category | Labels |
|---|---|---|
| Cardinality | **One** per page | **Many** per page |
| Purpose | Primary classification | Topics, themes, tags |
| Navigation | Filter buttons with counts | Weighted tag cloud |
| Hierarchy | Top-level grouping | Flat cross-cutting |
| Example | "Tutorials" | "htmx", "beginner", "css" |

### `Type` → Page Semantics

| Type | Meaning | Example |
|---|---|---|
| `page` | Standalone page | About, Contact |
| `post` | Leaf content in a section | Blog posts |
| `section` | Container page with children | Blog index, Shop index |
| `product` | E-commerce item | Products in the shop |

The `TreeMenu` component renders `section` nodes with bold/semibold styling.

### `Short-URI` → Identity & URL

The `Short-URI` is the stable identifier for a page **and determines its URL**. It's used:
- As the output directory name — `Short-URI: htmx-demo` → `dist/htmx-demo/index.html` at `/htmx-demo`
- As the key in hierarchy lookups (`Parent` values reference `Short-URI` values)
- For duplicate detection (`generateShortUri()` appends `-2`, `-3`, etc.)

If `Short-URI` is omitted, the builder falls back to the filename stem (non-index files) or directory name (index files), but it is strongly recommended to set it explicitly.

The `validatePageMetadata()` function enforces that Short-URIs contain only letters, numbers, hyphens, and underscores.

## Parsing Pipeline

```
Raw YAML string
    │
    ▼
parseFrontmatter()          → { data: Record<string, unknown>, content: string }
    │
    ▼
parsePageMetadata()         → PageMetadata (typed, validated, with defaults)
    │
    ├──▶ generateNavigation()      (builder reads Parent + Order)
    ├──▶ buildPageHierarchy()      (hierarchy reads Parent)
    ├──▶ generateAllIndexes()      (index-generator reads Category + Labels)
    └──▶ renderPage()              (template reads title, description)
```

## Content Directory Structure

```
content/
├── index.md                        → /              (Home)
├── about.md                        → /about         (About)
├── htmx.md                         → /htmx          (HTMX Demo)
├── component.md                    → /component     (Component Demo)
├── agent.md                        → /agent         (Agent & Skills)
├── blog/
│   ├── index.md                    → /blog           (Blog section index)
│   ├── getting-started-with-htmx.md → /blog/getting-started-with-htmx
│   ├── tailwind-component-patterns.md → /blog/tailwind-component-patterns
│   ├── static-sites-are-back.md    → /blog/static-sites-are-back
│   └── markdown-powered-workflows.md → /blog/markdown-powered-workflows
└── shop/
    ├── index.md                    → /shop           (Shop section index)
    └── blue-mug.md                 → /shop/blue-mug  (Product page)
```

File paths determine URLs. Frontmatter determines everything else.
