---
title: Static Sites Are Back
Short-URI: static-sites-back
Type: post
Category: Deep Dives
Labels:
  - architecture
  - opinion
  - performance
Parent: blog
Order: 3
Author: Alex Architect
Date: 2026-01-20
Description: Why the pendulum is swinging back toward static site generators
Keywords:
  - static sites
  - jamstack
  - architecture
  - performance
---

# Static Sites Are Back

For years the web trended toward ever-heavier client-side applications. SPAs, hydration, server components — the complexity kept climbing. Now the pendulum is swinging back, and static sites are having a renaissance.

## The Case for Static

### Performance

Static files are *fast*. There is no server-side rendering at request time, no database query, no cold start. A CDN edge node serves pre-built HTML in milliseconds.

| Metric           | Static Site | Server-Rendered | Client SPA |
| ---------------- | ----------- | --------------- | ---------- |
| TTFB             | ~20 ms      | ~200 ms         | ~100 ms    |
| First Contentful | ~100 ms     | ~400 ms         | ~800 ms    |
| JS Bundle        | ~15 KB      | ~80 KB          | ~250 KB    |

### Security

No server means no server to hack. Static sites have a minimal attack surface — just files on a CDN.

### Cost

Hosting is practically free. GitHub Pages, Netlify, Cloudflare Pages — all offer generous free tiers for static content.

### Reliability

No runtime dependencies means no runtime failures. Static files don't crash, don't run out of memory, and don't need restarts.

## What Changed?

Several trends made static viable for more use cases:

1. **HTMX and similar libraries** — You can now add interactivity without a full framework. Load HTML fragments on demand, swap content, handle forms — all from HTML attributes.

2. **Edge computing** — When you do need server logic, edge functions run close to users with minimal latency.

3. **Build tooling** — Modern SSGs like Astro, 11ty, and custom TypeScript builders (like this one!) make it easy to compile markdown into beautiful, fast pages.

4. **Content-first mindset** — Teams realized that most pages are content, not applications. A blog post doesn't need React.

## When Static Isn't Enough

Static sites aren't a silver bullet. You still need a server (or serverless functions) for:

- User authentication
- Real-time data (dashboards, chat)
- Complex search beyond client-side filtering
- User-generated content that needs moderation

But for content sites, documentation, blogs, marketing pages, and portfolios? Static is hard to beat.

## The Hybrid Approach

The sweet spot is often a **static core with dynamic islands**:

- Pre-build all content pages as static HTML
- Use HTMX to load dynamic fragments where needed
- Offload heavy interactions to edge functions
- Keep the JS budget under 50 KB

This gives you the speed of static with the flexibility of dynamic — without the complexity of a full-stack framework.

## Conclusion

Static sites aren't a step backward. They're a step *forward* — back to the fundamentals of the web, enhanced with modern tooling. If your content doesn't change on every request, why compute it on every request?

> *The best request is the one you never have to make. The second best is the one answered from cache.*
