# Frontmatter Fields

## Required

| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| `Short-URI` | `string` | `getting-started` | Unique page identifier. Alphanumeric + hyphens only. |

## Core Fields

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `title` | `string` | value of Short-URI | Page title — `<title>`, nav, listings |
| `Type` | `page \| post \| section \| product` | `page` | Page type |
| `Template` | `string` | `default` | HTML template name (without `.html`) |
| `Parent` | `string` | `root` | Short-URI of parent page. `root` = top nav |
| `Order` | `number` | `999` | Sort position among siblings. Lower = first |

## Metadata Fields

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `Category` | `string` | `""` | Single category (e.g. `Tutorials`) |
| `Labels` | `string[]` | `[]` | Tags for filtering/grouping |
| `Author` | `string` | `""` | Page author name |
| `Date` | `ISO string` | `null` | Publication date (`YYYY-MM-DD`) |
| `Description` | `string` | `""` | SEO meta description |
| `Keywords` | `string[]` | `[]` | SEO meta keywords |

## Product Fields (only for `Type: product`)

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `PriceCents` | `number` | `0` | Price in cents (1200 = $12.00) |
| `Currency` | `string` | `usd` | Currency code |
| `StripePriceId` | `string` | `""` | Stripe Price ID for checkout |
| `Image` | `string` | `""` | Image URL or emoji placeholder |

Hyphenated alternatives (`Price-Cents`, `Stripe-Price-Id`) also work.

## Page Types

| Type | Use for | Parent pattern |
|------|---------|----------------|
| `page` | Standalone pages (About, Contact, Home) | `root` or section URI |
| `post` | Blog posts, articles | Section URI (e.g. `blog`) |
| `section` | Container that lists children (Blog index, Docs index) | `root` |
| `product` | Purchasable items with price/Stripe fields | Section URI (e.g. `shop`) |

## Available Templates

| Name | Purpose |
|------|---------|
| `default` | Standard page (nav, content, label footer) |
| `blank` | Minimal shell (content + scripts only) |
| `blog-post` | Article layout with byline header |
| `shop` | Shop layout with cart widget |
| `component-demo` | Interactive component demo |
| `product-demo` | Product + cart demo |
