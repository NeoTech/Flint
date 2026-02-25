# Copilot Instructions — Flint Static

> Lean routing document. Detailed procedures live in **skills** and **docs**.

---

## Agent Rules

- **Never open a new terminal** if there is already an agent-controlled terminal open. Reuse the existing terminal.
- **EADDRINUSE error**: Inform the user the server is already running. Do **not** kill the process.
- **Stale Rspack process**: If Rspack appears to be running without `bun run dev` being active, a previous dev instance is still alive. Tell the user to run `taskkill /IM bun.exe /F` (Windows) or `pkill bun` (macOS/Linux) to clear it.
- **Test-first**: Always write or update tests before implementing features.
- **Build after changes**: Run `bun run build` after content or code changes.
- **Stripe sync**: After changing `products.yaml`, run `bun run build:sync` to sync prices and rebuild. Use `build:sync:force` to force-recreate all Payment Links. Use `stripe:cleanup` to archive all Flint Static-managed products and clear IDs before a full reset.
- **Cloudflare Pages deploy**: Always use `scripts/deploy-pages.ts` via `bun run deploy:cloudflare:pages` (Direct Upload API via fetch — no wrangler). Never use `wrangler pages deploy` in any subprocess context. Wrangler is unreliable in non-TTY/subprocess contexts and its local hash cache breaks new-project deploys.
- **Product sync before deploy**: When shop content changes, always run `bun run build:sync` (writes real Stripe price IDs + recompiles) then `bun run deploy:cloudflare:pages`. Running just `bun run deploy:cloudflare:pages` without syncing first deploys stale content with placeholder price IDs.

---

## What Is Flint Static?

A **TypeScript static site generator** that compiles Markdown files into HTML pages using:

- **Markdown + YAML frontmatter** for content
- **HTML templates with `{{tag}}` placeholders** for page layouts
- **TypeScript components** (`Component<T>`) for reusable server-rendered UI
- **HTMX** for client-side interactions · **Tailwind CSS** for styling · **Rspack** for bundling

---

## Workflow orchestration

### 1. Plan Node Default
- Enter plan mode for any non-trivial task (3+ steps, arhitectural changes, multiple files affected, etc.)
- If something goes sideways, STOP and re-plan immediatly - don't keep pushing.
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity and back-and-forth during implementation.

### 2. Subagent Strategy
- Use subagents liberally to keep main context window, clean.
- Offload research, exploration, and parallel analysis to subagents.
- For complex problems, throw more compute at it via subagents instead of trying to do it all in one agent.
- One task per subagent for focused execution

### 3. Self-improvement loop
- After ANY correction from the user: update `.github/tasks/lessons.md` with the pattern of the mistake.
- Write rules for yourself that prevent the same mistake.
- Ruthlessly iterate on these lessons until the same mistake rate drops.
- Review lessons at session start for relevant project.

### 4. Verification before done
- Never mark task complete without proving it works.
- Diff Behavior between main and your changes when relevant
- Ask yourself: "Would staff engineer approve this?"
- Rrun tests, check logs, demonstration correctness

### 5. Demand elegance (Balanced)
- For non-trivial changes: Paus and ask "is there a simpler or more elegant way?"
- If a fix feel hacky: "Knowing everything I know now, implement the elegant solution instead of the quick fix"
- Skip this for simple, obvious fixes - don't over-enggineer
- Challenge your own work before presenting it

### 6. Automatically bug fixing
- When given a bug report: Just fix it. Don't ask for hand-holding.
- Point at logs, errors, failing tests - then resolve them
- Zero context switching required from the user
- Go fix failing tests without being told how
- Go fix failing linting without being todl to

## Task management

1. **Plan first**: Write plan to `.github/tasks/todo.md` with checkable items.
2. **Verify Plan**: Check in before starting implementation
3. **Track progress*:: Mark items complete as you go
4. **Explain changes**: High level summary at each step
5. **Document results**: Add review section to `.github/tasks/todo.md`
6. **Cappture lessons**: Update `.github/tasks/lessons.md` after corrections

## Core principles

- **Simpplicity first**: Make very change as simple as possible. Impact minimal code.
- **No laziness**: Find root causes. No temporary fixes. Senior developer standard.
- **Minimat impact**: Changes should only touch waht's necessary. Avoid introducing bugs.

---

## Commands

### Site

| Command | Purpose |
|---------|--------|
| `bun run build` | Compile content/ → dist/ |
| `bun run dev` | Dev server on port 3000 with HMR (Rspack) |
| `bun run build:sync` | Stripe sync + compile (run after changing `products.yaml`) |
| `bun run build:sync:force` | Force-recreate all Stripe Payment Links + compile |
| `bun run generate` | Regenerate product pages from `products.yaml` |
| `bun run stripe:cleanup` | Archive all Flint Static-managed Stripe products + clear `products.yaml` IDs |
| `bun run deploy:cloudflare:pages` | Deploy static site to Cloudflare Pages (Direct Upload API, no wrangler) |

### Checkout server (serverless mode only)

| Command | Purpose |
|---------|--------|
| `bun run serve:checkout` | Start Bun checkout server in dev mode (port 3001) |
| `bun run start:checkout` | Start Bun checkout server in production mode |
| `bun run deploy:checkout:cloudflare` | Deploy checkout function to Cloudflare Workers |

### Quality

| Command | Purpose |
|---------|--------|
| `bun run test:run` | Run all tests once |
| `bun run test` | Test watch mode |
| `bun run typecheck` | TypeScript type checking |
| `bun run lint` | ESLint |
| `bun run lint:fix` | ESLint auto-fix |

---

## Flint Static Manager (`manager/`)

A **separate Bun HTTP server** that provides a web UI for managing one or more Flint Static sites.
It is a standalone app — run and tested independently from the site itself.

### Starting the manager

```bash
cd manager
bun --hot server.ts        # dev (hot reload)
bun server.ts              # production
```

Default port: **8080** (override with `MANAGER_PORT` env var).
Auth token: `MANAGER_API_KEY` env var (set in `manager/.env`, see `.env.example`).

### Architecture

```
manager/
├── server.ts              ← Bun.serve entry point, logging
├── src/
│   ├── router.ts          ← Single request dispatcher (no external router)
│   ├── auth.ts            ← Bearer token + session cookie auth
│   ├── registry.ts        ← JSON registry of registered Flint Static sites
│   ├── runner.ts          ← spawnAsStream() — SSE wrapper for bun subprocess
│   ├── api/               ← JSON API handlers (pure functions → Response)
│   │   ├── sites.ts       ← CRUD for registered sites
│   │   ├── pages.ts       ← Create / read / update / delete / reorder .md files
│   │   ├── products.ts    ← Read/write products.yaml (raw + parsed), generate, sync
│   │   ├── env.ts         ← Read/write .env files
│   │   ├── themes.ts      ← Active theme, template listing
│   │   └── build.ts       ← SSE build log (bun run build)
│   ├── lib/
│   │   ├── logger.ts      ← NDJSON structured request logging with daily rotation
│   │   └── component-scanner.ts  ← Scans site src/ for component definitions
│   └── ui/                ← Server-rendered HTML views (TypeScript → HTML strings)
│       ├── shell.ts       ← Full-page HTML wrapper: top navbar + sidebar + main
│       ├── dashboard.ts   ← Site list + add-site form
│       ├── pages.ts       ← File tree + CodeMirror editor + markdown preview
│       ├── products.ts    ← products.yaml editor (Visual card grid + YAML tab)
│       ├── env.ts         ← .env key/value editor
│       ├── themes.ts      ← Theme switcher + template browser
│       ├── build.ts       ← Build trigger + SSE log viewer
│       └── components.ts  ← Component browser + frontmatter editor
```

### Route table

| Method | Path | Handler |
|--------|------|---------|
| GET/POST | `/login` | Auth pages |
| GET | `/` | Dashboard |
| GET | `/sites/new` | Add-site form |
| GET/POST | `/api/sites` | List / add site |
| DELETE | `/api/sites/:id` | Remove site |
| GET | `/sites/:id/pages` | Pages editor |
| POST | `/sites/:id/pages` | Create page |
| PATCH | `/sites/:id/pages/reorder` | Reorder pages |
| GET/PUT/DELETE | `/sites/:id/pages/:path` | Read / update / delete page |
| GET/PUT | `/sites/:id/pages/:path/parsed` | Frontmatter-aware read/write |
| GET | `/sites/:id/products` | Products editor UI |
| PUT | `/sites/:id/products` | Save raw YAML |
| GET | `/sites/:id/products/raw` | Get raw YAML string |
| GET | `/sites/:id/products/parsed` | Get parsed product array |
| PUT | `/sites/:id/products/parsed` | Save product array (auto-serialises YAML) |
| POST | `/sites/:id/products/generate` | SSE: `bun run generate` |
| POST | `/sites/:id/products/sync` | SSE: `bun run build:sync` |
| POST | `/sites/:id/products/sync/force` | SSE: `bun run build:sync:force` |
| GET | `/sites/:id/build` | Build UI (compile + Cloudflare **Pages** + Vercel/Netlify/GH Pages deploys) |
| POST | `/sites/:id/build` | SSE: `bun run build` |
| POST | `/sites/:id/build/targets` | List Pages-deploy targets + availability |
| POST | `/sites/:id/deploy/:service` | SSE: deploy to **Cloudflare Workers** (or other workers-style services) |
| GET | `/sites/:id/deploy` | **Workers** config overview (sidebar label: "Workers") |
| GET | `/sites/:id/deploy/:service` | Per-service Workers config form |
| GET/PUT | `/sites/:id/env` | Env editor |
| GET | `/sites/:id/themes` | Theme browser |
| GET/PUT | `/sites/:id/themes/active` | Get / set active theme |
| GET | `/sites/:id/themes/:theme/templates` | List templates |
| GET | `/sites/:id/components` | Component browser |
| GET | `/sites/:id/components/:tag` | Component detail |

### Shell layout

```
┌────────────────────────────────────────────────────┐
│ Top navbar: ⚡ Flint Static Manager   [Secrets] [Profile] │  h-12, bg-gray-900
├──────────┬─────────────────────────────────────────┤
│ Sidebar  │  <main id="content">                    │  flex-1, min-h-0
│ w-56     │  HTMX target — pages swap here          │
│ indigo   │  p-8, overflow-y-auto                   │
└──────────┴─────────────────────────────────────────┘
```

HTMX navigates by swapping `#content` — sidebar and navbar persist across navigations.

### Manager development rules

- **IIFE every `<script>` block** — HTMX injects script HTML into the live DOM; `const`/`let` at top level will collide on second navigation. Always wrap: `<script>(function() { … })();</script>`
- **Use `window.xxx` for all globals in re-injected scripts** — any function or variable that must be callable from HTML event handlers or from other scripts must be assigned to `window` (e.g. `window.myFn = function() {}`). Plain function declarations and IIFE-local variables are invisible outside the IIFE. This is the most common source of "X is not defined" errors in manager panes.
- **Guard-initialise persistent state on `window`** — variables that hold state across multiple calls (arrays, counters, etc.) must live on `window` with a guard: `window.__myArr = window.__myArr || []`. Never use bare `let`/`const` for such state, even inside an IIFE — re-injection resets them. The guard ensures the value survives navigation while still initialising on first load.
- **No single-quotes inside TS template-literal event handlers** — `\'` inside a TypeScript template literal compiles to `'`, which terminates the surrounding JS string and produces a `SyntaxError` at runtime. Use `data-*` attributes to pass values instead: `<button data-id="${id}" onclick="handle(this.dataset.id)">` — never `onclick="handle('${id}')"`.
- **Fetch-on-load, never SSR JSON** — never embed structured data as `escHtml(JSON.stringify(data))` inside a `<script>` tag; HTML entities aren't decoded by JS (`&quot;` ≠ `"`). Use `fetch('/api/...')` on `DOMContentLoaded` instead.
- **UI files render HTML strings only** — no filesystem access in `ui/*.ts`. All data comes from `api/*.ts` handlers at request time or via client-side fetch.
- **All API handlers are pure** — they receive `(siteId, req?)` and return `Response`. No side effects outside writing the site's files.
- **Tests live in `src/**/*.test.ts`** — use `bun:test` + `mock.module()`. Every `mock.module('../registry.js')` must expose all 6 exports (`loadRegistry`, `saveRegistry`, `getSite`, `upsertSite`, `removeSite`, `resolveSitePath`).
- **Do not mock `ui/*.js` in router.test.ts** — UI modules are safe to run with the real registry mock; mocking them contaminates `ui/*.test.ts` via Bun's shared module cache.
- **Build page ≠ Workers page** — These are two completely separate deploy flows. NEVER mix them:
  - **Build page** (`/sites/:id/build`) → deploys the **static site** to Cloudflare Pages, Vercel, Netlify, GitHub Pages via `wrangler pages deploy` etc.
  - **Workers page** (`/sites/:id/deploy/*`, sidebar label "Workers") → deploys **Cloudflare Workers** (e.g. the checkout function) via `bun run deploy:checkout:cloudflare`.
  - The Cloudflare card on the Build page has **no config page** — credentials are set in Env. Its "Configure →" link goes to `/env`, not `/deploy/cloudflare`.

### Manager commands

Run from `manager/`:

| Command | Purpose |
|---------|---------|
| `bun --hot server.ts` | Dev server with hot reload |
| `bun server.ts` | Production server |
| `bun test` | Watch mode tests |
| `bun test --no-watch` | Run tests once |
| `bunx tsc --noEmit` | Type check |

---

## Separation of Concerns — The Core Rule

Every decision starts with: **which layer does this belong in?**

| Layer | Location | Responsibility |
|-------|----------|----------------|
| **Content** | `content/*.md` | Page text, frontmatter data, `:::children`/`:::html`/HTMX links |
| **Templates** | `themes/default/templates/*.html` | Page skeleton with `{{tag}}` placeholders — no logic |
| **Components** | `src/components/*.ts` | Reusable server-rendered UI with typed props |
| **Client** | `src/client/*.ts` | Browser-side JS (DOM events, fetch, IndexedDB) — bundled by Rspack |
| **Styles** | Tailwind classes | Inline in templates, components, and `:::html` blocks |

### Decision Flowchart

```
"I need to add something to a page"
     │
     ├── Page-specific text, data, or listing? → Content (Markdown + :::children)
     ├── Page-specific custom HTML?            → Content (:::html block)
     ├── Structural layout?                    → Template ({{tag}} placeholders)
     ├── Reusable UI on multiple pages?        → Component (TypeScript → register tag)
     ├── Client-side behaviour?                → Client module (src/client/*.ts)
     └── Styling?                              → Tailwind classes
```

### Hard Boundaries

| ❌ Never | ✅ Instead |
|----------|-----------|
| `<script>` in content or templates | `src/client/*.ts` bundled by Rspack |
| Page text in templates | Markdown in `content/` |
| Hard-coded nav links | Auto-generated from `Parent` + `Order` |
| `<style>` tags | Tailwind utility classes |
| Components for one-off HTML | `:::html` block in content |
| Secret keys in client code | Only `pk_test_`/`pk_live_` publishable keys |

---

## Skills — Step-by-Step Procedures

Use the appropriate skill for each task:

| Task | Skill |
|------|-------|
| Add/edit a page, post, section, or product | `add-content` |
| Add/edit a page layout | `add-template` |
| Add/edit a reusable UI component | `add-component` |
| Add/edit developer documentation | `add-documentation` |
| Add/update a shop product (products.yaml + Stripe) | `add-product` |
| Build, test, lint, typecheck, debug | `build-and-test` |
| Build a Flint Static template from a URL or screenshot | `design-to-template` |
| Deploy the Flint Static site to Cloudflare Pages or other platforms | `deploy` |

Skills live in `.github/skills/` with references for detailed field lists, examples, and API docs.

---

## Documentation — Deep Dives

| Doc | Covers |
|-----|--------|
| `docs/architecture.md` | System overview, data flow, design decisions |
| `docs/build-system.md` | Build pipeline, Rspack config, dev workflow |
| `docs/content-model.md` | All frontmatter fields, hierarchy, Category vs Labels |
| `docs/templates.md` | Template system, all tags, creating templates |
| `docs/components.md` | Component base class, built-in components |
| `docs/markdown-pipeline.md` | Preprocessing: :::children → :::html → HTMX → marked |
| `docs/ecommerce.md` | Stripe setup, test cards, cart, CI/CD |
| `docs/file-reference.md` | Every source file with exports |

---

## Agent Workflow — Building a Site from a Reference

When a user provides an **image, URL, or description** and asks you to build a site:

1. **Analyse** — Identify pages, sections, nav structure, content types
2. **Plan the content tree** — Map to Markdown files with `Parent`, `Type`, `Order`
3. **Choose or create templates** — Match layouts to existing templates or create new ones
4. **Write content files** — `.md` files with frontmatter and body (use `add-content` skill)
5. **Use `:::children`** for section indexes, `:::html` for custom HTML, HTMX syntax for dynamic links
6. **Create components** only if reusable UI doesn't exist yet (use `add-component` skill)
7. **Write tests** for any new TypeScript code
8. **Build and verify**: `bun run build && bun run test:run`

---

## Code Style

- **TypeScript**: strict mode, `.js` imports, `interface` over `type`, no `any`, explicit return types
- **CSS**: Tailwind utility classes only
- **Testing**: Bun test runner + happy-dom, co-located `*.test.ts`, test-first
- **HTML**: Semantic elements, ARIA labels, `escapeHtml()` on all user strings
