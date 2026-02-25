---
name: add-documentation
description: Create or edit Flint Static developer documentation (docs/*.md). Use when adding architecture docs, API references, system deep-dives, or updating existing documentation to reflect code changes.
---

# Add / Edit Documentation

Create or modify developer documentation in `docs/`. These are **internal reference docs** for contributors and AI agents — not site content pages. They explain how the system works, not what the site says.

## Trigger Phrases

- "Document how [system / module] works"
- "Update the docs for [feature]"
- "Write a deep-dive on [topic]"
- "Add API reference for [module]"
- "The docs are out of date for [feature] — update them"
- "Document this architecture decision"
- "Add docs explaining the [pipeline / build system / component model]"

## When to Use

- Adding a new doc for a system area (new module, new integration)
- Updating existing docs after code changes (renamed exports, new fields, changed pipeline)
- Documenting a design decision or architecture pattern
- Adding API reference for new or changed TypeScript modules

## When NOT to Use

- Adding user-facing site pages → use `add-content` skill
- Writing test files → use `build-and-test` skill
- Creating reusable UI → use `add-component` skill
- Adding page layouts → use `add-template` skill

## Existing Docs

| Doc | Covers |
|-----|--------|
| `architecture.md` | System overview, data flow, three-layer design |
| `build-system.md` | Build pipeline, Rspack config, commands |
| `content-model.md` | All frontmatter fields, page types, hierarchy |
| `templates.md` | Template system, all `{{tag}}` placeholders |
| `components.md` | Component base class, all built-in components |
| `markdown-pipeline.md` | Preprocessing stages: `:::children` → `:::html` → HTMX → marked |
| `ecommerce.md` | Stripe setup, cart, product pages, checkout flow |
| `file-reference.md` | Every source file with exports and relationships |

See `references/doc-catalog.md` for detailed descriptions and when to update each.

## Procedure

### 1. Identify which doc to create or update

- **Code change in `src/core/`** → update `architecture.md`, `build-system.md`, or `file-reference.md`
- **New/changed component** → update `components.md` and `file-reference.md`
- **New/changed frontmatter field** → update `content-model.md`
- **New/changed template or tag** → update `templates.md`
- **New/changed Markdown preprocessing** → update `markdown-pipeline.md`
- **New/changed e-commerce feature** → update `ecommerce.md`
- **New module or file** → add entry in `file-reference.md`
- **Entirely new system area** → create a new `docs/<topic>.md`

### 2. Read the current doc

Always read the existing doc before editing. Understand its structure, voice, and level of detail so your changes blend in.

### 3. Write or update

Follow the writing guidelines:

- **Audience**: Developers and AI agents — assume TypeScript fluency
- **Tone**: Direct, technical, concise — no marketing language
- **Structure**: Start with a one-line summary, then use `##` sections
- **Code examples**: Use real project paths and TypeScript — not pseudocode
- **ASCII diagrams**: Use box-drawing characters for data flows (see existing docs for style)
- **Tables**: Use for field references, file listings, command summaries
- **Cross-references**: Link to other docs with `[doc-name.md](doc-name.md)` relative links

See `references/writing-guidelines.md` for formatting conventions and examples.

### 4. Keep docs in sync with code

When updating code, check if any doc references the changed area:

```bash
# Find docs mentioning a function, class, or file
grep -r "resolveTag\|tag-engine" docs/
```

Update all affected docs in the same change. Stale documentation is worse than no documentation.

### 5. Verify

- All code examples compile (mentally or via typecheck)
- All file paths and exports mentioned still exist
- Cross-references link to real docs
- Tables are complete — no missing fields or components

## Constraints

- **No content duplication** — don't copy full code into docs; reference the source file
- **No tutorials** — docs explain _how the system works_, not _how to use the site_
- **No opinions** — state facts and design rationale, not preferences
- **Keep each doc focused** — one topic per file; split if a doc exceeds ~400 lines
- **Update `file-reference.md`** — when adding new source files, always add an entry

## Creating a New Doc

When an area isn't covered by any existing doc:

1. Create `docs/<topic>.md`
2. Start with a `# Title` and one-sentence purpose statement
3. Add a system overview section with an ASCII diagram if applicable
4. Add detailed sections with tables and code examples
5. Update `copilot-instructions.md` Documentation table to include the new doc
6. Cross-reference from related docs

## References

- `references/doc-catalog.md` — Detailed inventory of all docs with content summaries
- `references/writing-guidelines.md` — Formatting conventions, diagram style, table patterns
