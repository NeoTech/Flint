---
title: Components
Short-URI: component
Template: component-demo
Type: page
Category: Documentation
Order: 4
Labels:
  - components
  - htmx
  - templates
Parent: root
Author: System
Date: 2024-01-25
Description: How components, templates, and Markdown work together
Keywords:
  - components
  - templates
  - markdown
  - htmx
---

# Components

Components are **TypeScript classes** that render HTML strings. They live in `src/components/` and extend the base `Component<T>` class.

## The Three Layers

A page in Flint Static is built from three layers, each with a clear responsibility:

| Layer | Where | What it does |
|-------|-------|-------------|
| **Markdown** | `content/*.md` | Provides the _content_ — the text you're reading right now |
| **Template** | `templates/*.html` | Defines the _page structure_ — where navigation, content, and footer go |
| **Component** | `src/components/*.ts` | Renders _reusable UI_ — typed, tested, and data-driven |

### Markdown → Content

This file (`content/component.md`) is plain Markdown with YAML frontmatter. It gets compiled into HTML and injected into the template wherever `{{content}}` appears.

### Template → Structure

This page uses the `component-demo` template, which places the Gadget component after the Markdown content:

```html
{{head}}
<body>
    {{#if navigation}}{{navigation}}{{/if}}
    <main>
        {{content}}        ← your Markdown lands here
        {{gadget}}         ← the Gadget component renders here
    </main>
    {{#if label-footer}}{{label-footer}}{{/if}}
    {{foot-scripts}}
</body>
```

Each `{{tag}}` is resolved by the **tag engine** at build time. The tag engine is the bridge between templates and components — it maps tag names to component classes and passes data from the page's frontmatter as typed props.

### Component → Reusable UI

Components are classes that extend `Component<T>` where `T` is a typed props interface. Every component:

- Has a `render()` method that returns a pure HTML string
- Receives data through typed **props** — never hardcoded
- Escapes all user-supplied text with `this.escapeHtml()` to prevent XSS
- Uses Tailwind utility classes for styling — no `<style>` tags
- Has co-located unit tests in a `*.test.ts` file

---

## Built-in Components

Flint Static ships with these reusable components, each registered as a `{{tag}}` in the tag engine:

### Site-wide (always available)

| Component | Tag | Data source | Purpose |
|-----------|-----|-------------|---------|
| Navigation | `{{navigation}}` | Site hierarchy | Responsive nav bar with hamburger menu |
| LabelFooter | `{{label-footer}}` | All site labels | Footer with clickable label cloud |

These read from `TemplateContext` fields that the build system populates automatically — you don't need to add anything to frontmatter.

### Data-driven (from frontmatter)

| Component | Tag | Frontmatter key | Purpose |
|-----------|-----|-----------------|---------|
| CtaSection | `{{hero}}` | `Hero:` | Full-width gradient hero with heading and CTA buttons |
| CtaSection | `{{call-to-action}}` | `CTA:` | Conversion banner (same component, `banner` variant) |
| CardGrid | `{{feature-grid}}` | `Features:` | Responsive grid of icon cards |
| CardGrid | `{{showcase-grid}}` | `Showcase:` | Linked card grid (same component, cards with `href`) |
| StatsBar | `{{stats-bar}}` | `Stats:` | Dark row of headline statistics |
| SkillCards | `{{skill-cards}}` | `Skills:` | Grid of skill info cards with tag badges |
| Product | `{{product}}` | Product fields | Product card or detail view |

Notice that **CtaSection** and **CardGrid** each serve two tags. They're generic components with optional props that change their behaviour:

- `CtaSection` uses a `variant` prop — `'hero'` renders an `<h1>` with decorative blur circles; `'banner'` renders a simpler `<h2>`.
- `CardGrid` items with an `href` become clickable links with hover effects; items with a `color` get a coloured icon background.

### Standalone (no frontmatter)

| Component | Tag | Purpose |
|-----------|-----|---------|
| Gadget | `{{gadget}}` | Demo widget (the one below this text!) |
| Cart | `{{cart}}` | Shopping cart shell (hydrated client-side) |

---

## How the Tag Engine Connects Everything

The tag engine (`src/templates/tag-engine.ts`) maps tag names to components via a `resolveTag('feature-grid', ctx)` call. Components **self-register** by exporting a `tagDefs` array from their own file — the `TagRegistry.discover()` scans `src/components/` automatically and picks them up without any central switch statement.

When the build system encounters `{{feature-grid}}` in a template, it:

1. Reads the `Features:` object from `ctx.frontmatter`
2. Passes it as typed props to `CardGrid.render()`
3. Returns the HTML string (or `''` if the data is missing)

```typescript
// src/components/card-grid.ts — self-registration via tagDefs:
export const tagDefs: TagDef[] = [
  {
    label: 'feature-grid',
    icon: '🧩',
    description: 'Icon card grid from Features: frontmatter',
    resolve: (ctx) => {
      const fg = ctx.frontmatter['Features'] as CardGridProps | undefined;
      if (!fg?.items?.length) return '';
      return CardGrid.render(fg);
    },
  },
];
```

Returning `''` when data is missing makes `{{#if feature-grid}}` conditionals work — the template can guard optional sections so pages without that frontmatter data render cleanly.

### Data Flow

```
content/index.md          templates/landing.html       src/components/card-grid.ts
┌──────────────┐        ┌─────────────────────┐       ┌─────────────────────┐
│ Features:    │        │{{#if feature-grid}} │       │ CardGrid.render()   │
│   heading:…  │──────> │  {{feature-grid}}   │────>  │  <section>…         │
│   items:     │ YAML   │ {{/if}}             │  tag  │   <div class=grid>  │
│     - icon…  │        └─────────────────────┘ engine│    <div>card</div>  |
│     - icon…  │                                      │   </div>            │
└──────────────┘                                      └─────────────────────┘
```

Content authors control **what** data appears. Components control **how** it looks. Templates control **where** it goes. No layer reaches into another.

---

## Example: The Gadget Component

The **Gadget** below is a simple demo component. It shows how even a component with client-side interactivity is still rendered server-side as a static HTML string.

### Integration Steps

**1. The component** (`src/components/gadget.ts`) extends `Component<GadgetProps>` and renders a coloured box with a randomize button. The client-side JavaScript is embedded in the HTML output as an inline `<script>`:

```typescript
export class Gadget extends Component<GadgetProps> {
  render(): string {
    return `<div class="gadget-wrapper">
      <div id="gadget-box" style="background-color: #6366f1;">
        <p id="gadget-text">${this.escapeHtml(this.props.initialText ?? 'Click the button!')}</p>
        <button onclick="randomizeGadget()">🎲 Randomize</button>
      </div>
      <script>function randomizeGadget() { /* ... */ }</script>
    </div>`;
  }
}
```

**2. The tag engine** registers it with no frontmatter dependency — Gadget has no data props, so it renders the same on every page:

```typescript
case 'gadget':
  return Gadget.render({});
```

**3. The template** (`templates/component-demo.html`) places it after the content:

```html
<main>
    {{content}}
    <section class="mt-10">{{gadget}}</section>
</main>
```

**4. This content file** (`content/component.md`) selects the template via `Template: component-demo`. The Markdown body becomes `{{content}}`, and the Gadget renders below it.

> **Try it!** Click the **Randomize** button below to see the component in action.
