# Doc Catalog

Detailed inventory of every file in `docs/`. Use this to decide which doc to update after a code change.

---

## `architecture.md` (~260 lines)

**Purpose:** High-level system overview and design rationale.

**Sections:** System overview ASCII diagram, Three layers (Content / Template / Component), Data flow, Design decisions, Separation of concerns rules.

**Update when:**
- Adding a new layer or system module
- Changing the build pipeline stages
- Adding a new top-level directory (e.g. `plugins/`)

**Key content:** The ASCII box diagram showing `content/ → src/core/ → src/templates/ → dist/`, the three-layer responsibility table, hard boundaries table.

---

## `build-system.md` (~240 lines)

**Purpose:** Build pipeline, Rspack config, dev workflow, and all CLI commands.

**Sections:** Commands table, Site build pipeline (step-by-step), Rspack asset pipeline, Dev server config, CI/CD, Environment variables.

**Update when:**
- Adding or changing CLI commands in `package.json`
- Modifying `scripts/build.ts` or `SiteBuilder`
- Changing Rspack config (`rspack.config.ts`)
- Adding new environment variables

**Key content:** The numbered build pipeline steps, Rspack entry/output config, `BASE_PATH` and `SITE_URL` usage.

---

## `content-model.md` (~210 lines)

**Purpose:** All frontmatter fields, page types, hierarchy, and category vs labels.

**Sections:** Required fields, Recommended fields, Optional metadata, Product fields, Component data fields, Complete example, Page types table.

**Update when:**
- Adding a new frontmatter field to `parsePageMetadata()`
- Adding a new page type
- Adding a new component data field (e.g. `Hero:`, `Features:`)
- Changing field defaults or validation rules

**Key content:** Field tables with type/default/purpose, the component data fields section mapping YAML keys to `{{tag}}` components.

---

## `templates.md` (~180 lines)

**Purpose:** Template system, all `{{tag}}` placeholders, creating templates.

**Sections:** Location and listing, Selecting a template, Tag reference table, Conditionals (`{{#if}}`), Creating a template, Constraints.

**Update when:**
- Adding a new template to `templates/`
- Adding a new `{{tag}}` to the tag engine
- Changing how conditionals work
- Modifying the template rendering pipeline

**Key content:** Complete tag reference table (required, structural, data-driven, scalar, fragments), conditional syntax, template skeleton example.

---

## `components.md` (~390 lines)

**Purpose:** Component base class API, all built-in components with props and examples.

**Sections:** Base class (`Component<T>`), Inherited utilities, Built-in components (Layout, Data-driven, E-commerce, Interactive), Props interface tables, Usage in tag engine.

**Update when:**
- Adding a new component
- Changing a component's props interface
- Merging or splitting components
- Changing the base class API
- Adding new utility methods to `Component<T>`

**Key content:** Props interface tables for every component, the `escapeHtml`/`classNames` utility docs, tag-engine registration pattern.

---

## `markdown-pipeline.md` (~350 lines)

**Purpose:** The multi-stage Markdown preprocessing pipeline.

**Sections:** Pipeline overview diagram, Stage 0 (`:::children` expansion), Stage 1 (`:::html` extraction), Stage 2 (HTMX syntax), Stage 3 (marked compilation), Stage 4 (HTML block restoration), Placeholder mechanics.

**Update when:**
- Adding a new preprocessing stage
- Changing `:::children` options or template placeholders
- Changing HTMX syntax parsing
- Modifying `extractHtmlBlocks` / `restoreHtmlBlocks`
- Changing the `marked` configuration

**Key content:** The pipeline ASCII diagram, `:::children` directive options table, `:::html` block mechanics, HTMX attribute syntax.

---

## `ecommerce.md` (~240 lines)

**Purpose:** Stripe integration, cart, product pages, checkout flow.

**Sections:** Architecture overview, Key modules table, Product pages setup, Cart system, Stripe checkout, Test cards, CI/CD secrets.

**Update when:**
- Changing cart API or persistence
- Modifying product card rendering
- Changing Stripe integration
- Adding payment methods or currencies
- Modifying `cart-hydrate.ts` or `product-hydrate.ts`

**Key content:** Architecture ASCII diagram, the CartAPI ↔ Stripe flow, test card numbers, environment variable docs.

---

## `file-reference.md` (~580 lines)

**Purpose:** Every source file listed with exports, dependencies, and relationships.

**Sections:** Core (`src/core/`), Templates (`src/templates/`), Components (`src/components/`), Client (`src/client/`), Config files, Scripts.

**Update when:**
- Adding any new source file
- Renaming or removing a file
- Adding or changing exports
- Changing file dependencies

**Key content:** For each file: purpose, exports table (name, type, description), "Used by" and "Dependencies" lists.

---

## Cross-Reference Map

Which docs to update together:

| Change area | Primary doc | Also update |
|-------------|-------------|-------------|
| New component | `components.md` | `file-reference.md`, `templates.md` (if new tag) |
| New frontmatter field | `content-model.md` | `components.md` (if data-driven) |
| New template | `templates.md` | `architecture.md` (if new layout type) |
| New source file | `file-reference.md` | Relevant system doc |
| Pipeline change | `markdown-pipeline.md` | `architecture.md` |
| New command | `build-system.md` | — |
| E-commerce change | `ecommerce.md` | `components.md`, `file-reference.md` |
