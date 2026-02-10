# Content Examples

## Blog Post

```markdown
---
title: Getting Started with HTMX
Short-URI: getting-started-htmx
Template: blog-post
Type: post
Category: Tutorials
Labels:
  - htmx
  - beginner
Parent: blog
Order: 1
Author: Jane Developer
Date: 2026-02-01
Description: Learn how to add dynamic behavior to your static site
Keywords:
  - htmx
  - tutorial
---

# Getting Started with HTMX

Standard **Markdown** content goes here. Tables, code blocks, links, images all work.
```

## Section Index (Blog)

```markdown
---
title: Blog
Short-URI: blog
Template: default
Type: section
Category: Blog
Order: 4
Labels:
  - blog
  - articles
Parent: root
Description: Blog posts covering web development and static site patterns
---

# Blog

Welcome to the blog.

## Recent Posts

:::children sort=date-desc
:::
```

## Product Page

```markdown
---
title: Blue Ceramic Mug
Short-URI: blue-mug
Template: shop
Type: product
Category: Shop
Order: 1
Labels:
  - shop
Parent: shop
PriceCents: 1200
Currency: usd
StripePriceId: price_1QxABC123
Image: ☕
Description: A hand-crafted ceramic mug.
---

# Blue Ceramic Mug

Product description in Markdown...
```

## Shop Index with Product Grid

```markdown
---
title: Shop
Short-URI: shop
Template: shop
Type: section
Parent: root
Order: 5
Description: Browse our products
---

# Shop

:::children sort=order type=product class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
<article class="product-card bg-white rounded-lg shadow p-4">
  <a href="{url}"><span class="text-4xl">{image}</span><h3>{title}</h3></a>
  <span>{price}</span>
  <button class="flint-add-to-cart" data-id="{short-uri}">Add to Cart</button>
</article>
:::
```

## Simple Page

```markdown
---
title: About
Short-URI: about
Template: default
Type: page
Parent: root
Order: 2
Description: About this site
---

# About

This is a simple standalone page with Markdown content.
```

## Page with Component Data

Content files can include structured YAML that drives template components. The tag engine reads these fields and passes them to components as typed props.

```markdown
---
title: Agent & Skills
Short-URI: agent
Template: agent-info
Type: page
Parent: root
Order: 6
Description: Skills and automation overview
Skills:
  - name: add-content
    icon: 📝
    description: Create or edit content pages.
    tags: [frontmatter, ":::children"]
    color: green
  - name: build-and-test
    icon: 🧪
    description: Build and run tests.
    tags: [vitest, typecheck]
    color: amber
---

# Skills

Prose Markdown body. The `{{skill-cards}}` tag in the template
reads the Skills array from frontmatter and renders them.
```

The key rule: **content files provide data, components provide presentation**. Never embed HTML cards in Markdown when a component exists.
