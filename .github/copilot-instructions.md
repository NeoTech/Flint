# Copilot Instructions — Flint Static Site Generator

> Lean routing document. Detailed procedures live in **skills** and **docs**.

---

## Agent Rules

- **Never open a new terminal** if there is already an agent-controlled terminal open. Reuse the existing terminal.
- **EADDRINUSE error**: Inform the user the server is already running. Do **not** kill the process.
- **Test-first**: Always write or update tests before implementing features.
- **Build after changes**: Run `bun run build` after content or code changes.

---

## What Is Flint?

A **TypeScript static site generator** that compiles Markdown files into HTML pages using:

- **Markdown + YAML frontmatter** for content
- **HTML templates with `{{tag}}` placeholders** for page layouts
- **TypeScript components** (`Component<T>`) for reusable server-rendered UI
- **HTMX** for client-side interactions · **Tailwind CSS** for styling · **Rspack** for bundling

---

## Commands

| Command | Purpose |
|---------|---------|
| `bun run build` | Compile content/ → dist/ |
| `bun run dev` | Dev server on port 3000 with HMR |
| `bun run test:run` | Run all tests once |
| `bun run test` | Test watch mode |
| `bun run typecheck` | TypeScript type checking |
| `bun run lint` | ESLint |

---

## Separation of Concerns — The Core Rule

Every decision starts with: **which layer does this belong in?**

| Layer | Location | Responsibility |
|-------|----------|----------------|
| **Content** | `content/*.md` | Page text, frontmatter data, `:::children`/`:::html`/HTMX links |
| **Templates** | `templates/*.html` | Page skeleton with `{{tag}}` placeholders — no logic |
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
| Build, test, lint, typecheck, debug | `build-and-test` |

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
