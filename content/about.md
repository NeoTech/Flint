---
title: About
Short-URI: about
Template: default
Type: page
Category: Documentation
Order: 2
Labels:
  - about
  - info
Parent: root
Author: System
Date: 2024-01-20
Description: About this static site generator
Keywords:
  - about
  - documentation
---

# About This Project

This static site generator demonstrates a modern approach to building websites:

## Technology Stack

| Technology | Purpose |
|------------|---------|
| TypeScript | Type-safe development |
| Rspack | Fast bundling with Rust |
| Markdown | Content authoring |
| HTMX | Dynamic interactions |
| Tailwind CSS | Styling |
| Bun test | Testing |

## Architecture

The project follows a **test-first, component-driven** architecture:

1. **Core Layer** - Frontmatter parsing, Markdown compilation
2. **Component Layer** - Reusable UI components
3. **Template Layer** - Page assembly
4. **Build Layer** - File processing and output

## Development Workflow

```
Write Test → Implement → Pass Test → Refactor → Commit
```

All features are developed test-first using Bun test.

## HTMX on a Static Site

Even without a backend API, HTMX works great on static sites by loading **HTML fragments**:

<button 
  class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
  hx-get="/fragments/about-greeting.html" 
  hx-target="#greeting"
  hx-swap="innerHTML">
  Say Hello
</button>

<div id="greeting" class="mt-4 p-4 bg-gray-100 rounded">
  Click the button to load a static HTML fragment!
</div>

The trick is pre-building small `.html` fragments at build time and serving them as static files. See the [HTMX Demo](/htmx) for more examples.

## Source Code

The source code is organized as follows:

- `src/core/` - Core functionality (parsing, compilation)
- `src/components/` - UI components
- `content/` - Markdown content files
- `scripts/` - Build scripts

[← Back to Home](/)
