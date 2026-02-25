# Build System

Flint Static has two build pipelines that work together:

1. **Site build** (`bun run build`) — Bun script that compiles Markdown → HTML
2. **Asset build** (`bun run dev`) — Rspack that bundles TypeScript + CSS for the browser

**Runtime:** [Bun](https://bun.sh) — used for package management (`bun install`), running build scripts (native TypeScript execution, no `tsx` needed), and launching Rspack.

## Commands

| Command | What it does | When to use |
|---|---|---|
| `bun run build` | Compile all Markdown to `dist/` + copy static assets | Before deploying |
| `bun run dev` | Start Rspack dev server with HMR on port 3000 | During development |
| `bun run build:sync` | Stripe sync + site compile | After changing `products.yaml` |
| `bun run build:sync:force` | Force-recreate all Stripe Payment Links + compile | Full Stripe reset |
| `bun run deploy:cloudflare:pages` | Deploy static site to Cloudflare Pages (Direct Upload API) | After a build |
| `bun run deploy:checkout:cloudflare` | Deploy Cloudflare Worker (checkout server) via wrangler | After changing checkout function |
| `bun run test` | Run tests in watch mode | While writing code |
| `bun run test:run` | Run all tests once | Before committing |
| `bun run typecheck` | TypeScript type checking (`tsc --noEmit`) | Before committing |
| `bun run lint` | ESLint check | Before committing |
| `bun run lint:fix` | ESLint auto-fix | To clean up |

## Site Build Pipeline

**Entry point:** `scripts/build.ts`  
**Engine:** `src/core/builder.ts` → `SiteBuilder`

### What happens during `bun run build`

```
1. Create SiteBuilder with config
       ↓
2. mkdirSync(dist/)
       ↓
3. scanContent()
   └── Recursively walk content/ for *.md files
   └── Returns ContentFile[] with path, relativePath, name
       ↓
4. generateNavigation()
   └── Read all content files
   └── Filter pages with Parent: root
   └── Sort by Order, then title
   └── Returns NavItem[]
       ↓
5. For each content file:
   │
   ├── Read file from disk
   ├── processFile()
   │   ├── processMarkdown() → { html, data, path }
   │   │   └── compileWithFrontmatter()
   │   │       ├── parseFrontmatter()   (gray-matter)
   │   │       └── compile()            (preprocessing + marked)
   │   └── getOutputPath()              (clean URL mapping)
   │
   ├── Mark active nav item
   │
   ├── renderPage()
   │   ├── Navigation.render()          (top bar HTML)
   │   └── Layout.render()              (full document shell)
   │
   └── writeFileSync(dist/path/index.html)
       ↓
6. copyStaticAssets()
   └── Recursively copy static/ → dist/
```

### Output Path Mapping

The builder uses the page's `Short-URI` as the output directory, producing flat clean URLs:

| Content File | Short-URI | Output File | URL |
|---|---|---|---|
| `content/index.md` | *(any)* | `dist/index.html` | `/` |
| `content/about.md` | `about` | `dist/about/index.html` | `/about` |
| `content/htmx.md` | `htmx-demo` | `dist/htmx-demo/index.html` | `/htmx-demo` |
| `content/blog/index.md` | `blog` | `dist/blog/index.html` | `/blog` |
| `content/blog/post.md` | `getting-started` | `dist/getting-started/index.html` | `/getting-started` |

**Key rules:**
- `content/index.md` is always the site root `/`, regardless of Short-URI.
- All other pages use their `Short-URI` as the URL path — the file's location in `content/` is irrelevant to the URL.
- If no `Short-URI` is set, the builder falls back to the filename stem (or directory name for `**/index.md` files).

### Build Configuration

```typescript
interface BuildConfig {
  contentDir: string;     // Where to find Markdown files
  outputDir: string;      // Where to write HTML files
  navigation?: NavItem[]; // Optional hardcoded nav (overrides auto-generation)
  defaultTitle?: string;  // Fallback title for pages without one
}
```

Default config in `scripts/build.ts`:

```typescript
{
  contentDir: join(process.cwd(), 'content'),
  outputDir: join(process.cwd(), 'dist'),
  defaultTitle: 'My Static Site',
}
```

## Deploy Pipeline

### Cloudflare Pages — Direct Upload API

**Script:** `scripts/deploy-pages.ts`  
**Command:** `bun run deploy:cloudflare:pages`

Deploys the compiled `dist/` directory to Cloudflare Pages using the CF Direct Upload API — no wrangler subprocess. This is more reliable in non-TTY contexts (manager SSE runner, CI pipelines) and avoids local hash-cache drift.

#### Required env vars (in `.env`)

| Variable | Description |
|---|---|
| `CLOUDFLARE_API_TOKEN` | CF API token with Pages write permission (recommended) |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `CF_PAGES_PROJECT` | Pages project name (e.g. `my-flint-site`) |
| `CF_PAGES_DIR` | Directory to deploy (default: `dist`) |

Alternatively, `CLOUDFLARE_GLOBAL_API_KEY` + `CLOUDFLARE_EMAIL` can substitute for the API token.

#### How it works

```
1. Read CF_PAGES_PROJECT + CF_PAGES_DIR from .env
       ↓
2. Scan dist/ — compute MD5 hash for every file
       ↓
3. Ensure the Pages project exists (create it if not)
       ↓
4. GET upload JWT — short-lived token from CF for asset uploads
       ↓
5. POST check-missing → CF returns which hashes it doesn't have
       ↓
6. Upload only the missing files in batches of 50
       ↓
7. Upsert all hashes — tell CF the full file set for this deployment
       ↓
8. POST create deployment with full manifest
   → CF builds the deployment and assigns a preview URL
```

Incremental by design — only new or changed files are uploaded on each run.

### Cloudflare Worker (checkout server)

**Script:** `scripts/deploy-cloudflare.ts`  
**Command:** `bun run deploy:checkout:cloudflare`

Deploys `functions/checkout-cloudflare.ts` as a Cloudflare Worker via wrangler. Separate from the Pages deploy — this is for the serverless checkout handler, not the static site.

## Template Engine

**Module:** `src/core/template.ts`

The `TemplateEngine` sits between the Markdown compiler and the final HTML output. It:

1. Receives pre-compiled HTML content
2. Wraps it with a `Navigation` component (if navigation items are provided)
3. Wraps everything in the `Layout` component (full HTML document)

```typescript
templateEngine.renderPage({
  title: 'My Page',
  description: 'Page description for SEO',
  content: '<h1>Hello</h1><p>World</p>',    // Already-compiled HTML
  path: 'blog/post.md',
  frontmatter: { title: 'My Page', ... },
  navigation: [
    { label: 'Home', href: '/', active: false },
    { label: 'Blog', href: '/blog', active: true },
  ],
});
```

The template engine also supports:
- **Custom components** — `registerComponent(name, fn)` / `renderComponent(name, props)`
- **Partial rendering** — `renderPartial(markdown)` compiles Markdown without the layout wrapper

## Asset Build (Rspack)

**Config:** `rspack.config.ts`

Rspack handles the **browser-side bundle** — it compiles `src/index.ts` into JS and CSS files that the HTML pages reference.

### What Rspack Builds

| Input | Output | Contents |
|---|---|---|
| `src/index.ts` | `dist/assets/main.js` | HTMX library (bundled offline) |
| `src/styles/main.css` | `dist/assets/main.css` | Tailwind CSS (processed via PostCSS) |

### Key Configuration

```
Entry:          src/index.ts
Output:         dist/assets/main.js, dist/assets/main.css
TypeScript:     builtin:swc-loader (Rust-based, fast)
CSS:            postcss-loader → css-loader → CssExtractRspackPlugin
Static files:   CopyRspackPlugin copies static/ → dist/static/
Clean:          Disabled (dist/ is shared with the site builder)
```

### Dev Server

```
Port:           3000
Static dir:     dist/ (serves the site builder's HTML output)
HMR:            Enabled for CSS/JS changes
allowedHosts:   'all' (supports ngrok tunnels)
WebSocket:      Auto-detect host for HMR through proxies
```

The `historyApiFallback` rewrites handle clean URLs during development:

```typescript
historyApiFallback: {
  rewrites: [
    { from: /^\/$/, to: '/index.html' },
    { from: /^\/about\/?$/, to: '/about/index.html' },
    { from: /^\/blog\/(.*)$/, to: '/blog/$1/index.html' },
  ],
}
```

## Development Workflow

### Typical flow

```bash
# Terminal 1: Build the site from Markdown
bun run build

# Terminal 2: Start the dev server (serves dist/ with HMR for CSS/JS)
bun run dev

# Terminal 3 (optional): Expose via ngrok
ngrok http 3000
```

### Making content changes

1. Edit a `.md` file in `content/`
2. Run `bun run build` to regenerate `dist/`
3. The dev server serves the new HTML immediately (static file serving)

### Making style/JS changes

1. Edit `src/styles/main.css` or `src/index.ts`
2. Rspack's HMR updates the browser automatically

## Static Assets

The `static/` directory is copied verbatim to `dist/` during build. Use it for:

- HTML fragments served by HTMX (`static/fragments/*.html`)
- Images, fonts, downloads
- Any file that should be served as-is

## Manager Build API

The Flint Static Manager exposes SSE endpoints that drive the build and deploy UI. All responses are Server-Sent Events so the browser can stream log output in real time.

| Route | What it does |
|---|---|
| `POST /sites/:id/build` | Runs `bun run build` — site compile only |
| `POST /sites/:id/build/test` | Runs `bun run test:run` |
| `POST /sites/:id/deploy/:target` | Deploys to the named target (e.g. `cloudflare`) — no build step |
| `POST /sites/:id/build-and-deploy/:target` | Builds then deploys in a single streaming SSE sequence |

The UI presents a **"Build + Deploy"** button (triggers `build-and-deploy`) and a separate **"Build only"** button at the bottom of the Build page.

## Testing

**Framework:** Bun test runner with happy-dom environment

```
30 test files
401 tests
Co-located: every *.ts module has a matching *.test.ts
```

Tests run in happy-dom (a lightweight DOM implementation) so components that use `document.createElement` work in Node.js.

### Test structure

```typescript
import { describe, it, expect } from 'bun:test';

describe('ModuleName', () => {
  it('should do the expected thing', () => {
    // Arrange
    const input = '...';
    // Act
    const result = someFunction(input);
    // Assert
    expect(result).toContain('expected');
  });
});
```
