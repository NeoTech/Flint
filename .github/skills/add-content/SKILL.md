---
name: add-content
description: Create or edit Flint Static content pages (Markdown + YAML frontmatter). Use when adding pages, blog posts, section indexes, or products to the site.
---

# Add / Edit Content

Create or modify content pages in `content/`. Each `.md` file becomes an HTML page at build time. The file path determines the URL; frontmatter determines everything else.

## Trigger Phrases

- "Add a page about [topic]"
- "Create a blog post about [topic]"
- "Add a new section called [name]"
- "Write content for [page]"
- "Create a landing page for [topic]"
- "Add [name] to the blog"
- "Update the frontmatter on [page]"
- "Add a child page under [section]"
- "Create a product page for [name]"

## When to Use

- Adding a new page, blog post, section index, or product
- Editing frontmatter fields (title, parent, labels, etc.)
- Adding `:::children`, `:::html`, or HTMX links to a page

## Procedure

### 1. Pick the file path

| Goal | File path | URL |
|------|-----------|-----|
| Top-level page | `content/<slug>.md` | `/<slug>` |
| Section index | `content/<section>/index.md` | `/<section>` |
| Child page | `content/<section>/<slug>.md` | `/<section>/<slug>` |

### 2. Write frontmatter

Every file **must** have `Short-URI`. See `references/frontmatter-fields.md` for all fields.

```yaml
---
title: My Page Title
Short-URI: my-page
Template: default
Type: page
Parent: root
Order: 3
Category: General
Labels: [tutorial, beginner]
Description: A short SEO summary
---
```

- `Parent: root` → appears in top navigation
- `Parent: <section-short-uri>` → child of that section
- `Type: section` → container page, use `:::children` in body
- `Type: product` → requires `PriceCents`, `Currency`, `StripePriceId`, `StripePaymentLink`, `Image`

### 3. Write the Markdown body

Standard GFM Markdown. Extend with three directives:

**Auto-list child pages:**
```markdown
:::children sort=date-desc limit=5
:::
```

**Raw HTML block:**
```markdown
:::html
<div hx-get="/fragments/demo.html" hx-target="#output">
  <button class="bg-blue-600 text-white px-4 py-2 rounded">Click Me</button>
  <div id="output"></div>
</div>
:::
```

**HTMX link:**
```markdown
[Load Data](/fragments/data.html){hx-get hx-target=#output hx-swap=innerHTML}
```

See `references/directives.md` for full options and placeholders.

### 4. Validate

- `Short-URI` is unique across all content files
- `Parent` matches an existing section's `Short-URI` or is `root`
- `Template` matches a file in `themes/default/templates/` (without `.html`)
- `Type` is one of: `page`, `post`, `section`, `product`
- Section indexes include a `:::children` directive
- Products have all five product fields

### 5. Build

```bash
bun run build
```

## Constraints

- No `<style>` or `<link>` tags — use Tailwind in `:::html` blocks
- No `<script>` blocks — client JS goes in `src/client/`
- No nested `:::` blocks — first `:::` closes the block
- No Markdown inside `:::html` — it's raw HTML only
- No hard-coded nav links — navigation is auto-generated from `Parent` + `Order`
- **No HTML cards for data a component already renders** — put structured data in frontmatter and let `{{tag}}` components render it (e.g. `Skills:` array → `{{skill-cards}}`, product fields → `{{product}}`)

## References

- `references/frontmatter-fields.md` — Complete field reference with types and defaults
- `references/directives.md` — `:::children`, `:::html`, and HTMX syntax details
- `references/examples.md` — Full page examples (blog post, product, section index)
