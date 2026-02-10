# Tag Registration

How to wire a component into the template engine so it can be used as `{{tag}}` in templates.

## Step-by-step

### 1. Import the component

At the top of `src/templates/tag-engine.ts`:

```typescript
import { MyComponent } from '../components/my-component.js';
```

### 2. Add a case in `resolveTag`

In the `resolveTag` function's switch statement, add a case that **reads props from `ctx.frontmatter`**:

```typescript
case 'my-tag': {
  const data = ctx.frontmatter['MyData'] as MyDataType | undefined;
  if (!data) return '';
  return MyComponent.render({
    items: data.items,
    title: ctx.title,
  });
}
```

**Rule:** Never hardcode component props in the switch case. Content files provide the data via frontmatter; the tag engine maps it to component props.

### 3. Handle empty/optional state

If the tag can produce empty output, return `''` so `{{#if my-tag}}` works:

```typescript
case 'my-tag': {
  const items = ctx.frontmatter['MyItems'] as MyItem[] | undefined;
  return items && items.length > 0
    ? MyComponent.render({ items })
    : '';
}
```

### 4. Extend TemplateContext only for site-wide data

Most components should read from `ctx.frontmatter` (which already carries all YAML fields). Only add new `TemplateContext` fields for **site-wide** data that isn't page-specific:

```typescript
export interface TemplateContext {
  // ... existing fields ...
  /** Site-wide data populated by builder for all pages */
  myGlobalData: MyDataType[];
}
```

Then populate it in `src/core/builder.ts` where context is assembled for each page.

For **page-specific** data, use `ctx.frontmatter['FieldName']` — no TemplateContext changes needed.

## Existing tag registrations

The `resolveTag` switch in `tag-engine.ts` handles:
- `head`, `content`, `foot-scripts` — structural (from helpers)
- `navigation` — `Navigation.render({ items: ctx.navigation })` — site-wide data
- `label-footer` — `LabelFooter.render({ labels: ctx.siteLabels })` — site-wide data
- `blog-header` — inline HTML assembly (reading time, byline, category, labels)
- `gadget` — `Gadget.render({})` — no data needed
- `cart` — `Cart.render({})` — no data needed
- `product` — reads `Short-URI`, `PriceCents`, `Description`, `Image` from `ctx.frontmatter`
- `skill-cards` — reads `Skills` array from `ctx.frontmatter`
- Scalar tags: `title`, `description`, `keywords`, `author`, `category`, `basePath`, `formatted-date`, `reading-time`
- Fragment tags: `category-pill`, `label-badges`
- Unknown tags pass through as `{{tagName}}`

## Data flow

```
content/*.md frontmatter → FrontmatterData → builder → TemplateContext.frontmatter → resolveTag → Component.render(props)
```

`TemplateContext.frontmatter` is the full `FrontmatterData` dictionary (`{ [key: string]: unknown }`). Every YAML key from a content file is available to tag-engine switch cases.
