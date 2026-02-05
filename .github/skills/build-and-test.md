# Skill: Build and Test

## Running Tests

### Basic Test Commands

```bash
# Run all tests once
npm run test:run

# Run tests in watch mode (for development)
npm run test

# Run tests with coverage
npm run test:run -- --coverage

# Run specific test file
npm run test:run -- src/core/frontmatter.test.ts

# Run tests matching a pattern
npm run test:run -- -t "should parse"
```

### Test Structure

Tests are co-located with source files:

```
src/
├── core/
│   ├── frontmatter.ts
│   ├── frontmatter.test.ts  <-- Test file
│   ├── markdown.ts
│   └── markdown.test.ts     <-- Test file
```

### Writing Tests

Use the Vitest API:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { MyClass } from './my-class.js';

describe('MyClass', () => {
  let instance: MyClass;
  
  beforeEach(() => {
    instance = new MyClass();
  });
  
  it('should do something specific', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = instance.process(input);
    
    // Assert
    expect(result).toBe('expected output');
  });
  
  it('should handle errors', () => {
    expect(() => instance.process('')).toThrow('Error message');
  });
});
```

### Test Utilities

Available in `src/test/setup.ts`:

```typescript
import { createMockElement, waitFor } from '../test/setup.js';

// Create DOM element from HTML string
const element = createMockElement('<div class="test">Content</div>');

// Wait for async operations
await waitFor(100); // ms
```

## Building the Site

### Development Build

```bash
# Start development server with hot reload
npm run dev

# Server runs on http://localhost:8080
```

### Production Build

```bash
# Build static site to dist/
npm run build

# Output:
# dist/
#   ├── index.html
#   ├── about.html
#   ├── styles.css
#   └── ...
```

### Build Process

1. **Scan**: Find all `.md` files in `content/`
2. **Parse**: Extract frontmatter and compile markdown
3. **Render**: Apply templates and components
4. **Output**: Write HTML to `dist/`
5. **Assets**: Copy static files from `static/`

### Build Configuration

Edit `scripts/build.ts` to customize:

```typescript
const config: BuildConfig = {
  contentDir: join(process.cwd(), 'content'),
  outputDir: join(process.cwd(), 'dist'),
  defaultTitle: 'My Site',
  navigation: [
    { label: 'Home', href: '/' },
    { label: 'About', href: '/about' },
  ],
};
```

## Code Quality

### Type Checking

```bash
# Check TypeScript types
npm run typecheck

# No output = no errors
```

### Linting

```bash
# Check code style
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

### Pre-commit Checklist

Before committing, run:

```bash
npm run typecheck && npm run lint && npm run test:run
```

All must pass before committing.

## Debugging

### Test Debugging

Add `.only` to focus on specific test:

```typescript
describe.only('Feature', () => {
  it.only('should work', () => {
    // Only this test runs
  });
});
```

### Build Debugging

Add console logs to build script:

```typescript
console.log('Processing:', file.relativePath);
console.log('Frontmatter:', result.data);
```

Run with Node inspector:

```bash
node --inspect-brk node_modules/.bin/tsx scripts/build.ts
```

## Continuous Integration

### CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test:run
      - run: npm run build
```

## Troubleshooting

### Tests Fail

1. Check if implementation matches test expectations
2. Verify imports use `.js` extension
3. Check for async issues - use `await` properly
4. Run single test file to isolate: `npm run test:run -- src/core/specific.test.ts`

### Build Fails

1. Ensure `content/` directory exists
2. Check markdown syntax in content files
3. Verify all imports are valid
4. Check for TypeScript errors: `npm run typecheck`

### Hot Reload Not Working

1. Check Rspack dev server is running
2. Verify file is in watched directory
3. Check browser console for errors
4. Hard refresh browser (Ctrl+F5)

## Best Practices

1. **Always test first** - Write failing test, then implement
2. **Small commits** - Commit after each passing test
3. **Descriptive names** - Tests should read like documentation
4. **Isolate tests** - Each test should be independent
5. **Test edge cases** - Empty inputs, errors, boundaries
6. **Keep builds fast** - Optimize when build time > 10s
