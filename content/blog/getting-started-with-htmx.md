---
title: Getting Started with HTMX
Short-URI: getting-started-htmx
Type: post
Category: Tutorials
Labels:
  - htmx
  - beginner
  - javascript
Parent: blog
Order: 1
Author: Jane Developer
Date: 2026-02-01
Description: Learn how to add dynamic behavior to your static site using HTMX attributes
Keywords:
  - htmx
  - tutorial
  - beginner
  - dynamic html
---

# Getting Started with HTMX

HTMX lets you access modern browser features directly from HTML, without writing JavaScript. It extends HTML as a hypertext by adding attributes that trigger HTTP requests and swap content on the page.

## Why HTMX?

Traditional approaches to adding interactivity require heavy JavaScript frameworks. HTMX takes a different path:

- **No build step** — just add a `<script>` tag
- **HTML-centric** — behaviour lives in your markup
- **Progressive enhancement** — pages still work without JS
- **Tiny footprint** — ~14 KB min+gzip

## Core Attributes

| Attribute   | Purpose                           |
| ----------- | --------------------------------- |
| `hx-get`    | Issue a GET request               |
| `hx-post`   | Issue a POST request              |
| `hx-target` | Where to put the response         |
| `hx-swap`   | How to swap the response in       |
| `hx-trigger`| What event triggers the request   |

## A Minimal Example

Here is a button that loads content when clicked:

```html
<button hx-get="/fragments/greeting.html"
        hx-target="#output"
        hx-swap="innerHTML">
  Say Hello
</button>
<div id="output"></div>
```

When the user clicks the button, HTMX sends a GET request to `/fragments/greeting.html` and replaces the contents of `#output` with the response.

## Swapping Strategies

HTMX supports several swap strategies:

- `innerHTML` — Replace the inner HTML of the target (default)
- `outerHTML` — Replace the entire target element
- `beforebegin` — Insert before the target
- `afterbegin` — Insert as the first child
- `beforeend` — Insert as the last child
- `afterend` — Insert after the target

## What's Next?

Check out the [HTMX Demo](/htmx-demo) page to see live interactive examples, or explore the other blog posts for more patterns and techniques.

> **Tip:** HTMX works beautifully with static site generators because you can serve HTML fragments as static files — no server-side logic required.
