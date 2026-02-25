# Section Patterns → Flint Static Primitives

Use this table during Phase 2 to classify each detected design section.

---

## Navigation

| Detected pattern | Flint Static answer | Notes |
|-----------------|-------------|-------|
| Top nav bar with site name + links | `{{navigation}}` in template | Auto-generated from hierarchy — no hardcoding |
| Hamburger / mobile nav | Included in `{{navigation}}` | Already handled by NavigationComponent |
| Sidebar nav | `{{navigation}}` + template flex layout | Use `flex-row` wrapper, nav in a `<aside>` |
| Breadcrumbs | `{{breadcrumbs}}` tag | Auto-generated from page ancestry |

---

## Hero / Above the Fold

| Detected pattern | Flint Static answer | Frontmatter key |
|-----------------|-------------|----------------|
| Full-width hero with headline, subtext, CTA button | `{{hero}}` | `Hero:` block |
| Hero with two CTA buttons (primary + secondary) | `{{hero}}` | `Hero.CTA` + `Hero.SecondaryCTA` |
| Simple page title + description header | `{{blog-header}}` | Reads `title`, `description` fields |
| Video background hero | New component or `:::html` block | Custom — use `:::html` unless reusable |
| Gradient banner / announcement bar | `{{call-to-action}}` (`banner` variant) | `CTA:` block |

---

## Feature Sections

| Detected pattern | Flint Static answer | Frontmatter key |
|-----------------|-------------|----------------|
| Grid of icon + title + description cards | `{{feature-grid}}` | `Features:` array |
| Linked card grid (portfolio, products, posts) | `{{showcase-grid}}` | `Showcase:` array with `href` |
| Alternating image + text rows | New component or `:::html` | Rarely reusable enough for a component |
| Three-column "why us" section | `{{feature-grid}}` | `Features:` — use colour field for icon bg |
| Testimonial cards | New `TestimonialGrid` component | Follow `add-component` skill |

---

## Statistics / Social Proof

| Detected pattern | Flint Static answer | Frontmatter key |
|-----------------|-------------|----------------|
| Row of big numbers with labels | `{{stats-bar}}` | `Stats:` array |
| Inline badge/pill metrics in hero | Add to hero subtitle text in frontmatter | |

---

## Content Areas

| Detected pattern | Flint Static answer | Notes |
|-----------------|-------------|-------|
| Long-form article / blog post | `{{content}}` in `blog-post` template | Markdown body |
| FAQ accordion | `:::html` block with HTMX `hx-on:click` | Or a new FaqSection component |
| Pricing table | New `PricingTable` component | Follow `add-component` skill |
| Comparison table | `:::html` in content | One-off — not worth a component |
| Code samples / docs | `{{content}}` — Markdown handles code fences | No extra component needed |

---

## Listings / Indexes

| Detected pattern | Flint Static answer | Notes |
|-----------------|-------------|-------|
| Blog post listing | `:::children` directive | Auto-renders child pages as cards |
| Product grid | `:::children` in shop section | Renders product cards |
| Team members grid | `{{showcase-grid}}` or `:::children` | Under a `team/` content section |
| Recent posts sidebar widget | New component reading page index | `LabelIndex` may be adaptable |

---

## E-Commerce

| Detected pattern | Flint Static answer | Notes |
|-----------------|-------------|-------|
| Product card (image, title, price, button) | `{{product}}` | `product-detail` or `product-demo` template |
| Cart widget / drawer | `{{cart}}` | Already implemented |
| Shop listing page | `shop` template + `:::children` | |
| Checkout button | `{{product}}` component handles it | Links to payment link or serverless checkout |

---

## Footer

| Detected pattern | Flint Static answer | Notes |
|-----------------|-------------|-------|
| Tag/label cloud footer | `{{label-footer}}` | Auto-generated from all site labels |
| Simple copyright bar | Add directly to template HTML | One `<footer>` element with Tailwind |
| Multi-column footer with links | New `SiteFooter` component | Follow `add-component` skill |
| Newsletter signup form | `:::html` block or new component + CF Worker | Needs server endpoint for submission |

---

## Calls to Action (Mid-page)

| Detected pattern | Flint Static answer | Frontmatter key |
|-----------------|-------------|----------------|
| Full-width dark/brand CTA banner | `{{call-to-action}}` | `CTA:` block |
| Inline CTA inside article | `:::html` block | |
| Sticky bottom bar | New client module in `src/client/` | JS-driven sticky behaviour |

---

## Classification Decision Guide

```
Is it already a Flint Static component?
  Yes → use its {{tag}} + add the correct frontmatter key
  No  → Is it page-specific?
          Yes → :::html block in content (don't make a component)
          No  → Will it appear on 2+ pages?
                  Yes → create a new Component<T>
                  No  → :::html block
```
