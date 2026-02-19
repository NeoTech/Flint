---
name: add-component
description: Create or edit Flint UI components (TypeScript classes extending Component<T>). Use when building reusable server-rendered UI that appears across multiple pages via {{tag}} placeholders in templates.
---

# Add / Edit a Component

Create or modify reusable UI components in `src/components/`. Components are TypeScript classes that return HTML strings, invoked via `{{tag}}` placeholders in templates.

## Trigger Phrases

- "Create a [name] component"
- "Add a reusable [card / banner / alert / grid] UI element"
- "Build a [name] widget that appears on multiple pages"
- "I need a {{tag}} that renders [description]"
- "Add a [testimonial / pricing / FAQ] section component"
- "Make the [name] component show [new data]"
- "Extend the [existing component] to support [variant]"

## When to Use

- Building reusable UI that appears on multiple pages (nav, footer, card, alert)
- Rendering logic needs loops, conditionals, or computed values
- HTML output needs `escapeHtml()` for safety
- UI pattern needs unit testing

## When NOT to Use

- Page-specific content → use Markdown in `content/`
- Page-specific HTML → use `:::html` block in content
- Page layout structure → use a template
- Client-side interactivity → use `src/client/*.ts`

## Procedure

### 1. Write tests first

Create `src/components/<name>.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test';
import { MyComponent } from './<name>.js';

describe('MyComponent', () => {
  it('should render with required props', () => {
    const html = MyComponent.render({ /* props */ });
    expect(html).toContain('<expected-element');
  });

  it('should escape user content', () => {
    const html = MyComponent.render({
      text: '<script>alert("xss")</script>',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
```

### 2. Implement the component

Create `src/components/<name>.ts`:

```typescript
import { Component, type ComponentProps } from './component.js';

export interface MyComponentProps extends ComponentProps {
  // typed props here
}

export class MyComponent extends Component<MyComponentProps> {
  render(): string {
    return `<div class="...">
      ${this.escapeHtml(this.props.someField)}
    </div>`;
  }
}
```

**Rules:**
- Extend `Component<T>` with a typed props interface
- `render()` returns pure HTML string — no side effects
- `this.escapeHtml()` on every user-supplied string
- `this.classNames()` for conditional CSS classes
- Tailwind utility classes only — no `<style>` tags

### 3. Register the tag

Edit `src/templates/tag-engine.ts`:
- Add import: `import { MyComponent } from '../components/<name>.js';`
- Add case in `resolveTag` switch that reads **props from `ctx.frontmatter`**:
  ```typescript
  case 'my-tag': {
    const data = ctx.frontmatter['MyData'] as MyProps | undefined;
    if (!data) return '';
    return MyComponent.render(data);
  }
  ```
- Return `''` when frontmatter data is missing so `{{#if my-tag}}` works
- **Never hardcode props** — content files drive data into components via frontmatter

### 4. Extend TemplateContext if needed

If the component needs data not in `TemplateContext` (`src/templates/template-registry.ts`), add the field and populate it in `src/core/builder.ts`. Most components should read from `ctx.frontmatter` directly — only add TemplateContext fields for site-wide data (navigation, siteLabels).

### 5. Add component data to content frontmatter

The content file should provide structured YAML matching the component's props:

```yaml
---
MyData:
  fieldA: value
  fieldB: value
---
```

The tag-engine case reads this and passes it to the component. Content authors control the data; the component controls the presentation.

### 5. Use in templates

Add `{{my-tag}}` to `themes/default/templates/*.html` (or the active theme's template). Guard optional tags:
```html
{{#if my-tag}}{{my-tag}}{{/if}}
```

### 6. Run tests and build

```bash
bun run test:run
bun run build
```

## Checklist

- [ ] Tests in `src/components/<name>.test.ts` with XSS escape test
- [ ] Extends `Component<T>` with typed props interface
- [ ] `render()` is pure — no side effects
- [ ] All user text through `this.escapeHtml()`
- [ ] Tag registered in `tag-engine.ts` reading props from `ctx.frontmatter`
- [ ] No hardcoded data in tag-engine — content files drive data
- [ ] `TemplateContext` extended only if site-wide data needed
- [ ] Content file has structured YAML matching component props
- [ ] Tag placed in template with `{{#if}}` guard if optional
- [ ] `bun run test:run` passes
- [ ] `bun run build` succeeds

## References

- `references/base-class.md` — `Component<T>` API and inherited methods
- `references/tag-registration.md` — How to register tags in the engine
- `references/built-in-components.md` — All existing components for reference
