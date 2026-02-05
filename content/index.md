---
title: Home
Short-URI: home
Type: page
Category: Home
Order: 1
Labels:
  - welcome
  - getting-started
Parent: root
Author: System
Date: 2024-01-15
Description: A modern static site built with TypeScript, Markdown, and HTMX
Keywords:
  - static-site
  - typescript
  - markdown
  - htmx
---

# Welcome to Your Static Site

This is a **modern static site generator** built with:

- **TypeScript** - Type-safe code
- **Markdown** - Content-focused authoring
- **HTMX** - Dynamic interactions without heavy frameworks
- **Tailwind CSS** - Utility-first styling

## Features

### Component-Driven Architecture

Build reusable components in TypeScript:

```typescript
class MyComponent extends Component<Props> {
  render(): string {
    return `<div class="my-class">${this.props.title}</div>`;
  }
}
```

### Markdown with Frontmatter

Write content in Markdown with YAML frontmatter:

```markdown
---
title: My Page
description: Page description
---

# Content Here
```

### HTMX Integration

Add dynamic behavior with HTMX attributes:

```html
<button hx-get="/api/data" hx-target="#result">
  Load Data
</button>
```

## Getting Started

1. Edit this file in `content/index.md`
2. Run `npm run dev` to start the dev server
3. Run `npm run build` to generate the static site

## Navigation

- [About](/about) - Learn more about this project
