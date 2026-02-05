---
title: HTMX Demo
Short-URI: htmx-demo
Type: page
Category: Documentation
Order: 3
Labels:
  - htmx
  - tutorial
  - interactive
Parent: root
Author: Static Site Generator
Date: 2026-02-05
Description: Working demonstration of HTMX on a static site — every example is functional
Keywords:
  - htmx
  - dynamic content
  - static site
  - html fragments
---

# HTMX on a Static Site

Every example on this page **actually works** — no backend, no API, no fake endpoints. Just HTMX loading pre-built HTML fragments from the `/fragments/` directory.

---

## 1. Click to Load Content

The simplest HTMX pattern: click a link, load a static HTML file, swap it in.

:::html
<div class="space-y-3">
  <button hx-get="/fragments/greeting.html" hx-target="#load-result" hx-swap="innerHTML" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 cursor-pointer">
    Load Greeting
  </button>
  <div id="load-result" class="p-4 border border-gray-300 rounded min-h-[60px] bg-white">
    <em class="text-gray-400">Click the button above...</em>
  </div>
</div>
:::

**How it works:** The button has `hx-get="/fragments/greeting.html"` — HTMX fetches that static file and swaps its HTML into `#load-result`. That's it.

---

## 2. Tabbed Content

Each tab loads a different static HTML fragment. No JavaScript tab library needed.

:::html
<div>
  <div class="flex border-b border-gray-300">
    <button hx-get="/fragments/tab-overview.html" hx-target="#tab-content" hx-swap="innerHTML" class="px-4 py-2 border-b-2 border-blue-500 text-blue-600 font-medium cursor-pointer">Overview</button>
    <button hx-get="/fragments/tab-attributes.html" hx-target="#tab-content" hx-swap="innerHTML" class="px-4 py-2 text-gray-600 hover:text-blue-600 cursor-pointer">Attributes</button>
    <button hx-get="/fragments/tab-examples.html" hx-target="#tab-content" hx-swap="innerHTML" class="px-4 py-2 text-gray-600 hover:text-blue-600 cursor-pointer">Examples</button>
  </div>
  <div id="tab-content" class="border border-t-0 border-gray-300 rounded-b bg-white min-h-[150px]">
    <div class="p-4">
      <p class="text-gray-500"><em>Click a tab to load content...</em></p>
    </div>
  </div>
</div>
:::

**How it works:** Each tab button has a different `hx-get` pointing to a static fragment file. They all target the same `#tab-content` container.

---

## 3. Click-to-Reveal Details

Expand sections on demand without loading everything upfront.

:::html
<div class="space-y-2">
  <div class="border border-gray-300 rounded">
    <button hx-get="/fragments/detail-htmx.html" hx-target="#detail-1" hx-swap="innerHTML" class="w-full text-left px-4 py-3 font-medium hover:bg-gray-50 cursor-pointer flex justify-between items-center">
      <span>What is HTMX?</span>
      <span class="text-gray-400">&#9656;</span>
    </button>
    <div id="detail-1"></div>
  </div>
  <div class="border border-gray-300 rounded">
    <button hx-get="/fragments/detail-static.html" hx-target="#detail-2" hx-swap="innerHTML" class="w-full text-left px-4 py-3 font-medium hover:bg-gray-50 cursor-pointer flex justify-between items-center">
      <span>Using HTMX on Static Sites</span>
      <span class="text-gray-400">&#9656;</span>
    </button>
    <div id="detail-2"></div>
  </div>
</div>
:::

**How it works:** Each heading is a button with `hx-get` that loads a fragment into the panel below it. Content is only fetched when the user clicks.

---

## 4. Boosted Navigation

Add `hx-boost="true"` to links and HTMX converts them to AJAX requests that swap the body — instant, SPA-like navigation with zero JavaScript.

:::html
<nav class="flex space-x-4 p-4 bg-gray-100 rounded" hx-boost="true">
  <a href="/" class="text-blue-600 hover:underline">Home</a>
  <a href="/about" class="text-blue-600 hover:underline">About</a>
  <a href="/htmx" class="text-blue-600 font-bold">HTMX Demo (current)</a>
</nav>
:::

**How it works:** The `hx-boost="true"` on the `<nav>` container applies to all links inside it. Clicking any link fetches the page via AJAX and swaps the body — no full page reload, back button still works.

---

## 5. Lazy Loading (Scroll to Reveal)

This content loads automatically when you scroll it into view:

:::html
<div hx-get="/fragments/lazy-content.html" hx-trigger="revealed" hx-swap="innerHTML" class="border border-dashed border-gray-400 rounded min-h-[100px] flex items-center justify-center bg-gray-50">
  <em class="text-gray-400">&#9203; Loading when visible...</em>
</div>
:::

**How it works:** `hx-trigger="revealed"` fires the GET request when the element enters the viewport. Perfect for below-the-fold content.

---

## 6. Load More Pattern

Click to append additional content below existing content.

:::html
<div id="content-list">
  <div class="p-3 bg-gray-50 rounded mb-2">
    <p class="font-medium">&#128196; Initial Content</p>
    <p class="text-sm text-gray-600">This was rendered at build time. Click below to load more.</p>
  </div>
</div>
<button hx-get="/fragments/more-content.html" hx-target="#content-list" hx-swap="beforeend" class="mt-2 bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 cursor-pointer">
  Load More
</button>
:::

**How it works:** `hx-swap="beforeend"` appends the loaded fragment after existing children instead of replacing them.

---

## 7. Inline Element Swap

Replace a single element inline within text.

:::html
<p>
  The current status is:
  <span id="status-badge" class="inline-block px-2 py-1 bg-gray-200 text-gray-700 rounded text-sm">unknown</span>
  &#8212;
  <button hx-get="/fragments/greeting.html" hx-target="#status-badge" hx-swap="outerHTML" class="text-blue-600 underline text-sm cursor-pointer">check now</button>
</p>
:::

**How it works:** `hx-swap="outerHTML"` replaces the entire target element (not just its children), useful for swapping badges, status indicators, or inline widgets.

---

## How This Works — No Backend Required

The key insight: **HTMX doesn't care if the response comes from a server or a static file.** It just makes an HTTP GET, gets HTML back, and swaps it in.

```
static/
  fragments/
    greeting.html       <- loaded by "Click to Load"
    tab-overview.html   <- loaded by "Overview" tab
    tab-attributes.html <- loaded by "Attributes" tab
    tab-examples.html   <- loaded by "Examples" tab
    detail-htmx.html    <- loaded by accordion
    detail-static.html  <- loaded by accordion
    lazy-content.html   <- loaded on scroll
    more-content.html   <- loaded by "Load More"
```

At build time, generate your fragment files. At runtime, HTMX loads them on demand. That's the entire architecture.

### The Pattern

```html
<!-- Any element can trigger a load -->
<button hx-get="/fragments/content.html"
        hx-target="#result"
        hx-swap="innerHTML">
  Load Content
</button>

<!-- Target container for swapped content -->
<div id="result"></div>
```

### Useful hx-swap Values

| Value | Behavior |
|---|---|
| `innerHTML` | Replace children of target |
| `outerHTML` | Replace the entire target element |
| `beforeend` | Append after last child (load more) |
| `afterbegin` | Insert before first child |
| `beforebegin` | Insert before the target |
| `afterend` | Insert after the target |

### Useful hx-trigger Values

| Value | Behavior |
|---|---|
| `click` | On click (default for buttons) |
| `revealed` | When element scrolls into view |
| `load` | Immediately when element loads |
| `every 5s` | Polling interval (needs a server) |
