````skill
---
name: add-product
description: Add or update a product in the Flint Static ecommerce shop. Use when the user wants to add a new product, change a price, update product details, or manage the product catalogue.
---

# Add / Update a Product

Products are managed through `products.yaml`. The build pipeline generates scaffold content pages, syncs with Stripe, and writes back Payment Link URLs automatically.

## Trigger Phrases

- "Add a new product called [name]"
- "Add [name] to the shop"
- "Change the price of [product] to [amount]"
- "Update the description for [product]"
- "Remove [product] from the shop"
- "Sync products to Stripe"
- "The payment link for [product] is wrong"
- "Add a [name] product at $[price]"
- "Update products.yaml"

## Workflow

### 1. Add the entry to `products.yaml`

```yaml
- id: my-product          # URL slug — must be unique
  title: My Product
  description: >-
    A concise one-to-two sentence description. Plain text, no Markdown.
  price_cents: 2999        # 2999 = $29.99
  currency: usd
  image: "🎁"             # emoji or /path/to/image.jpg
  order: 5                # sort position on shop page
  labels:
    - shop
    - my-category
  tax_code: "txcd_99999999"  # txcd_99999999 = tangible goods | txcd_20030000 = general service
  stripe_price_id: ""     # leave blank — filled in by build:sync
  stripe_payment_link: "" # leave blank — filled in by build:sync
```

**Do not add a `body:` field** — body content lives in the generated scaffold.

### 2. Run build:sync

```bash
bun run build:sync
```

This command syncs to Stripe AND rebuilds the site. After it completes, `stripe_price_id` and `stripe_payment_link` are written back to `products.yaml` and `dist/static/products/index.json` is updated.

Specifically, this will:
- Create the Stripe Price and Payment Link for the new product
- Write `stripe_price_id` and `stripe_payment_link` back into `products.yaml`
- Generate `content/shop/<id>.md` with a scaffold body placeholder
- Build the full site

### 3. Deploy the updated site

After sync, the site must be rebuilt and redeployed:

```bash
bun run deploy:cloudflare:pages
```

Or use the manager's **Build + Deploy** button on the Build page.

> **Warning:** Deploying without syncing first results in placeholder Stripe price IDs (`price_placeholder_<id>`) being sent to the worker, which causes a "No such price" error at checkout.

### 4. Customise the scaffold body

Open `content/shop/<id>.md`. You will see a scaffold placeholder:

```markdown
<!-- flint:scaffold — remove this comment line to preserve your edits across builds -->

## Details
<!-- Add a spec table here -->

## Care Instructions
<!-- Add care instructions here -->
```

Edit the body with real product copy. **Remove the `<!-- flint:scaffold` comment line** when done — this tells the build system to preserve your edits on future rebuilds.

```markdown
## Details

| | |
|---|---|
| **Material** | ... |
| **Dimensions** | ... |

## Care Instructions

...
```

### 5. Rebuild

```bash
bun run build
```

## Updating an Existing Product

| Change | Action |
|--------|--------|
| Title / description / image / labels | Edit `products.yaml`, run `bun run build` |
| Price | Edit `price_cents` in `products.yaml`, run `bun run build:sync` (creates new Stripe Price + Payment Link) |
| Body copy | Edit `content/shop/<id>.md` directly (ensure scaffold marker is removed), run `bun run build` |
| Remove product | Delete the entry from `products.yaml`, run `bun run build` |
| `SITE_URL` changed | Update `.env`, run `bun run build:sync:force` (recreates all Payment Links with new redirect URL) |
````
