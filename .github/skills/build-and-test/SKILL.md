---
name: build-and-test
description: Build the Flint static site and run tests. Use when compiling Markdown to HTML, running Vitest tests, type-checking, linting, or debugging build/test issues.
---

# Build and Test

Core commands for building the site, running tests, and checking code quality.

## When to Use

- After creating or editing content, templates, or components
- Running or writing Vitest tests
- Checking TypeScript types or linting
- Debugging build or test failures

## Commands

| Command | Purpose |
|---------|---------|
| `npm run build` | Compile all Markdown → HTML in `dist/` |
| `npm run dev` | Start Rspack dev server on port 3000 with HMR |
| `npm run test:run` | Run all Vitest tests once |
| `npm run test` | Run Vitest in watch mode |
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | ESLint |

## Build Pipeline

1. **Scan** — find all `.md` files in `content/`
2. **Parse** — extract YAML frontmatter, compile Markdown
3. **Render** — apply templates and resolve `{{tag}}` placeholders
4. **Output** — write HTML to `dist/`
5. **Assets** — copy `static/` files to `dist/`

```bash
npm run build
```

## Running Tests

```bash
# All tests once
npm run test:run

# Specific file
npm run test:run -- src/core/frontmatter.test.ts

# Pattern match
npm run test:run -- -t "should parse"

# With coverage
npm run test:run -- --coverage
```

Tests are co-located with source files:
```
src/core/
├── frontmatter.ts
├── frontmatter.test.ts
├── markdown.ts
└── markdown.test.ts
```

## Writing Tests

Use Vitest with the `happy-dom` environment:

```typescript
import { describe, it, expect } from 'vitest';
import { MyClass } from './my-class.js';

describe('MyClass', () => {
  it('should do something specific', () => {
    const result = new MyClass().process('input');
    expect(result).toBe('expected');
  });

  it('should handle errors', () => {
    expect(() => new MyClass().process('')).toThrow('Error message');
  });
});
```

**Rules:**
- Co-locate tests: `<name>.test.ts` next to `<name>.ts`
- Write tests first — failing test, then implement
- Use `.js` extension in imports (TypeScript path mapping)
- Descriptive test names that read like documentation

## Pre-commit Checklist

```bash
npm run typecheck && npm run lint && npm run test:run
```

All must pass before committing.

## Troubleshooting

**Tests fail:**
- Check imports use `.js` extension
- Run single file to isolate: `npm run test:run -- src/core/specific.test.ts`
- Focus with `.only`: `describe.only(...)` or `it.only(...)`

**Build fails:**
- Run `npm run typecheck` to find type errors
- Check frontmatter syntax in content files
- Verify `content/` directory exists

**EADDRINUSE error:**
- Server is already running — don't kill it, just inform the user

See `references/debugging.md` for advanced debugging techniques.

## References

- `references/debugging.md` — Test and build debugging, CI pipeline config
