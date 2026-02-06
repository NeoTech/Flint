# Markdown Pipeline

Flint's Markdown compiler is more than a wrapper around `marked`. It runs a multi-stage preprocessing pipeline that supports child page listings, HTMX attribute syntax, and raw HTML blocks — then compiles standard Markdown — then restores the raw blocks.

## Pipeline Overview

```
  Input: raw Markdown string (with frontmatter)
      │
      ▼
  ┌──────────────────────────────┐
  │ 0. processChildrenDirectives()│   Resolve :::children blocks → expand to :::html listings
  └──────────┬───────────────────┘   (runs in the builder, before markdown compilation)
             │
             ▼
  (frontmatter stripped by gray-matter)
      │
      ▼
  ┌──────────────────────┐
  │ 1. extractHtmlBlocks()│   Replace :::html blocks with <!--HTML_BLOCK_N--> placeholders
  └──────────┬───────────┘
             │
             ▼
  ┌──────────────────────────┐
  │ 2. processHtmxMarkdown() │   Convert [text](url){hx-attrs} to <a hx-get=...> or <button>
  └──────────┬───────────────┘
             │
             ▼
  ┌──────────────────────┐
  │ 3. marked.parse()    │   Standard GFM Markdown → HTML
  └──────────┬───────────┘
             │
             ▼
  ┌──────────────────────────┐
  │ 4. restoreHtmlBlocks()   │   Replace <!--HTML_BLOCK_N--> with original raw HTML
  └──────────┬───────────────┘
             │
             ▼
  Output: HTML string
```

**Why this order?**

- HTML blocks must be extracted **first** so `marked` doesn't escape them
- HTMX syntax must be converted **before** `marked` because `marked` would parse `[text](url)` as a regular link and discard the `{attrs}` part
- HTML blocks are restored **after** `marked` so the raw HTML passes through untouched
- Children directives run **first** (in the builder) because they need access to other pages' metadata, and their output may contain `:::html` blocks that the later stages handle

## Stage 0: Children Directive (`:::children`)

**Module:** `src/core/children-directive.ts`

The children directive automatically generates a listing of child pages for section pages. Instead of hardcoding HTML for each sub-page, you write a single directive and the build system populates it from child page frontmatter.

### Syntax

````markdown
:::children sort=date-desc limit=5 class="space-y-4"
<div class="card">
  <a href="{url}">{title}</a>
  <p>{description}</p>
  <p>{date} · {category} {labels:badges}</p>
</div>
:::
````

The block between `:::children` and `:::` is the **template** — it gets repeated once for each child page. If no template body is provided, a default card template is used.

### Options

Specified on the opening `:::children` line:

| Option | Values | Default | Description |
|---|---|---|---|
| `sort` | `date-desc`, `date-asc`, `order`, `title` | `date-desc` | Sort order for child pages |
| `limit` | any positive integer | (no limit) | Maximum number of children to show |
| `class` | any CSS classes (quoted) | `"space-y-4"` | Wrapper `<div>` CSS classes |

### Template Placeholders

| Placeholder | Resolves to | Example |
|---|---|---|
| `{title}` | Page title | `Getting Started with HTMX` |
| `{url}` | Page URL path | `/blog/getting-started-with-htmx` |
| `{description}` | Page description | `Learn HTMX basics` |
| `{date}` | Formatted date | `Feb 1, 2026` |
| `{date:iso}` | ISO date | `2026-02-01` |
| `{category}` | Category name | `Tutorials` |
| `{labels}` | Comma-separated labels | `htmx, beginner` |
| `{labels:badges}` | Styled `<span>` badges | `<span class="...">htmx</span> ...` |
| `{author}` | Author name | `Jane Developer` |
| `{type}` | Page type | `post` |
| `{short-uri}` | Short-URI identifier | `getting-started-htmx` |

### Default Template

When the body is empty, this card template is used:

```html
<div class="border border-gray-200 rounded p-4 hover:shadow-sm transition-shadow">
  <a href="{url}" class="text-lg font-semibold text-blue-600 hover:underline">{title}</a>
  <p class="text-sm text-gray-500 mt-1">{date} · {category} {labels:badges}</p>
  <p class="text-gray-600 mt-2">{description}</p>
</div>
```

### Examples

**Minimal — default card layout, newest first:**
````markdown
:::children
:::
````

**Custom sort and limit:**
````markdown
:::children sort=title limit=3
:::
````

**Custom template — simple link list:**
````markdown
:::children sort=order
<li><a href="{url}">{title}</a> — {description}</li>
:::
````

**Custom template — grid cards:**
````markdown
:::children sort=date-desc class="grid grid-cols-2 gap-4"
<div class="p-4 border rounded">
  <a href="{url}" class="font-bold">{title}</a>
  <p class="text-sm text-gray-500">{date} · {author}</p>
  <p class="mt-2">{description}</p>
  <div class="mt-2">{labels:badges}</div>
</div>
:::
````

### How It Works

1. The builder scans all content files and groups pages by their `Parent` field
2. For each page containing `:::children`, the builder looks up children by the page's `Short-URI`
3. `processChildrenDirectives()` sorts/limits the children and renders the template for each
4. The output is wrapped in a `:::html` block so it passes through the Markdown compiler untouched
5. The normal pipeline then processes the result (html-blocks → htmx → marked → restore)

### Limitations

- `:::children` cannot be nested inside `:::html` blocks (all `:::` blocks are terminated by the first `:::` encountered)
- The template body is treated as HTML — for Markdown-based listings, use standard Markdown instead
- Labels are rendered with a uniform blue colour scheme; customise via a custom template

## Stage 1: Raw HTML Blocks (`:::html`)

**Module:** `src/core/html-blocks.ts`

### Syntax

````markdown
:::html
<div hx-get="/fragments/greeting.html"
     hx-target="#result"
     hx-swap="innerHTML"
     class="p-4 bg-blue-600 text-white rounded cursor-pointer">
  Click to load
</div>
<div id="result"></div>
:::
````

Everything between `:::html` and `:::` is treated as **raw HTML** — it will not be processed by Markdown or escaped.

### How It Works

1. `extractHtmlBlocks()` finds all `:::html` / `:::` blocks using a regex
2. Each block's content is stored in a `Map<string, string>`
3. The block is replaced with a placeholder: `<!--HTML_BLOCK_0-->`, `<!--HTML_BLOCK_1-->`, etc.
4. After `marked` compiles the rest of the Markdown, `restoreHtmlBlocks()` swaps placeholders back
5. If `marked` wrapped a placeholder in `<p>` tags, those are stripped too

### When to Use

- HTMX interactive elements that need precise HTML control
- Complex HTML structures (tables with colspan, forms, embedded widgets)
- Any HTML that Markdown would otherwise mangle or escape

## Stage 2: HTMX Markdown Syntax

**Module:** `src/core/htmx-markdown.ts`

### Syntax

```markdown
[Click Me](/fragments/greeting.html){hx-get hx-target=#result hx-swap=innerHTML}
```

This extends standard Markdown link syntax with an `{attributes}` block.

### Output

The above produces:

```html
<a href="/fragments/greeting.html" hx-get="/fragments/greeting.html" hx-target="#result" hx-swap="innerHTML">Click Me</a>
```

### Attribute Parsing

The `{...}` block supports several formats:

```markdown
{hx-get=/api/data}                           → hx-get="/api/data"
{hx-get hx-target=#result}                   → hx-get (value-less), hx-target="#result"
{hx-trigger="click delay:500ms"}             → hx-trigger="click delay:500ms" (quoted values for spaces)
{hx-get=/url hx-target=#id hx-swap=outerHTML} → multiple attributes
```

### Links vs Buttons

The processor automatically chooses the output element:

| Condition | Output Element |
|---|---|
| Has `hx-post`, `hx-delete`, `hx-put`, `hx-patch`, or `hx-trigger` | `<button>` |
| Everything else | `<a>` |

### Image Safety

The regex uses a negative lookbehind `(?<!!)` so image syntax isn't caught:

```markdown
![Alt text](image.png)        → NOT matched (image — starts with !)
[Link text](url){hx-get}      → matched (link with attributes)
[Regular link](url)            → NOT matched (no {attrs} block)
```

### Available Functions

| Function | Purpose |
|---|---|
| `parseHtmxAttributes(str)` | Parse `{key=value ...}` into a `Record<string, string>` |
| `renderHtmxElement(tag, attrs, content)` | Build an HTML element string |
| `processHtmxMarkdown(markdown)` | Full preprocessor — find and replace all HTMX links |
| `hasHtmxAttributes(markdown)` | Check if markdown contains any HTMX syntax |
| `extractHtmxHooks(markdown)` | Extract all `hx-get` URLs for preloading |

## Stage 3: Marked Compilation

**Module:** `src/core/markdown.ts`

Uses [marked](https://marked.js.org/) with these defaults:

| Option | Default | Purpose |
|---|---|---|
| `gfm` | `true` | GitHub Flavored Markdown (tables, strikethrough, autolinks) |
| `breaks` | `false` | Don't convert single newlines to `<br>` |
| `allowHtml` | `true` | Pass raw HTML through without escaping |

If `allowHtml` is set to `false`, a custom renderer escapes all HTML entities in raw HTML blocks.

### The `MarkdownCompiler` Class

```typescript
const compiler = new MarkdownCompiler({ allowHtml: true, gfm: true });

// Compile markdown only
const html = compiler.compile('# Hello **world**');
// → '<h1>Hello <strong>world</strong></h1>'

// Compile with frontmatter extraction
const result = compiler.compileWithFrontmatter('---\ntitle: Test\n---\n# Hello');
// → { html: '<h1>Hello</h1>', data: { title: 'Test' } }
```

## Putting It All Together

Here's a real content file and what each stage does to it:

### Input

````markdown
# My Page

A regular paragraph.

[Load Content](/fragments/data.html){hx-get hx-target=#output hx-swap=innerHTML}

:::html
<div id="output" class="p-4 border rounded min-h-[100px]">
  Content will appear here.
</div>
:::

Another paragraph with **bold** text.
````

### After Stage 1 (extractHtmlBlocks)

````markdown
# My Page

A regular paragraph.

[Load Content](/fragments/data.html){hx-get hx-target=#output hx-swap=innerHTML}

<!--HTML_BLOCK_0-->

Another paragraph with **bold** text.
````

*The `<div id="output">` block is safely stashed.*

### After Stage 2 (processHtmxMarkdown)

````markdown
# My Page

A regular paragraph.

<a href="/fragments/data.html" hx-get="/fragments/data.html" hx-target="#output" hx-swap="innerHTML">Load Content</a>

<!--HTML_BLOCK_0-->

Another paragraph with **bold** text.
````

*The HTMX link is now a proper `<a>` element.*

### After Stage 3 (marked.parse)

```html
<h1>My Page</h1>
<p>A regular paragraph.</p>
<a href="/fragments/data.html" hx-get="/fragments/data.html" hx-target="#output" hx-swap="innerHTML">Load Content</a>
<p><!--HTML_BLOCK_0--></p>
<p>Another paragraph with <strong>bold</strong> text.</p>
```

### After Stage 4 (restoreHtmlBlocks)

```html
<h1>My Page</h1>
<p>A regular paragraph.</p>
<a href="/fragments/data.html" hx-get="/fragments/data.html" hx-target="#output" hx-swap="innerHTML">Load Content</a>
<div id="output" class="p-4 border rounded min-h-[100px]">
  Content will appear here.
</div>
<p>Another paragraph with <strong>bold</strong> text.</p>
```

*The `<p>` wrapper around the placeholder is stripped. The raw HTML is restored verbatim.*
