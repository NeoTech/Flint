 # Copilot Instructions

## Agent Rules

- **Never open a new terminal** if there is already an agent-controlled terminal open. Reuse the existing terminal for all commands.
- **EADDRINUSE error**: If a command fails with `EADDRINUSE` (port already in use), simply inform the user that the server is already running. Do **not** attempt to kill the process or force-restart the server.

## Project Overview

This is a **TypeScript Static Site Generator** that compiles Markdown files into HTML pages using a component-driven architecture.

## Architecture

### Core Principles

1. **Test-First Development**: Always write tests before implementing features
2. **Component-Driven**: Build UI using TypeScript classes that extend `Component<T>`
3. **Markdown as Data**: Content lives in Markdown files with YAML frontmatter
4. **HTMX for Interactivity**: Use HTMX attributes for dynamic behavior without heavy JS frameworks
5. **Tailwind CSS for Styling**: Utility-first CSS via Tailwind

### Project Structure

```
├── content/           # Markdown content files
├── templates/         # HTML page templates ({{tag}} syntax)
│   ├── default.html         # Standard page layout
│   ├── blank.html           # Minimal shell
│   ├── blog-post.html       # Article layout with byline
│   ├── component-demo.html  # Interactive component demo
│   └── product-demo.html    # Product + cart demo page
├── src/
│   ├── components/    # Reusable UI components
│   │   ├── component.ts      # Base Component class
│   │   ├── navigation.ts     # Navigation component
│   │   ├── gadget.ts         # Interactive demo widget
│   │   ├── cart.ts           # Shopping cart placeholder (hydrated client-side)
│   │   └── product.ts        # Product card with Add-to-Cart button
│   ├── client/        # Client-side modules (bundled by Rspack)
│   │   ├── cart-api.ts       # CartAPI — IndexedDB + AES-GCM encrypted persistence
│   │   ├── cart-hydrate.ts   # Cart UI hydration, toggle, Stripe.js checkout
│   │   └── product-hydrate.ts # Binds .flint-add-to-cart buttons
│   ├── core/          # Core functionality
│   │   ├── frontmatter.ts    # YAML frontmatter parser
│   │   ├── markdown.ts       # Markdown compiler (marked)
│   │   ├── builder.ts        # Site builder
│   │   ├── db.ts             # IndexedDB promisified wrapper
│   │   └── crypto.ts         # Web Crypto AES-GCM helpers
│   ├── templates/     # Template engine
│   │   ├── tag-engine.ts     # {{tag}} resolver
│   │   ├── template-registry.ts # Registry + loader
│   │   ├── helpers.ts        # Shared HTML helpers
│   │   └── index.ts          # Exports
│   ├── styles/        # CSS styles
│   └── test/          # Test utilities
├── scripts/           # Build scripts
├── dist/              # Output directory (generated)
├── static/            # Static assets
│   └── products/      # Product fragments + metadata
│       ├── blue-mug.html     # HTMX product fragment
│       ├── blue-mug.json     # Product metadata
│       └── index.json        # Consolidated product index
└── docs/              # Project documentation
    └── ecommerce.md   # E-commerce architecture docs
```

## Development Workflow

### 1. Writing Tests First

Every feature must have tests before implementation:

```typescript
// src/core/feature.test.ts
import { describe, it, expect } from 'vitest';

describe('Feature', () => {
  it('should do something', () => {
    // Test here
  });
});
```

Run tests: `npm run test:run`
Watch mode: `npm run test`

### 2. Creating Components

Extend the base `Component` class:

```typescript
import { Component, type ComponentProps } from './component.js';

export interface MyComponentProps extends ComponentProps {
  title: string;
}

export class MyComponent extends Component<MyComponentProps> {
  render(): string {
    return `
      <div class="my-component">
        <h2>${this.props.title}</h2>
      </div>
    `;
  }
}
```

### 3. Component Best Practices

- Use `this.classNames()` for conditional classes
- Use `this.escapeHtml()` for user-generated content
- Keep components pure (no side effects)
- Return HTML strings from `render()`

### 4. Working with Markdown

Content files use YAML frontmatter:

```markdown
---
title: My Page
Template: default
Description: A description
Author: John Doe
Date: 2024-01-15
Labels:
  - typescript
  - web
---

# Content Here

Regular **markdown** content.
```

### 5. Creating Templates

Templates are plain HTML files in `templates/` using `{{tag}}` placeholders:

```html
{{head}}
<body class="bg-white">
    {{#if navigation}}{{navigation}}{{/if}}
    <main>{{content}}</main>
    {{#if label-footer}}{{label-footer}}{{/if}}
    {{foot-scripts}}
</body>
</html>
```

Available tags: `{{head}}`, `{{navigation}}`, `{{content}}`, `{{label-footer}}`, `{{foot-scripts}}`, `{{blog-header}}`, `{{title}}`, `{{description}}`, `{{author}}`, `{{category}}`, `{{formatted-date}}`, `{{reading-time}}`, `{{category-pill}}`, `{{label-badges}}`, `{{basePath}}`, `{{keywords}}`, `{{gadget}}`, `{{cart}}`, `{{product}}`.

Conditionals: `{{#if tagName}}...{{/if}}` renders block only when tag is non-empty.

To add a new template: create `templates/<name>.html`, then set `Template: <name>` in content frontmatter.

### 6. HTMX Patterns

Use HTMX for dynamic interactions:

```html
<!-- Load content dynamically -->
<button hx-get="/api/content" hx-target="#result">Load</button>
<div id="result"></div>

<!-- Form submission -->
<form hx-post="/submit" hx-target="#response">
  <input type="text" name="message">
  <button type="submit">Send</button>
</form>
```

## Build System

### Commands

- `npm run build` - Build the static site
- `npm run dev` - Start development server with hot reload
- `npm run test` - Run tests in watch mode
- `npm run test:run` - Run tests once
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking

### Rspack Configuration

- Uses `builtin:swc-loader` for TypeScript compilation
- CSS processed with PostCSS + Tailwind
- HTMX bundled for offline capability
- Development server on port 8080

## Code Style

### TypeScript

- Enable `strict` mode
- Use explicit return types on public methods
- Prefer `interface` over `type` for object shapes
- Use `readonly` where appropriate
- Avoid `any` - use `unknown` with type guards

### CSS/Tailwind

- Use Tailwind utility classes
- Custom styles in `src/styles/main.css`
- Component-specific styles via `@apply`
- Responsive design with Tailwind breakpoints

### Testing

- Use Vitest with happy-dom environment
- Test files: `*.test.ts` alongside source files
- Aim for high coverage on core functionality
- Use descriptive test names

## Common Tasks

### Adding a New Page

1. Create Markdown file in `content/`
2. Add frontmatter with title and `Template` field
3. Run `npm run build`
4. Page appears in `dist/`

### Adding a Template

1. Create `templates/<name>.html` using `{{tag}}` placeholders
2. Set `Template: <name>` in content frontmatter
3. Run `npm run build` — no TypeScript needed

### Adding a Component

1. Create test file: `src/components/my-component.test.ts`
2. Write tests
3. Create implementation: `src/components/my-component.ts`
4. Export from appropriate index file
5. To use in templates, add a new tag to `src/templates/tag-engine.ts`
6. Run tests to verify

### Modifying the Build

1. Edit `scripts/build.ts`
2. Update tests if needed
3. Run `npm run build` to verify

### Adding a Product

1. Create `static/products/<slug>.html` — HTMX fragment with `data-product-id`, `data-stripe-price-id`, and a `.flint-add-to-cart` button
2. Create `static/products/<slug>.json` — metadata (id, title, price_cents, currency, stripe_price_id, description, fragment)
3. Update `static/products/index.json` with the new product entry
4. Reference in shop content using `:::html` blocks with `hx-get="/products/<slug>.html"`
5. Run `npm run build` to verify

### E-Commerce Architecture

The cart system is **entirely client-side** — no server backend required:

- **Cart component** (`src/components/cart.ts`): Server-rendered placeholder HTML, hydrated client-side
- **Product component** (`src/components/product.ts`): Server-rendered product card with `.flint-add-to-cart` buttons
- **CartAPI** (`src/client/cart-api.ts`): Client-side IndexedDB + AES-GCM encrypted cart persistence
- **Cart hydration** (`src/client/cart-hydrate.ts`): Wires toggle, renders items, handles Stripe.js `redirectToCheckout`
- **Product hydration** (`src/client/product-hydrate.ts`): Binds Add-to-Cart buttons to CartAPI
- **Product fragments** (`static/products/`): Static HTML/JSON loaded via HTMX
- **Stripe checkout**: Client-only via `Stripe(publishableKey).redirectToCheckout({ lineItems })` — no server session needed

Config is injected via `window.__FLINT_CONFIG__` in the bundled `src/index.ts`.

## Dependencies

### Production
- `marked` - Markdown parsing
- `gray-matter` - Frontmatter parsing
- `htmx.org` - HTMX library

### Development
- `vitest` - Testing framework
- `@rspack/cli` - Build tool
- `tailwindcss` - CSS framework
- `typescript` - Type checking
- `eslint` - Linting

## Notes

- Always run tests before committing
- Keep components small and focused
- Use semantic HTML
- Ensure accessibility (ARIA labels, etc.)
- Test on different screen sizes
