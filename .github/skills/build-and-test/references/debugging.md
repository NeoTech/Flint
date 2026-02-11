# Debugging & CI

## Test Debugging

Focus on a specific test with `.only`:

```typescript
describe.only('Feature', () => {
  it.only('should work', () => {
    // Only this test runs
  });
});
```

Remove `.only` before committing.

## Build Debugging

Add console logs to `scripts/build.ts`:

```typescript
console.log('Processing:', file.relativePath);
console.log('Frontmatter:', result.data);
```

Run with Node inspector:

```bash
node --inspect-brk node_modules/.bin/tsx scripts/build.ts
```

## Test Utilities

Available in the test environment (`happy-dom`):

```typescript
import { createMockElement, waitFor } from '../test/setup.js';

const element = createMockElement('<div class="test">Content</div>');
await waitFor(100); // ms
```

## Continuous Integration

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run typecheck
      - run: bun run lint
      - run: bun run test:run
      - run: bun run build
```

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Cannot find module` | Missing `.js` extension in import | Add `.js` to import path |
| `EADDRINUSE` | Port 3000 already in use | Server already running, don't restart |
| Hot reload broken | File not in watched directory | Hard refresh (Ctrl+F5), check console |
| Async test fails | Missing `await` | Ensure async operations are awaited |
| Build output stale | Forgot to rebuild | Run `bun run build` |
