# Tag Reference

Complete list of `{{tag}}` placeholders available in templates.

## Structural Tags

| Tag | Output |
|-----|--------|
| `{{head}}` | Full `<!DOCTYPE><html><head>...</head>` with meta, title, CSS |
| `{{navigation}}` | Top navigation bar (from `Navigation` component) |
| `{{content}}` | Compiled Markdown content |
| `{{label-footer}}` | Site-wide label cloud footer (from `LabelFooter` component) |
| `{{foot-scripts}}` | Closing `<script>` tags (HTMX, bundled JS) |
| `{{blog-header}}` | Article header: category pill, title, byline, reading time, labels |
| `{{gadget}}` | Interactive demo widget (from `Gadget` component) |
| `{{cart}}` | Shopping cart widget, hydrated client-side (from `Cart` component) |
| `{{product}}` | Demo product card with Add-to-Cart (from `Product` component) |

## Scalar Tags (resolve to plain text)

| Tag | Source |
|-----|--------|
| `{{title}}` | Frontmatter `title` field |
| `{{description}}` | Frontmatter `Description` field |
| `{{keywords}}` | Frontmatter `Keywords` (comma-separated) |
| `{{author}}` | Frontmatter `Author` field |
| `{{category}}` | Frontmatter `Category` field |
| `{{basePath}}` | URL prefix for subpath hosting (e.g. `/Flint` or `""`) |
| `{{formatted-date}}` | Human-readable date (e.g. `February 1, 2026`) |
| `{{reading-time}}` | Estimated reading time (e.g. `3 min read`) |

## Fragment Tags (resolve to HTML snippets)

| Tag | Output |
|-----|--------|
| `{{category-pill}}` | Category badge `<span>` with blue styling |
| `{{label-badges}}` | Label `<span>` elements with gray styling |

## Conditionals

```html
{{#if navigation}}{{navigation}}{{/if}}
{{#if label-footer}}{{label-footer}}{{/if}}
```

Renders the inner block only when the tag resolves to non-empty output. Use for any optional tag so pages missing data render cleanly.

## Adding New Tags

To add a custom tag, create a component and register it in `src/templates/tag-engine.ts`. See the `add-component` skill.
