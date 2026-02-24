# Templates

Templates are plain HTML files with `{{tag}}` placeholders that define the page skeleton. No TypeScript needed — just HTML.

## Location

Templates live in `themes/default/templates/` by default:

```
themes/default/templates/
├── default.html        # Standard page (nav, content, footer)
├── blank.html          # Minimal shell (no nav, no footer)
├── blog-post.html      # Article layout (byline, reading time)
├── landing.html        # Landing page with hero, features, stats, showcase, CTA
├── shop.html           # E-commerce layout with cart sidebar
├── agent-info.html     # Two-column layout with skill cards + sidebar
├── product-demo.html   # Product detail page with product card
├── product-detail.html # Product detail with cart widget
└── component-demo.html # Interactive component demo layout
```

The builder loads templates from `themes/default/templates/`. If a non-default theme is active, templates from `themes/<theme>/templates/` are overlaid on top of the defaults. You can also set `templatesDir` in the builder config to point somewhere else entirely.

## Selecting a Template

Set the `Template` frontmatter field in any content file:

```markdown
---
title: My Post
Template: blog-post
---
```

If omitted, `default` is used. If the named template doesn't exist, it falls back to `default`.

## Creating a New Template

1. Create `themes/default/templates/<name>.html`
2. Use `{{tag}}` placeholders and `{{#if tag}}...{{/if}}` conditionals
3. Set `Template: <name>` in content frontmatter
4. Build — that's it

### Example: A minimal "landing" template

```html
{{head}}
<body class="bg-black text-white">
    <div class="max-w-4xl mx-auto py-16 px-4">
        {{content}}
    </div>
    {{foot-scripts}}
</body>
</html>
```

## Available Tags

### Structural Tags

| Tag | Output |
|-----|--------|
| `{{head}}` | Full `<!DOCTYPE html><html><head>...</head>` with meta tags, title, CSS |
| `{{navigation}}` | Site navigation bar (renders the `Navigation` component) |
| `{{content}}` | Pre-compiled page content from markdown |
| `{{label-footer}}` | Site-wide label cloud footer |
| `{{foot-scripts}}` | Closing `<script>` tags (main.js) |
| `{{blog-header}}` | Full article header: category pill, title, byline, reading time, label badges |

### Component Tags

| Tag | Output |
|-----|--------|
| `{{gadget}}` | Interactive demo widget (Gadget component) |
| `{{cart}}` | Shopping cart widget placeholder (Cart component, hydrated client-side) |

### Data-Driven Tags

These tags read their props from the page's **YAML frontmatter**. They return empty string when the required data is missing.

| Tag | Frontmatter Fields | Output |
|-----|-------------------|--------|
| `{{hero}}` | `Hero` (heading, subtitle, primaryCta, secondaryCta, tagline) | Full-width gradient hero section (CtaSection, hero variant) |
| `{{call-to-action}}` | `CTA` (heading, subtitle, primaryCta, secondaryCta) | Conversion banner (CtaSection, banner variant) |
| `{{feature-grid}}` | `Features` (heading, subtitle?, items[]) | Responsive grid of icon cards (CardGrid) |
| `{{showcase-grid}}` | `Showcase` (heading, subtitle?, items[] with href) | Linked card grid (CardGrid) |
| `{{stats-bar}}` | `Stats` (stats[] of value, label, color) | Dark statistics row (StatsBar) |
| `{{product}}` | `Short-URI`, `PriceCents`, `Description`, `Image` | Product card with Add-to-Cart button |
| `{{skill-cards}}` | `Skills` (array of `{ name, icon, description, tags, color }`) | Responsive grid of skill info cards |
| `{{media-gallery}}` | `Image` (asset or array of `{ src, alt?, caption? }`) | Responsive CSS grid of images (StaticMedia, gallery layout) |
| `{{media-carousel}}` | `Image` | Horizontal-scroll film-strip of images (StaticMedia, carousel layout) |
| `{{media-hero}}` | `Image` | First image as a full-width hero banner (StaticMedia, hero layout) |
| `{{media-strip}}` | `Image` | Equal-width compact thumbnail row (StaticMedia, strip layout) |
| `{{media:N}}` | `Image` | Single image at zero-based index N (e.g. `{{media:0}}`, `{{media:1}}`) |

### Scalar Tags

| Tag | Output |
|-----|--------|
| `{{title}}` | Page title text |
| `{{description}}` | Meta description text |
| `{{keywords}}` | Meta keywords text |
| `{{author}}` | Page author |
| `{{category}}` | Page category |
| `{{basePath}}` | URL base path prefix (e.g. `/Flint`) |
| `{{formatted-date}}` | Human-readable date (e.g. "February 1, 2026") |
| `{{reading-time}}` | Estimated reading time (e.g. "3 min read") |

### Fragment Tags

| Tag | Output |
|-----|--------|
| `{{category-pill}}` | Category badge `<span>` |
| `{{label-badges}}` | Label badge `<span>` elements |

### Conditionals

Wrap any block in `{{#if tagName}}...{{/if}}` to only render it when the tag resolves to a non-empty value:

```html
{{#if navigation}}
{{navigation}}
{{/if}}

{{#if label-footer}}
{{label-footer}}
{{/if}}
```

This is useful for tags like `navigation` (empty when no nav items) and `label-footer` (empty when no labels).

## Built-in Templates

### default.html

Standard page layout with navigation bar, content area (max-w-7xl), and label footer.

### blank.html

Bare-minimum shell — just `{{head}}`, content, and scripts. No navigation, no footer, no wrapper divs. Use for landing pages or fully custom layouts where the markdown provides all structure.

### blog-post.html

Article layout with:
- Navigation bar
- Narrow content column (max-w-3xl) with `<article>` semantic markup
- `{{blog-header}}` — category pill, title, author/date/reading-time byline, label badges
- Post content in a `.post-content` wrapper
- Label footer

Designed for `Type: post` content with `Author`, `Date`, `Category`, and `Labels` frontmatter fields.

### landing.html

Full-width landing page layout with data-driven sections:
- Navigation bar
- `{{hero}}` — gradient hero section (CtaSection, reads `Hero:` from frontmatter)
- `{{feature-grid}}` — responsive icon card grid (CardGrid, reads `Features:`)
- `{{stats-bar}}` — dark statistics row (StatsBar, reads `Stats:`)
- `{{showcase-grid}}` — linked card grid (CardGrid, reads `Showcase:`)
- `{{content}}` — Markdown body
- `{{call-to-action}}` — conversion banner (CtaSection, reads `CTA:`)
- Label footer

All data-driven tags are wrapped in `{{#if}}` guards so missing sections render cleanly. Used by `content/index.md`.

### shop.html

E-commerce layout with:
- Navigation bar
- Two-column layout: main content + cart sidebar
- `{{cart}}` widget in the sidebar (hydrated client-side)
- Label footer

Used by the shop section index (`content/shop/index.md`).

### agent-info.html

Two-column layout for the agent/skills info page:
- Left column: `{{content}}` + `{{skill-cards}}`
- Right column: sticky sidebar with Quick Reference card and tip box
- `{{skill-cards}}` is **data-driven** — reads `Skills` array from frontmatter

### product-demo.html

Product detail page with:
- Navigation bar
- `{{product}}` card (data-driven from frontmatter — `Short-URI`, `PriceCents`, `Description`, `Image`)
- Content area below the product card
- Label footer

### product-detail.html

Product detail page with cart integration:
- Navigation bar
- `{{cart}}` widget (top-right)
- `{{product}}` card (data-driven from frontmatter)
- Content area with back-to-shop link
- Label footer

### component-demo.html

Interactive component demo layout with:
- Navigation bar
- `{{gadget}}` widget for interactive demonstration
- Content area
- Label footer

## Architecture

The template system has three layers:

1. **HTML template files** (`templates/*.html`) — authored by content creators
2. **Tag engine** (`src/templates/tag-engine.ts`) — resolves `{{tag}}` placeholders to HTML
3. **Template registry** (`src/templates/template-registry.ts`) — loads files from disk, renders via tag engine

Templates delegate to existing **components** (Navigation, LabelFooter) for complex UI rendering. To add new dynamic elements, add a new tag to the tag engine and use it in templates.
