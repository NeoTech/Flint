# Markdown Directives

## `:::children` — Auto-Generated Child Listings

Renders child pages of the current page using their frontmatter metadata.

### Syntax

```markdown
:::children sort=date-desc limit=5 class="space-y-4" type=product
<div class="card">
  <a href="{url}">{title}</a>
  <p>{description}</p>
</div>
:::
```

If the body is omitted, a default card template is used:
```markdown
:::children
:::
```

### Options

| Option | Values | Default |
|--------|--------|---------|
| `sort` | `date-desc`, `date-asc`, `order`, `title` | `date-desc` |
| `limit` | any positive integer | (no limit) |
| `class` | CSS classes (quote if spaces) | `"space-y-4"` |
| `type` | `product`, `post`, `page`, etc. | (all types) |

### Template Placeholders

| Placeholder | Output |
|-------------|--------|
| `{title}` | Page title |
| `{url}` | Page URL path |
| `{description}` | Meta description |
| `{date}` | Formatted date (e.g. `Feb 1, 2026`) |
| `{date:iso}` | ISO date (`2026-02-01`) |
| `{category}` | Category string |
| `{labels}` | Comma-separated labels |
| `{labels:badges}` | Labels as `<span>` elements |
| `{author}` | Author name |
| `{type}` | Page type |
| `{short-uri}` | Short-URI slug |
| `{price}` | Formatted price (products) |
| `{image}` | Image/emoji (products) |
| `{price-cents}` | Raw cents value (products) |
| `{currency}` | Currency code (products) |
| `{stripe-price-id}` | Stripe Price ID (products) |

## `:::html` — Raw HTML Blocks

Embeds raw HTML that bypasses Markdown processing.

```markdown
:::html
<div class="flex gap-4" hx-get="/fragments/demo.html" hx-target="#output">
  <button class="bg-blue-600 text-white px-4 py-2 rounded">Click</button>
  <div id="output"></div>
</div>
:::
```

- Content is extracted before Markdown compilation and restored after
- No Markdown processing inside the block — raw HTML only
- Cannot nest `:::` blocks

## HTMX Attribute Syntax

Extend Markdown links with HTMX attributes:

```markdown
[Load Content](/fragments/data.html){hx-get hx-target=#output hx-swap=innerHTML}
```

Produces:
```html
<a href="/fragments/data.html" hx-get="/fragments/data.html" hx-target="#output" hx-swap="innerHTML">Load Content</a>
```

If attributes include `hx-post`, `hx-delete`, `hx-put`, `hx-patch`, or `hx-trigger`, a `<button>` is rendered instead of `<a>`.
