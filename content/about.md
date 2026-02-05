---
title: About
Short-URI: about
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
| Vitest | Testing |

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

All features are developed test-first using Vitest.

## HTMX Examples

This page includes HTMX for dynamic content loading:

<button 
  class="btn btn-primary"
  hx-get="/api/hello" 
  hx-target="#greeting"
  hx-swap="innerHTML">
  Say Hello
</button>

<div id="greeting" class="mt-4 p-4 bg-gray-100 rounded">
  Click the button to load content dynamically!
</div>

## Source Code

The source code is organized as follows:

- `src/core/` - Core functionality (parsing, compilation)
- `src/components/` - UI components
- `content/` - Markdown content files
- `scripts/` - Build scripts

[← Back to Home](/)
