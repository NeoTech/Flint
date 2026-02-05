 # Copilot Instructions

## Agent Rules

- **Never open a new terminal** if there is already an agent-controlled terminal open. Reuse the existing terminal for all commands.

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
├── src/
│   ├── components/    # Reusable UI components
│   │   ├── component.ts      # Base Component class
│   │   ├── layout.ts         # Page layout wrapper
│   │   └── navigation.ts     # Navigation component
│   ├── core/          # Core functionality
│   │   ├── frontmatter.ts    # YAML frontmatter parser
│   │   ├── markdown.ts       # Markdown compiler (marked)
│   │   ├── template.ts       # Template engine
│   │   └── builder.ts        # Site builder
│   ├── styles/        # CSS styles
│   └── test/          # Test utilities
├── scripts/           # Build scripts
├── dist/              # Output directory (generated)
└── static/            # Static assets
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
description: A description
author: John Doe
date: 2024-01-15
tags:
  - typescript
  - web
---

# Content Here

Regular **markdown** content.
```

### 5. HTMX Patterns

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
2. Add frontmatter with title
3. Run `npm run build`
4. Page appears in `dist/`

### Adding a Component

1. Create test file: `src/components/my-component.test.ts`
2. Write tests
3. Create implementation: `src/components/my-component.ts`
4. Export from appropriate index file
5. Run tests to verify

### Modifying the Build

1. Edit `scripts/build.ts`
2. Update tests if needed
3. Run `npm run build` to verify

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
