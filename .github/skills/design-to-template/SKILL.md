---
name: design-to-template
description: Build a Flint template by analysing a URL or image. Use when a user says "build this", "clone this site", "make a template from this URL", or provides a screenshot and asks to replicate the design.
---

# Design → Flint Template

Fetch a URL (or analyse an image), break down the design into Flint primitives, then implement a working template with any required new components.

## Trigger Phrases

- "Build a template from [URL]"
- "Clone this design: [URL]"
- "Make Flint look like [URL]"
- "Turn this screenshot into a template"

---

## Phase 1 — Fetch & Extract

Use `fetch_webpage` on the URL. Extract:

- **Page title** and meta description
- **Navigation items** — labels, order, any dropdown structure
- **Section order** — hero → features → stats → testimonials → CTA → footer
- **Repeating patterns** — card grids, list items, image+text rows
- **CTA text** — button labels, form prompts
- **Colour signals** — any Tailwind-like class names, inline style colours, or brand descriptions

If the user provides an image instead of a URL, analyse the screenshot visually using the same checklist.

---

## Phase 2 — Analyse & Classify

Map every detected section using `references/section-patterns.md`.

For each section decide:

| Decision | Action |
|----------|--------|
| Matches an existing Flint component | Reuse — add frontmatter key to content |
| Close but needs a variant | Extend existing component with a prop |
| Unique — appears on this page only | `:::html` block in content |
| Unique — will appear on multiple pages | New `Component<T>` (follow `add-component` skill) |
| Layout/structural wrapper | Goes in the template HTML |

Document your classification before writing any code. One line per section is enough.

---

## Phase 3 — Map Colours & Spacing

Use `references/tailwind-map.md` to translate visual observations into Tailwind classes.

Priorities:
1. Match layout structure exactly (flex/grid, max-width, padding)
2. Match typographic hierarchy (text-4xl, font-bold, text-gray-600)
3. Approximate colours to nearest Tailwind palette colour
4. Use `bg-gradient-to-r` for gradient hero backgrounds

---

## Phase 4 — Implement

Execute in this order:

### 4a. New components (if any)

Follow the `add-component` skill procedure:
- Write tests first in `src/components/<name>.test.ts`
- Implement in `src/components/<name>.ts`
- Register tag in `src/templates/tag-engine.ts`
- Run `bun run test:run` — must pass before continuing

### 4b. Template

Follow the `add-template` skill procedure:
- Create `themes/<THEME>/templates/<name>.html` (check `THEME` in `.env`; use `themes/default/templates/` for a base template available to all themes)
- Use `{{head}}`, `{{content}}`, `{{foot-scripts}}` as the required skeleton
- Place component tags in section order from Phase 2
- Wrap optional tags in `{{#if}}` guards
- Style structural wrappers with Tailwind (no `<style>` tags)

### 4c. Stub content page

Create `content/<name>.md` with:
- Frontmatter matching the template's expected data keys
- Placeholder body text (the user can replace it)
- `Template: <name>`

### 4d. Build & verify

```bash
bun run build && bun run test:run
```

Fix any errors before handing back to the user.

---

## Output Checklist

Before completing, confirm:

- [ ] Template renders without build errors
- [ ] All component tags are registered in tag-engine
- [ ] `{{#if}}` guards on all optional tags
- [ ] No `<script>`, `<style>`, or hard-coded text in template
- [ ] Tests pass for any new components
- [ ] Stub content page uses the new template and builds correctly

---

## References

- `references/section-patterns.md` — Design section → Flint primitive lookup table
- `references/tailwind-map.md` — Visual properties → Tailwind class heuristics
- `..add-template/SKILL.md` — Full template procedure and tag list
- `..add-component/SKILL.md` — Full component procedure
