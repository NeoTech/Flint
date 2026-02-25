---
name: add-template
description: Create or edit Flint Static page templates (HTML with {{tag}} placeholders). Use when adding new page layouts or modifying the structural skeleton of pages.
---

# Add / Edit a Template

Create or modify HTML page templates in `themes/default/templates/`. Templates define page structure and layout using `{{tag}}` placeholders — no TypeScript needed.

## Trigger Phrases

- "Create a new template for [layout]"
- "Add a [sidebar / full-width / article] layout"
- "Change the page structure for [page type]"
- "Move the navigation to the side"
- "Make a two-column layout template"
- "Add a new page layout"
- "Create a template that shows [component] after the content"

## When to Use

- Adding a new page layout (sidebar, full-width, article, landing page)
- Modifying where navigation, content, or footer appear on a page
- Composing existing components into a new arrangement

## Procedure

### 1. Check existing templates

Before creating a new template, check `themes/default/templates/` — reuse or copy an existing one if close enough.

| Name | Purpose |
|------|---------|
| `default` | Standard page (nav, content, label footer) |
| `blank` | Minimal shell (content + scripts only) |
| `blog-post` | Article layout with byline header |
| `shop` | Shop layout with cart widget |
| `agent-info` | Two-column with sidebar (skills page) |

### 2. Create the file

Create the template in the active theme's directory: `themes/<THEME>/templates/<name>.html` (check `THEME` in `.env`). To make a template available to all themes, use `themes/default/templates/<name>.html` — themes overlay on top of `default` and inherit any templates they don't override. Start from this skeleton:

```html
{{head}}
<body class="min-h-screen bg-gray-50">
    <div id="app" class="flex flex-col min-h-screen overflow-x-hidden">
        {{#if navigation}}{{navigation}}{{/if}}
        <main class="flex-grow max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
            {{content}}
        </main>
        {{#if label-footer}}{{label-footer}}{{/if}}
    </div>
    {{foot-scripts}}
</body>
</html>
```

### 3. Place tags

**Required in every template:**
- `{{head}}` — opens `<!DOCTYPE>`, `<html>`, `<head>` with meta/CSS
- `{{content}}` — compiled Markdown body
- `{{foot-scripts}}` — closing `<script>` tags before `</body>`

**Optional structural tags:** `{{navigation}}`, `{{label-footer}}`, `{{blog-header}}`, `{{cart}}`, `{{gadget}}`

**Data-driven tags (read from frontmatter):** `{{product}}`, `{{skill-cards}}` — these return `''` when the page's frontmatter lacks the required fields, so always use `{{#if}}` guards.

**Optional scalar tags:** `{{title}}`, `{{description}}`, `{{author}}`, `{{category}}`, `{{formatted-date}}`, `{{reading-time}}`

**Fragments:** `{{category-pill}}`, `{{label-badges}}`

**Conditionals:** Wrap optional tags so pages without data render cleanly:
```html
{{#if navigation}}{{navigation}}{{/if}}
```

See `references/tag-reference.md` for full tag details.

### 4. Style with Tailwind

Use Tailwind utility classes directly in the HTML. No `<style>` tags or external CSS links.

### 5. Wire it up

Set `Template: <name>` in content frontmatter files that should use this layout.

### 6. Build

```bash
bun run build
```

## Constraints

- **No `<script>` tags** — client JS is bundled by Rspack from `src/client/`
- **No loops or complex logic** — if you need loops, create a component
- **No hard-coded text content** — page text comes from Markdown content
- **No hard-coded data** — product prices, post titles come from frontmatter via tags
- **No reusable HTML patterns** — if it appears in multiple templates, make it a component

## References

- `references/tag-reference.md` — Complete list of all available `{{tag}}` placeholders with descriptions
- `references/examples.md` — Real template examples from the codebase
