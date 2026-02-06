---
title: Components
Short-URI: component
Template: component-demo
Type: page
Category: Documentation
Order: 4
Labels:
  - components
  - htmx
  - templates
Parent: root
Author: System
Date: 2024-01-25
Description: How components, templates, and Markdown work together
Keywords:
  - components
  - templates
  - markdown
  - htmx
---

# Components

Components are **TypeScript classes** that render HTML strings. They live in `src/components/` and extend the base `Component<T>` class.

## The Three Layers

A page in Flint is built from three layers, each with a clear responsibility:

| Layer | Where | What it does |
|-------|-------|-------------|
| **Markdown** | `content/*.md` | Provides the _content_ — the text you're reading right now |
| **Template** | `templates/*.html` | Defines the _page structure_ — where navigation, content, and footer go |
| **Component** | `src/components/*.ts` | Renders _interactive or reusable UI_ — the widget below is one |

### Markdown → Content

This file (`content/component.md`) is plain Markdown with YAML frontmatter. It gets compiled into HTML and injected into the template wherever `{{content}}` appears.

### Template → Structure

This page uses the `component-demo` template. That template looks roughly like this:

```html
{{head}}
<body>
    {{navigation}}
    <main>
        {{content}}        ← your Markdown lands here
        {{gadget}}         ← the Gadget component renders here
    </main>
    {{label-footer}}
    {{foot-scripts}}
</body>
```

Each `{{tag}}` is resolved by the tag engine at build time.

### Component → Interactive UI

The **Gadget** component below is a TypeScript class that returns an HTML string containing a colored box, a text element, and a `<script>` block. The button uses plain JavaScript to randomize the color and text — no server round-trip, no framework.

> **Try it!** Click the **Randomize** button below to see the component in action.
