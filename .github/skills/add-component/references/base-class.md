# Component Base Class

## `Component<T>`

Abstract base class in `src/components/component.ts`. All components extend it.

```typescript
import { Component, type ComponentProps } from './component.js';
```

### `ComponentProps` Interface

Base props available to all components:

```typescript
interface ComponentProps {
  id?: string;
  className?: string;
}
```

Extend this for component-specific props:

```typescript
export interface AlertProps extends ComponentProps {
  message: string;
  variant?: 'info' | 'warning' | 'error';
}
```

### Constructor

```typescript
constructor(props: T)
```

Props are stored on `this.props` (readonly).

### `render(): string` (abstract)

Must be implemented by every component. Returns an HTML string.

```typescript
render(): string {
  return `<div class="${this.classNames('base', this.props.className)}">
    ${this.escapeHtml(this.props.message)}
  </div>`;
}
```

### `escapeHtml(text: string): string` (protected)

Escapes HTML entities (`&`, `<`, `>`, `"`, `'`). **Always use on user-supplied text** to prevent XSS.

```typescript
this.escapeHtml('<script>') // → '&lt;script&gt;'
```

### `classNames(...classes): string` (protected)

Joins CSS class names, filtering out falsy values.

```typescript
this.classNames('base', isActive && 'active', undefined)
// → 'base active' (if isActive is true)
// → 'base' (if isActive is false)
```

### `static render<P>(props: P): string`

Static convenience method — creates instance and renders in one call.

```typescript
const html = Navigation.render({ items: [...] });
// Equivalent to: new Navigation({ items: [...] }).render()
```

This is the standard way to invoke components from `tag-engine.ts`.
