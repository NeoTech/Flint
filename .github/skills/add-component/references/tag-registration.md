# Tag Registration

How to wire a component into the template engine so it can be used as `{{tag}}` in templates.

## Step-by-step

### 1. Import the component

At the top of `src/templates/tag-engine.ts`:

```typescript
import { MyComponent } from '../components/my-component.js';
```

### 2. Add a case in `resolveTag`

In the `resolveTag` function's switch statement, add a case:

```typescript
case 'my-tag':
  return MyComponent.render({
    // Map TemplateContext fields to component props
    items: ctx.navigation,
    title: ctx.title,
  });
```

### 3. Handle empty/optional state

If the tag can produce empty output, return `''` so `{{#if my-tag}}` works:

```typescript
case 'my-tag':
  return ctx.someData.length > 0
    ? MyComponent.render({ items: ctx.someData })
    : '';
```

### 4. Extend TemplateContext if needed

If the component needs data not already in `TemplateContext`, add it to the interface in `src/templates/template-registry.ts`:

```typescript
export interface TemplateContext {
  // ... existing fields ...
  /** New field for my component */
  myData: MyDataType[];
}
```

Then populate it in `src/core/builder.ts` where context is assembled for each page.

## Existing tag registrations

The `resolveTag` switch in `tag-engine.ts` handles:
- `head`, `content`, `foot-scripts` — structural (from helpers)
- `navigation` — `Navigation.render({ items: ctx.navigation })`
- `label-footer` — `LabelFooter.render({ labels: ctx.siteLabels })`
- `blog-header` — inline HTML assembly (reading time, byline, category, labels)
- `gadget` — `Gadget.render({})`
- `cart` — `Cart.render({})`
- `product` — `Product.render({ id, title, price, description })`
- Scalar tags: `title`, `description`, `keywords`, `author`, `category`, `basePath`, `formatted-date`, `reading-time`
- Fragment tags: `category-pill`, `label-badges`
- Unknown tags pass through as `{{tagName}}`
