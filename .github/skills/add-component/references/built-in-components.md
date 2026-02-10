# Built-in Components

All existing components in `src/components/` for reference.

## Navigation (`navigation.ts`)

Top navigation bar with active state and HTMX boost support.

- **Tag:** `{{navigation}}`
- **Props:** `{ items: NavItem[] }` where `NavItem = { label, href, active?, hxBoost?, order? }`
- **Renders:** `<nav>` with flex-wrapped links, blue active state, responsive padding

## LabelFooter (`label-footer.ts`)

Site-wide label cloud footer showing all labels across the site.

- **Tag:** `{{label-footer}}`
- **Props:** `{ labels: string[] }`
- **Renders:** `<footer>` with label links

## Gadget (`gadget.ts`)

Interactive demo widget for the component demo page.

- **Tag:** `{{gadget}}`
- **Props:** `{}` (no props)
- **Renders:** Demo widget HTML

## Cart (`cart.ts`)

Shopping cart placeholder, hydrated client-side by `src/client/cart-hydrate.ts`.

- **Tag:** `{{cart}}`
- **Props:** `{}` (no props)
- **Renders:** Cart container with `id="flint-cart"`, populated via client JS

## Product (`product.ts`)

Demo product card with Add-to-Cart button. **Data-driven from frontmatter.**

- **Tag:** `{{product}}`
- **Props:** `{ id, title, price, description, image? }`
- **Frontmatter source:** `Short-URI` → id, `title` → title, `PriceCents` → formatted price, `Description` → description, `Image` → image
- **Renders:** Product card with image, title, price, description, and `.flint-add-to-cart` button
- **Returns `''`** when `Short-URI` is missing (no product data on this page)

## TreeMenu (`navigation/tree-menu.ts`)

Hierarchical sidebar menu built from the page tree.

- **Tag:** none (used in code only)
- **Props:** `{ tree: TreeNode[], currentPath?, basePath? }`

## CategoryNav (`navigation/category-nav.ts`)

Category filter pills with counts.

- **Tag:** none (used in code only)
- **Props:** `{ categories: CategoryCount[], activePath?, basePath? }`

## LabelCloud (`navigation/label-cloud.ts`)

Weighted tag cloud with size scaling.

- **Tag:** none (used in code only)
- **Props:** `{ labels: LabelCount[], basePath? }`

## LabelIndex (`label-index.ts`)

Label index page content listing pages grouped by label.

- **Tag:** none (used in code only)
- **Props:** `{ labels: LabelGroup[], basePath? }`

## SkillCards (`skill-cards.ts`)

Responsive grid of skill info cards with colored badges. **Data-driven from frontmatter.**

- **Tag:** `{{skill-cards}}`
- **Props:** `{ skills: SkillInfo[] }` where `SkillInfo = { name, icon, description, tags, color }`
- **Frontmatter source:** `Skills` array — each item has `name`, `icon`, `description`, `tags[]`, `color`
- **Renders:** 2-column card grid, last card spans full width when count is odd
- **Returns `''`** when `Skills` frontmatter key is missing or empty
