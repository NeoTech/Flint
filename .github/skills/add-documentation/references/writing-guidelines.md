# Writing Guidelines

Formatting conventions for Flint developer documentation in `docs/`.

## Document Structure

Every doc follows this pattern:

```markdown
# Title

One-sentence purpose statement.

## Overview Section

High-level explanation, often with an ASCII diagram.

## Detail Sections

Tables, code examples, and explanations.
```

- Start with `# Title` (single H1)
- One-sentence summary immediately after the title
- Use `##` for major sections, `###` for subsections
- No deeper than `####` — if you need more depth, split the doc

## Tone and Voice

- **Direct**: "Components extend `Component<T>`" not "You might want to extend…"
- **Technical**: Assume TypeScript fluency, don't explain language basics
- **Concise**: Every sentence should earn its place — cut filler words
- **Factual**: State what the system does, not opinions about it
- **Present tense**: "The builder scans…" not "The builder will scan…"

## Code Examples

- Use **real project paths** and **real TypeScript** — never pseudocode
- Include the **import statement** so the reader knows where things come from
- Keep examples **minimal** — show the pattern, not a full implementation
- Use `.js` extension in imports (matches the project's TypeScript path mapping)

```typescript
// ✅ Good — real import, minimal example
import { Component, type ComponentProps } from './component.js';

export class Card extends Component<CardProps> {
  render(): string {
    return `<div>${this.escapeHtml(this.props.title)}</div>`;
  }
}

// ❌ Bad — pseudocode, no import
class Card {
  // ... render something ...
}
```

## Tables

Use tables for:
- Field references (name, type, default, purpose)
- File listings (file, purpose, exports)
- Command summaries (command, what it does)
- Component inventories (component, tag, data source)

Column order convention:
1. **Name/identifier** (field, file, command)
2. **Type** (if applicable)
3. **Default** (if applicable)
4. **Purpose/description** (always last)

```markdown
| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `Short-URI` | `string` | — | Unique page identifier |
```

## ASCII Diagrams

Use for data flows and pipelines. Follow the existing style:

- Box-drawing: `┌ ─ ┐ │ └ ┘ ├ ┤ ┬ ┴ ┼`
- Arrows: `→ ← ↓ ↑ ▶ ▼`
- Connectors: `──▶` for data flow direction
- Labels inside boxes or on arrows
- Align columns for readability

```
source.md          template.html       component.ts
┌──────────┐      ┌──────────────┐    ┌─────────────┐
│ YAML     │──▶   │ {{tag}}      │──▶  │ render()    │
│ + body   │      └──────────────┘    └─────────────┘
└──────────┘
```

## Cross-References

- Link to other docs with relative Markdown links: `[templates.md](templates.md)`
- Link to source files with full paths: `` `src/templates/tag-engine.ts` ``
- When mentioning a concept documented elsewhere, add a link on first occurrence

## What NOT to Include

- **Full source code** — reference the file path, don't copy 50+ lines
- **Tutorials** — docs explain the system, not "how to build your first page"
- **Change history** — use git for that, not prose
- **TODOs or future plans** — docs describe the current state
- **Redundant content** — if it's in another doc, link to it
