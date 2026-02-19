# Visual Design → Tailwind Class Heuristics

Use this reference during Phase 3 to translate visual observations into Tailwind utility classes.
Goal is structural and typographic accuracy — colour is approximated, not pixel-perfect.

---

## Layout Structure

| Visual observation | Tailwind classes |
|-------------------|-----------------|
| Full-width section | `w-full` |
| Centred content with max width | `max-w-4xl mx-auto px-4 sm:px-6 lg:px-8` |
| Wide centred content | `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` |
| Side-by-side two columns | `grid grid-cols-1 md:grid-cols-2 gap-8` |
| Three-column grid | `grid grid-cols-1 md:grid-cols-3 gap-6` |
| Four-column grid | `grid grid-cols-2 lg:grid-cols-4 gap-4` |
| Flexbox row with space between | `flex items-center justify-between` |
| Flexbox centred column | `flex flex-col items-center text-center` |
| Card with shadow | `bg-white rounded-xl shadow-md p-6` |
| Card with border | `bg-white rounded-lg border border-gray-200 p-6` |
| Sticky top nav | `sticky top-0 z-50` |
| Full-height hero | `min-h-screen flex items-center` |
| Section vertical padding (tight) | `py-12` |
| Section vertical padding (normal) | `py-16 md:py-24` |
| Section vertical padding (spacious) | `py-24 md:py-32` |

---

## Typography

| Visual observation | Tailwind classes |
|-------------------|-----------------|
| Large hero headline | `text-4xl md:text-6xl font-bold tracking-tight` |
| Section heading (h2) | `text-3xl md:text-4xl font-bold` |
| Sub-heading (h3) | `text-xl md:text-2xl font-semibold` |
| Body text normal | `text-base text-gray-600 leading-relaxed` |
| Body text large | `text-lg text-gray-600 leading-relaxed` |
| Caption / meta text | `text-sm text-gray-500` |
| All-caps label / eyebrow | `text-xs font-semibold uppercase tracking-wider text-indigo-600` |
| Centered section intro | `text-center max-w-2xl mx-auto` |
| Serif/editorial heading style | `font-bold` (Tailwind defaults sans-serif — note for user) |

---

## Colour Approximation

### Background colours

| Observed colour | Tailwind approximation |
|----------------|----------------------|
| White / off-white | `bg-white` or `bg-gray-50` |
| Light grey section | `bg-gray-100` |
| Dark navy / charcoal | `bg-gray-900` |
| Dark blue | `bg-blue-900` or `bg-indigo-900` |
| Black | `bg-black` |
| Brand purple/violet | `bg-indigo-600` or `bg-violet-600` |
| Brand blue | `bg-blue-600` |
| Brand green | `bg-emerald-600` or `bg-green-600` |
| Warm gradient (orange → pink) | `bg-gradient-to-r from-orange-500 to-pink-500` |
| Cool gradient (blue → indigo) | `bg-gradient-to-r from-blue-600 to-indigo-600` |
| Light brand tint background | `bg-indigo-50` or `bg-blue-50` |

### Text colours

| Observed | Tailwind |
|---------|---------|
| Primary dark text | `text-gray-900` |
| Secondary / muted text | `text-gray-500` or `text-gray-600` |
| White text on dark bg | `text-white` |
| Brand coloured text | `text-indigo-600` or `text-blue-600` |
| Link colour | `text-indigo-600 hover:text-indigo-800` |

### Borders

| Observed | Tailwind |
|---------|---------|
| Subtle divider line | `border-t border-gray-200` |
| Card border | `border border-gray-200` |
| Highlighted border (brand) | `border-l-4 border-indigo-600` |

---

## Buttons

| Visual style | Tailwind classes |
|-------------|-----------------|
| Primary solid button | `inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors` |
| Secondary outline button | `inline-flex items-center px-6 py-3 border-2 border-indigo-600 text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 transition-colors` |
| Ghost / text button | `text-indigo-600 font-semibold hover:underline` |
| Large CTA button | Add `text-lg px-8 py-4` to primary |
| Dark background button | `bg-white text-gray-900 hover:bg-gray-100` |
| Danger / red button | `bg-red-600 text-white hover:bg-red-700` |

---

## Icons & Media

| Observed pattern | Tailwind + approach |
|-----------------|-------------------|
| Round icon with background | `w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600` |
| Square icon with background | `w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center` |
| Full-bleed hero image | `w-full object-cover` — height set by container |
| Avatar / profile image | `w-10 h-10 rounded-full object-cover` |
| Emoji as icon | Render directly in HTML — wrap in `<span aria-hidden="true">` |

---

## Spacing Calibration

| Visual spacing | Tailwind gap/padding |
|---------------|---------------------|
| Tight (4–8px) | `gap-2` / `p-2` |
| Normal (12–16px) | `gap-4` / `p-4` |
| Comfortable (24–32px) | `gap-6 md:gap-8` / `p-6` |
| Spacious (48px+) | `gap-12` / `p-12` |

---

## Responsiveness Defaults

Always add responsive prefixes. Flint templates must be mobile-first:

```html
<!-- Grid example -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

<!-- Stack to row example -->
<div class="flex flex-col md:flex-row gap-8">

<!-- Hide on mobile -->
<div class="hidden md:block">
```

---

## What to Tell the User

After implementing, always note:

1. **Fonts** — Tailwind defaults to system sans-serif. If the design uses a custom Google Font, add the `<link>` to the `{{head}}` component's output or note it for manual addition.
2. **Custom colours** — If the brand colour has no Tailwind equivalent, suggest adding it to `tailwind.config.js` under `theme.extend.colors`.
3. **Animations** — Flint uses no animation libraries by default. Complex animations need a `src/client/` module.
