# Components

Flint uses a component-driven architecture where UI is built from TypeScript classes that return HTML strings. No virtual DOM, no hydration, no runtime — just pure string concatenation at build time.

## Base Class: `Component<T>`

Every component extends `Component<T>` where `T` is its props interface.

```typescript
import { Component, type ComponentProps } from './component.js';

// 1. Define props (must extend ComponentProps)
interface CardProps extends ComponentProps {
  title: string;
  body: string;
  variant?: 'default' | 'highlight';
}

// 2. Extend Component<T>
class Card extends Component<CardProps> {
  // 3. Implement render()
  render(): string {
    const classes = this.classNames(
      'rounded-lg border p-6',
      this.props.variant === 'highlight' && 'border-blue-500 bg-blue-50'
    );

    return `
      <div class="${classes}">
        <h3 class="text-lg font-semibold">${this.escapeHtml(this.props.title)}</h3>
        <p class="mt-2 text-gray-600">${this.escapeHtml(this.props.body)}</p>
      </div>
    `;
  }
}
```

### Inherited Utilities

| Method | Purpose |
|---|---|
| `this.props` | Readonly access to typed props |
| `this.escapeHtml(text)` | Escape `<`, `>`, `&`, `"`, `'` to prevent XSS. **Always use for user content.** |
| `this.classNames(...args)` | Join CSS classes, filtering out `false`, `undefined`, and `null` values. Ideal for conditional classes. |
| `Component.render(props)` | Static shortcut — creates an instance and calls `render()` in one line. |

### Usage Patterns

```typescript
// Instance method
const card = new Card({ title: 'Hello', body: 'World' });
const html = card.render();

// Static shortcut (preferred)
const html = Card.render({ title: 'Hello', body: 'World' });
```

## Built-in Components

### Layout

**File:** `src/components/layout.ts`

The outermost wrapper. Every page is rendered inside a `Layout`. It provides the full HTML document: `<!DOCTYPE html>`, `<head>` with meta tags, `<body>` with the app container, and script/style includes.

```typescript
interface LayoutProps extends ComponentProps {
  title: string;           // <title> tag
  description?: string;    // <meta name="description">
  children: string;        // Page body HTML
  lang?: string;           // html lang attribute (default: 'en')
  cssFiles?: string[];     // Additional <link> tags
  jsFiles?: string[];      // Additional <script> tags
}
```

The Layout always includes:
- `/assets/main.css` — Tailwind CSS (built by Rspack)
- `/assets/main.js` — HTMX bundle (built by Rspack)

### Navigation

**File:** `src/components/navigation.ts`

The top navigation bar. Rendered horizontally with active state highlighting and optional HTMX boost.

```typescript
interface NavItem {
  label: string;       // Display text
  href: string;        // Link URL
  active?: boolean;    // Currently active page?
  hxBoost?: boolean;   // Enable HTMX boosting?
  order?: number;      // Sort position
}

interface NavigationProps extends ComponentProps {
  items: NavItem[];
}
```

**Behaviour:**
- Active item gets `text-blue-600 bg-blue-50` and `aria-current="page"`
- Inactive items have hover transitions
- Styled as a white bar with bottom border

### TreeMenu

**File:** `src/components/navigation/tree-menu.ts`

A collapsible hierarchical sidebar menu built from the page tree.

```typescript
interface TreeMenuProps extends ComponentProps {
  tree: PageNode | null;   // Root of the page hierarchy
  currentUri: string;      // Short-URI of the current page
  useHtmx?: boolean;       // Enable hx-boost (default: true)
}
```

**Behaviour:**
- Renders nested `<div>` elements with indentation
- Active node: blue left border + blue background
- Section nodes: bold text
- Nodes on the path to the current page are expanded; others are collapsed
- HTMX boost for instant page transitions

### CategoryNav

**File:** `src/components/navigation/category-nav.ts`

Pill-shaped category filter buttons with post counts.

```typescript
interface CategoryNavProps extends ComponentProps {
  pages: PageMetadata[];        // All pages to aggregate categories from
  currentCategory: string | null; // Currently selected category
  useHtmx?: boolean;
}
```

**Behaviour:**
- Counts pages per category automatically
- Sorts categories alphabetically
- Active category: blue pill. Inactive: grey with hover effect
- Generates slug-based URLs: `Tutorials` → `/category/tutorials`

### LabelCloud

**File:** `src/components/navigation/label-cloud.ts`

A weighted tag cloud where label size scales with frequency.

```typescript
interface LabelCloudProps extends ComponentProps {
  pages: PageMetadata[];      // All pages to aggregate labels from
  selectedLabels: string[];   // Currently active labels
  useHtmx?: boolean;
}
```

**Behaviour:**
- Counts pages per label, sorts by count descending
- Size classes based on frequency ratio:
  - `> 75%` → `text-lg font-medium`
  - `> 50%` → `text-base`
  - `> 25%` → `text-sm`
  - `≤ 25%` → `text-xs`
- Selected labels: blue pill. Unselected: grey
- Generates slug-based URLs: `htmx` → `/label/htmx`

### LabelFooter

**File:** `src/components/label-footer.ts`

A site-wide footer that displays every label found across all content files. Automatically rendered on every page by the Layout component — no per-page configuration needed.

```typescript
interface LabelFooterProps extends ComponentProps {
  labels: string[];  // All labels across the entire site
}
```

**Behaviour:**
- Deduplicates and sorts labels alphabetically
- Cycles through 8 colour pairs (blue, green, purple, amber, rose, teal, indigo, orange) for visual variety
- Returns empty string when no labels exist
- Rendered inside `<footer>` with a top border to separate from page content

**Data flow:** Builder → `collectSiteLabels()` → `PageData.siteLabels` → Layout → LabelFooter

### Product

**File:** `src/components/product.ts`

A product card with image, title, price, description, and an Add-to-Cart button. **Data-driven** — the tag engine reads `Short-URI`, `PriceCents`, `Description`, and `Image` from the page's frontmatter and maps them to props.

```typescript
interface ProductProps extends ComponentProps {
  id: string;            // Product slug for cart operations
  title: string;         // Display title
  price?: string;        // Formatted price string, e.g. '$14.99'
  image?: string;        // Image URL (omit for 📦 placeholder)
  description?: string;  // Short product description
}
```

**Behaviour:**
- Renders a horizontal card layout (image left, details right)
- Add-to-Cart button has `.flint-add-to-cart` class + `data-id` and `data-qty` attributes
- Client-side `product-hydrate.ts` binds click handlers for cart integration
- Returns empty string when `Short-URI` is missing (tag engine guard)

### Cart

**File:** `src/components/cart.ts`

A lightweight cart widget placeholder. Server-renders the structural HTML (toggle button, panel, items list, totals, checkout button). All interactive behaviour is handled by the client-side `cart-hydrate.ts` module.

```typescript
interface CartProps extends ComponentProps {
  initialCount?: number;  // Server-side hint (hydrated client-side)
}
```

**Behaviour:**
- Toggle button shows item count (`#flint-cart-count`)
- Panel with items list, total, and Checkout button
- Panel is `hidden` by default, toggled by client-side JS
- Checkout button triggers Stripe `redirectToCheckout`

### Gadget

**File:** `src/components/gadget.ts`

A demonstration widget that randomizes its background colour and text on button click. Shows how a component can embed interactive behaviour while still being server-rendered.

```typescript
interface GadgetProps extends ComponentProps {
  initialText?: string;  // Override the initial display text
}
```

**Behaviour:**
- Renders a coloured box with text and a 🎲 Randomize button
- Inline `<script>` with a `randomizeGadget()` function (no HTMX needed)
- Cycles through 12 colours and 10 phrases

### SkillCards

**File:** `src/components/skill-cards.ts`

A responsive grid of skill info cards with coloured badges. **Data-driven** — the tag engine reads a `Skills` YAML array from the page's frontmatter and passes it as props.

```typescript
type SkillColor = 'green' | 'blue' | 'purple' | 'amber' | 'gray' | 'rose' | 'teal';

interface SkillInfo {
  name: string;        // Skill directory name
  icon: string;        // Emoji icon
  description: string; // Short description
  tags: string[];      // Keyword badges
  color: SkillColor;   // Badge colour theme
}

interface SkillCardsProps extends ComponentProps {
  skills: SkillInfo[];
}
```

**Behaviour:**
- Renders a 1→2 column responsive grid
- Each card: icon + name header, description, coloured tag badges
- Last card spans full width when the total is odd
- Returns empty string when `Skills` is missing/empty (tag engine guard)

### LabelIndex

**File:** `src/components/label-index.ts`

Renders a full page listing all pages that share a particular label. Generated at build time for labels that appear on multiple pages.

```typescript
interface LabelIndexPageEntry {
  url: string;
  title: string;
  description: string;
  category: string;
  date: string | null;
}

interface LabelIndexProps extends ComponentProps {
  label: string;
  pages: LabelIndexPageEntry[];
}
```

**Behaviour:**
- Header with label name and page count
- Cards with title link, date/category meta, description
- Shows "No pages found" message when `pages` is empty

## Data-Driven Components

Some components receive their props from **page frontmatter** rather than hardcoded values. The tag engine reads YAML fields from `ctx.frontmatter` and maps them to typed component props.

| Tag | Frontmatter Fields | Component |
|-----|-------------------|-----------|
| `{{product}}` | `Short-URI`, `PriceCents`, `Description`, `Image` | `Product` |
| `{{skill-cards}}` | `Skills` (array of objects) | `SkillCards` |

**How it works:**

1. Content author adds structured YAML to the page's frontmatter
2. The builder passes `FrontmatterData` through to `TemplateContext.frontmatter`
3. The tag engine's `resolveTag()` reads from `ctx.frontmatter` and maps to component props
4. The component renders with the typed data

**Key rule:** Never hardcode content data in the tag engine. If a component needs data, it should come from the content file's frontmatter.

## Creating a New Component

### 1. Write the test first

```typescript
// src/components/alert.test.ts
import { describe, it, expect } from 'vitest';
import { Alert } from './alert.js';

describe('Alert', () => {
  it('should render with message', () => {
    const html = Alert.render({ message: 'Hello' });
    expect(html).toContain('Hello');
    expect(html).toContain('role="alert"');
  });

  it('should render warning variant', () => {
    const html = Alert.render({ message: 'Careful', variant: 'warning' });
    expect(html).toContain('bg-yellow-50');
  });

  it('should escape HTML in message', () => {
    const html = Alert.render({ message: '<script>alert("xss")</script>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
```

### 2. Implement the component

```typescript
// src/components/alert.ts
import { Component, type ComponentProps } from './component.js';

export interface AlertProps extends ComponentProps {
  message: string;
  variant?: 'info' | 'warning' | 'error';
}

export class Alert extends Component<AlertProps> {
  render(): string {
    const { message, variant = 'info' } = this.props;

    const variantClasses = {
      info: 'bg-blue-50 text-blue-800 border-blue-200',
      warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
      error: 'bg-red-50 text-red-800 border-red-200',
    };

    return `
      <div class="rounded-lg border p-4 ${variantClasses[variant]}" role="alert">
        <p>${this.escapeHtml(message)}</p>
      </div>
    `;
  }
}
```

### 3. Run tests

```bash
npm run test:run
```

## Principles

1. **Pure functions** — Components have no side effects. Given the same props, they always return the same HTML string.
2. **Escape user content** — Always use `this.escapeHtml()` for any value that could contain user input.
3. **Tailwind classes** — Use utility classes directly in the template. Use `this.classNames()` for conditional classes.
4. **Semantic HTML** — Use `<nav>`, `<main>`, `<article>`, `role`, `aria-current`, `aria-label`.
5. **Small and focused** — One component per file. If a component grows beyond ~80 lines, split it.
