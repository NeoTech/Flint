# File Reference

Every source file in the project, listed with its purpose, key exports, and relationships.

## Core (`src/core/`)

The engine layer. Stateless modules that parse, compile, and build.

---

### `frontmatter.ts`

**Purpose:** Parse YAML frontmatter from Markdown content.

**Dependencies:** `gray-matter`

**Exports:**
| Export | Type | Description |
|---|---|---|
| `parseFrontmatter(content)` | function | Split Markdown into `{ data, content }` |
| `stringifyFrontmatter(data, content)` | function | Recombine data + content into a Markdown string with YAML header |
| `FrontmatterData` | interface | `Record<string, unknown>` — raw frontmatter key-value pairs |
| `ParsedFrontmatter` | interface | `{ data: FrontmatterData, content: string }` |

**Used by:** `markdown.ts`, `page-metadata.ts`

---

### `page-metadata.ts`

**Purpose:** Normalise raw frontmatter into a typed `PageMetadata` object with defaults and validation.

**Dependencies:** `frontmatter.ts`

**Exports:**
| Export | Type | Description |
|---|---|---|
| `parsePageMetadata(content)` | function | Parse Markdown → typed `PageMetadata` |
| `validatePageMetadata(metadata, existingUris?)` | function | Validate Short-URI format and parent existence |
| `generateSlug(text)` | function | Convert text to URL-friendly slug |
| `generateShortUri(title, existingUris?)` | function | Generate unique Short-URI with `-2`, `-3` suffixes |
| `PageMetadata` | interface | Full typed metadata (shortUri, title, type, category, labels, parent, order, author, date, description, keywords) |
| `PageType` | type | `'page' \| 'post' \| 'section'` |

**Used by:** `builder.ts`, `hierarchy.ts`, `index-generator.ts`, `category-nav.ts`, `label-cloud.ts`

---

### `children-directive.ts`

**Purpose:** Preprocess `:::children` directives — auto-generate child page listings from a template and page metadata.

**Dependencies:** none (receives data from builder)

**Exports:**
| Export | Type | Description |
|---|---|---|
| `processChildrenDirectives(markdown, children)` | function | Find all `:::children` blocks and expand them using child page data |
| `parseChildrenOptions(str)` | function | Parse `sort=value limit=N class="..."` option strings |
| `renderChildTemplate(template, page)` | function | Replace `{placeholder}` tokens with page data |
| `formatDate(date)` | function | Format Date as `"Feb 1, 2026"` (UTC) |
| `renderLabelBadges(labels)` | function | Render labels as styled `<span>` badge elements |
| `ChildPageData` | interface | Page data passed to template rendering (title, url, description, date, category, labels, author, type, shortUri, order) |
| `ChildrenDirectiveOptions` | interface | Parsed options (sort, limit, wrapperClass) |

**Used by:** `builder.ts`

---

### `html-blocks.ts`

**Purpose:** Extract `:::html` / `:::` delimited blocks from Markdown before compilation, restore them after.

**Dependencies:** none

**Exports:**
| Export | Type | Description |
|---|---|---|
| `extractHtmlBlocks(markdown)` | function | Replace `:::html` blocks with `<!--HTML_BLOCK_N-->` placeholders. Returns `{ markdown, blocks }` |
| `restoreHtmlBlocks(html, blocks)` | function | Swap placeholders back to raw HTML. Strips `<p>` wrappers if present. |

**Used by:** `markdown.ts`

---

### `htmx-markdown.ts`

**Purpose:** Convert `[text](url){hx-attrs}` Markdown syntax into HTML elements with HTMX attributes.

**Dependencies:** none

**Exports:**
| Export | Type | Description |
|---|---|---|
| `processHtmxMarkdown(markdown)` | function | Find and replace all HTMX link patterns |
| `parseHtmxAttributes(str)` | function | Parse `{key=value ...}` into a `Record<string, string>` |
| `renderHtmxElement(tag, attrs, content)` | function | Build `<tag attrs>content</tag>` string |
| `hasHtmxAttributes(markdown)` | function | Check if Markdown contains any HTMX syntax |
| `extractHtmxHooks(markdown)` | function | Extract all `hx-get` URLs for preloading |
| `HtmxAttributes` | interface | `Record<string, string>` |

**Used by:** `markdown.ts`

---

### `markdown.ts`

**Purpose:** Compile Markdown to HTML. Orchestrates the full preprocessing pipeline: html-blocks → htmx-markdown → marked → restore.

**Dependencies:** `marked`, `frontmatter.ts`, `htmx-markdown.ts`, `html-blocks.ts`

**Exports:**
| Export | Type | Description |
|---|---|---|
| `MarkdownCompiler` | class | Main compiler. Instantiate with options, call `compile()` or `compileWithFrontmatter()` |
| `createCompiler(options?)` | function | Factory shortcut |
| `MarkdownCompilerOptions` | interface | `{ allowHtml?, gfm?, breaks? }` |
| `CompiledMarkdown` | interface | `{ html: string, data: FrontmatterData }` |

**Key methods on `MarkdownCompiler`:**
| Method | Description |
|---|---|
| `compile(markdown)` | Compile Markdown body (no frontmatter) → HTML |
| `compileWithFrontmatter(markdown)` | Parse frontmatter + compile body → `{ html, data }` |
| `stringify(data, html)` | Re-serialize data + content to Markdown string |

**Used by:** `template.ts`

---

### `template.ts`

**Purpose:** Assemble compiled HTML content with navigation and layout into a full HTML page.

**Dependencies:** `markdown.ts`, `layout.ts`, `navigation.ts`

**Exports:**
| Export | Type | Description |
|---|---|---|
| `TemplateEngine` | class | Combines content + components into pages |
| `createTemplateEngine()` | function | Factory shortcut |
| `PageData` | interface | Input for `renderPage()`: title, content, navigation, etc. |
| `ProcessedMarkdown` | interface | Output of `processMarkdown()`: html, data, path |

**Key methods on `TemplateEngine`:**
| Method | Description |
|---|---|
| `renderPage(data)` | Full page with Layout + Navigation wrapper |
| `renderPartial(markdown)` | Compile Markdown without layout (for fragments) |
| `processMarkdown(markdown, path)` | Compile with frontmatter extraction |
| `registerComponent(name, fn)` | Register a custom component for template use |
| `renderComponent(name, props)` | Render a registered component |

**Used by:** `builder.ts`

---

### `hierarchy.ts`

**Purpose:** Build a page tree from flat `PageMetadata` records using `Parent` fields. Generate breadcrumbs and detect circular references.

**Dependencies:** `page-metadata.ts` (types only)

**Exports:**
| Export | Type | Description |
|---|---|---|
| `buildPageHierarchy(pages)` | function | Build tree from flat array. Returns root `PageNode` or null. Throws on circular refs, orphans, or multiple roots. |
| `generateBreadcrumbs(tree, targetUri)` | function | Walk tree from root to target, return `BreadcrumbItem[]` |
| `findPageByShortUri(tree, shortUri)` | function | Find a node by its Short-URI |
| `getChildren(tree, parentUri)` | function | Get direct children of a page |
| `flattenTree(tree)` | function | Convert tree back to flat array |
| `PageNode` | interface | Extends `PageMetadata` with `children?: PageNode[]` |
| `BreadcrumbItem` | interface | `{ shortUri, title }` |

**Used by:** `tree-menu.ts`

---

### `index-generator.ts`

**Purpose:** Auto-generate category and label index pages from aggregated page metadata.

**Dependencies:** `page-metadata.ts` (types only)

**Exports:**
| Export | Type | Description |
|---|---|---|
| `generateCategoryIndex(category, pages)` | function | Build an index page for one category |
| `generateLabelIndex(label, pages)` | function | Build an index page for one label |
| `generateAllIndexes(pages)` | function | Collect all unique categories and labels, generate indexes for each |
| `IndexPage` | interface | `{ title, shortUri, description, pages, keywords }` |
| `IndexPageItem` | interface | `{ shortUri, title, description, date, author, type }` |
| `AllIndexes` | interface | `{ categories: IndexPage[], labels: IndexPage[] }` |

---

### `builder.ts`

**Purpose:** Orchestrator. Scans content, compiles everything, generates navigation, writes output files.

**Dependencies:** `template.ts`, `page-metadata.ts`, `navigation.ts` (types)

**Exports:**
| Export | Type | Description |
|---|---|---|
| `SiteBuilder` | class | Main build orchestrator |
| `createBuilder(config)` | function | Factory shortcut |
| `BuildConfig` | interface | `{ contentDir, outputDir, navigation?, defaultTitle? }` |
| `ContentFile` | interface | `{ path, relativePath, name }` |
| `ProcessedFile` | interface | `{ html, data, outputPath }` |

**Key methods on `SiteBuilder`:**
| Method | Description |
|---|---|
| `scanContent(dir?, baseDir?)` | Recursively find all `.md` files |
| `processFile(content, relativePath)` | Compile one file → `{ html, data, outputPath }` |
| `build()` | Run the full build pipeline |

**Private methods:**
| Method | Description |
|---|---|
| `generateNavigation(files)` | Read metadata, filter `Parent: root`, sort by order |
| `getOutputPath(relativePath)` | Map `*.md` → clean URL output path |
| `getUrlPath(relativePath)` | Map `*.md` → URL for navigation hrefs |
| `isActivePath(href, filePath)` | Determine if a nav item matches the current page |

---

## Components (`src/components/`)

Pure rendering layer. Each component extends `Component<T>` and returns HTML strings.

---

### `component.ts`

**Purpose:** Abstract base class for all components.

**Dependencies:** none

**Exports:**
| Export | Type | Description |
|---|---|---|
| `Component<T>` | abstract class | Base class with `render()`, `escapeHtml()`, `classNames()`, static `render()` |
| `ComponentProps` | interface | `{ id?, className? }` — base props all components inherit |

---

### `layout.ts`

**Purpose:** Full HTML document shell.

**Dependencies:** `component.ts`

**Exports:**
| Export | Type | Description |
|---|---|---|
| `Layout` | class | Renders `<!DOCTYPE html>` through `</html>` with head, meta, scripts, styles |
| `LayoutProps` | interface | `{ title, description?, children, lang?, cssFiles?, jsFiles? }` |

---

### `navigation.ts`

**Purpose:** Top-level horizontal navigation bar.

**Dependencies:** `component.ts`

**Exports:**
| Export | Type | Description |
|---|---|---|
| `Navigation` | class | Horizontal nav with active state, HTMX boost, ARIA attributes |
| `NavigationProps` | interface | `{ items: NavItem[] }` |
| `NavItem` | interface | `{ label, href, active?, hxBoost?, order? }` |

---

### `navigation/tree-menu.ts`

**Purpose:** Collapsible hierarchical sidebar menu.

**Dependencies:** `component.ts`, `hierarchy.ts` (types)

**Exports:**
| Export | Type | Description |
|---|---|---|
| `TreeMenu` | class | Renders nested tree with expand/collapse, active state, depth indentation |
| `TreeMenuProps` | interface | `{ tree: PageNode, currentUri, useHtmx? }` |

---

### `navigation/category-nav.ts`

**Purpose:** Category filter pill buttons with counts.

**Dependencies:** `component.ts`, `page-metadata.ts` (types)

**Exports:**
| Export | Type | Description |
|---|---|---|
| `CategoryNav` | class | Pill-style buttons, one per category, with page count badges |
| `CategoryNavProps` | interface | `{ pages: PageMetadata[], currentCategory, useHtmx? }` |

---

### `navigation/label-cloud.ts`

**Purpose:** Weighted label tag cloud.

**Dependencies:** `component.ts`, `page-metadata.ts` (types)

**Exports:**
| Export | Type | Description |
|---|---|---|
| `LabelCloud` | class | Tag cloud with size scaling by frequency, selection state |
| `LabelCloudProps` | interface | `{ pages: PageMetadata[], selectedLabels, useHtmx? }` |

---

### `label-footer.ts`

**Purpose:** Site-wide footer displaying all labels from every content file.

**Dependencies:** `component.ts`

**Exports:**
| Export | Type | Description |
|---|---|---|
| `LabelFooter` | class | Footer with deduplicated, sorted, colour-coded label badges |
| `LabelFooterProps` | interface | `{ labels: string[] }` |

**Used by:** `layout.ts` (rendered automatically when `siteLabels` is non-empty)

---

### `product.ts`

**Purpose:** Product card with image, price, description, and Add-to-Cart button.

**Dependencies:** `component.ts`

**Exports:**
| Export | Type | Description |
|---|---|---|
| `Product` | class | Renders a product card. Data-driven — tag engine reads `Short-URI`, `PriceCents`, `Description`, `Image` from frontmatter. |
| `ProductProps` | interface | `{ id, title, price?, image?, description? }` |

**Used by:** `tag-engine.ts`

---

### `cart.ts`

**Purpose:** Shopping cart widget placeholder, hydrated client-side.

**Dependencies:** `component.ts`

**Exports:**
| Export | Type | Description |
|---|---|---|
| `Cart` | class | Renders toggle button, panel, items list, totals, checkout button. |
| `CartProps` | interface | `{ initialCount? }` |

**Used by:** `tag-engine.ts`

---

### `gadget.ts`

**Purpose:** Interactive demonstration widget that randomizes colour and text.

**Dependencies:** `component.ts`

**Exports:**
| Export | Type | Description |
|---|---|---|
| `Gadget` | class | Renders coloured box with 🎲 Randomize button and inline script. |
| `GadgetProps` | interface | `{ initialText? }` |

**Used by:** `tag-engine.ts`

---

### `skill-cards.ts`

**Purpose:** Responsive grid of skill info cards with coloured tag badges.

**Dependencies:** `component.ts`

**Exports:**
| Export | Type | Description |
|---|---|---|
| `SkillCards` | class | Renders 1–2 column grid. Data-driven — tag engine reads `Skills` array from frontmatter. |
| `SkillCardsProps` | interface | `{ skills: SkillInfo[] }` |
| `SkillInfo` | interface | `{ name, icon, description, tags, color }` |
| `SkillColor` | type | `'green' \| 'blue' \| 'purple' \| 'amber' \| 'gray' \| 'rose' \| 'teal'` |

**Used by:** `tag-engine.ts`

---

### `label-index.ts`

**Purpose:** Renders a full page listing all pages that share a particular label.

**Dependencies:** `component.ts`

**Exports:**
| Export | Type | Description |
|---|---|---|
| `LabelIndex` | class | Header, count, and card listing for one label's pages. |
| `LabelIndexProps` | interface | `{ label, pages: LabelIndexPageEntry[] }` |
| `LabelIndexPageEntry` | interface | `{ url, title, description, category, date }` |

**Used by:** `builder.ts`

---

## Build & Config (root)

---

### `scripts/build.ts`

**Purpose:** Build entry point. Creates `SiteBuilder`, runs the build, copies static assets.

**Dependencies:** `builder.ts`

**Exports:**
| Export | Type | Description |
|---|---|---|
| `build()` | async function | Run the full site build |
| `config` | object | Default `BuildConfig` |

---

### `rspack.config.ts`

**Purpose:** Rspack configuration for the browser-side bundle (HTMX + Tailwind CSS).

**Key settings:**
- Entry: `src/index.ts`
- Output: `dist/assets/main.js`, `dist/assets/main.css`
- TypeScript via `builtin:swc-loader`
- CSS via `postcss-loader` + `css-loader` + `CssExtractRspackPlugin`
- Dev server on port 3000 with `allowedHosts: 'all'` (ngrok support)

---

### `src/index.ts`

**Purpose:** Browser entry point. Imports HTMX and Tailwind CSS so they get bundled.

---

### `src/test/setup.ts`

**Purpose:** Vitest test environment setup (happy-dom configuration).

---

## Client (`src/client/`)

Browser-side modules bundled by Rspack. These run in the browser, not at build time.

---

### `cart-api.ts`

**Purpose:** Client-side shopping cart with IndexedDB persistence and optional AES-GCM encryption.

**Exports:**
| Export | Type | Description |
|---|---|---|
| `CartAPI` | class | CRUD operations on the cart. Dispatches `cart:updated` and `cart:ready` CustomEvents. |

**Behaviour:**
- HTTPS: encrypts cart data with AES-GCM via Web Crypto API
- HTTP (local dev): falls back to plain JSON
- Stored in IndexedDB (`flint-db` database, `kv` store)

---

### `cart-hydrate.ts`

**Purpose:** Cart UI hydration — renders items, totals, qty ±, remove, Stripe checkout.

**Behaviour:**
- Binds to `#flint-cart-toggle`, `#flint-cart-panel`, `#flint-cart-checkout`
- Reads product index from `/static/products/index.json`
- Calls `Stripe(publishableKey).redirectToCheckout()` on checkout

---

### `product-hydrate.ts`

**Purpose:** Binds Add-to-Cart buttons (`.flint-add-to-cart`) to the CartAPI.

**Behaviour:**
- Reads `data-id` and `data-qty` from button attributes
- Shows "✓ Added!" feedback after successful cart add

---

## Templates (`templates/`)

| File | Purpose |
|---|---|
| `default.html` | Standard page layout with navigation, content area, label footer |
| `blank.html` | Minimal shell — content and scripts only |
| `blog-post.html` | Article layout with byline header, narrower max-width |
| `shop.html` | E-commerce layout with cart sidebar |
| `agent-info.html` | Two-column layout with skill cards and sidebar |
| `product-demo.html` | Product detail page with product card |
| `component-demo.html` | Interactive component demo layout |

---

## Content (`content/`)

| File | Type | Parent | Order | Category |
|---|---|---|---|---|
| `index.md` | page | root | 1 | Home |
| `about.md` | page | root | 2 | — |
| `htmx.md` | page | root | 3 | — |
| `component.md` | page | root | 4 | — |
| `blog/index.md` | section | root | 4 | Blog |
| `blog/getting-started-with-htmx.md` | post | blog | 1 | Tutorials |
| `blog/tailwind-component-patterns.md` | post | blog | 2 | Tutorials |
| `blog/static-sites-are-back.md` | post | blog | 3 | Deep Dives |
| `blog/markdown-powered-workflows.md` | post | blog | 4 | Tips & Tricks |
| `shop/index.md` | section | root | 5 | Shop |
| `shop/blue-mug.md` | product | shop | 1 | Shop |
| `agent.md` | page | root | 6 | — |

---

## Agent Skills (`.github/skills/`)

| Skill | Description |
|---|---|
| `add-content` | Create/edit Flint content pages (Markdown + YAML frontmatter) |
| `add-template` | Create/edit Flint page templates (HTML with {{tag}} placeholders) |
| `add-component` | Create/edit Flint UI components (TypeScript classes extending Component) |
| `build-and-test` | Build the Flint static site and run tests |
| `create-skill` | Guide for creating effective skills following best practices |

## Dependency Graph

```
                    builder.ts
                   /    |      \
          template.ts   |   page-metadata.ts
          /       \     |        |
  markdown.ts  layout.ts|   frontmatter.ts
  /    |    \    |  \   navigation.ts
 /     |     \   |   \       |
htmx-  html-  marked |  label-  navigation/
markdown blocks      |  footer  ├── tree-menu.ts     ← hierarchy.ts
  .ts    .ts         |   .ts    ├── category-nav.ts  ← page-metadata.ts
                     |          └── label-cloud.ts   ← page-metadata.ts
           children-directive.ts
                  index-generator.ts ← page-metadata.ts

  tag-engine.ts
    ├── product.ts      ← ctx.frontmatter (data-driven)
    ├── skill-cards.ts  ← ctx.frontmatter (data-driven)
    ├── cart.ts
    ├── gadget.ts
    └── label-index.ts

  src/client/ (browser-side, bundled by Rspack)
    ├── cart-api.ts
    ├── cart-hydrate.ts  ← cart-api.ts
    └── product-hydrate.ts ← cart-api.ts
```
