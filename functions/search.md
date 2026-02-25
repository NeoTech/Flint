# Full-Text Search

**Status:** `[ ] Todo`  
**Complexity:** Low (Pagefind) → High (Workers AI)  
**References:** [TODO.md](TODO.md)

Add search to a Flint Static site. Options range from zero-infrastructure client-side WASM to edge AI semantic search.

---

## Recommended: Pagefind

A Rust-compiled binary that crawls the built `dist/` HTML and generates a WASM-based search index. Zero server required — everything lives in `dist/pagefind/`.

**Why Pagefind for Flint Static:**
- Runs as a post-build step, writes output back into `dist/` — perfect for `bun run build`
- Fully static — deploy `dist/` to Cloudflare Pages as normal, no new services
- Node/Bun API integrates directly into `scripts/build.ts`
- Free, MIT open source, actively maintained (v1.x)

### Build integration

```bash
bun add -d pagefind
```

Add to the end of `scripts/build.ts`:

```typescript
import * as pagefind from "pagefind";

const { index } = await pagefind.createIndex();
await index.addDirectory({ path: "dist" });
await index.writeFiles({ outputPath: "dist/pagefind" });
await pagefind.close();
```

Or as a separate CLI step after build:

```bash
bunx pagefind --site dist
```

### Template integration

Add to the `<head>` of `themes/default/templates/*.html` (or a Flint Static component):

```html
<link href="/pagefind/pagefind-ui.css" rel="stylesheet">
<script src="/pagefind/pagefind-ui.js"></script>
```

Add the search widget wherever you want search — e.g. in the navigation component:

```html
<div id="search"></div>
<script>
  window.addEventListener("DOMContentLoaded", () => {
    new PagefindUI({ element: "#search", showSubResults: true });
  });
</script>
```

### Content annotation

Add `data-pagefind-body` to your main content element so Pagefind knows what to index:

```html
<!-- In themes/default/templates/post.html -->
<article data-pagefind-body>
  {{body}}
</article>
```

Add `data-pagefind-ignore` to exclude navigation, headers, footers:

```html
<nav data-pagefind-ignore>...</nav>
```

### Summary

| Property | Value |
|----------|-------|
| Build step | `await index.addDirectory({ path: "dist" })` at end of build script |
| Runtime | Client-side WASM — no server, no Worker |
| Files added to `dist/` | `dist/pagefind/**` (index shards + WASM) |
| Complexity | 🟢 Low |
| Pricing | Free, MIT |
| Docs | https://pagefind.app/docs/ |
| Node API | https://pagefind.app/docs/node-api/ |

---

## Option 2: Orama (TypeScript-native)

Pure TypeScript search engine — full-text, vector, and hybrid search. Open-source client library or managed cloud service.

### Open-source (fully static)

Write a build script that reads compiled pages and generates a JSON index:

```typescript
// scripts/build-search-index.ts  (run after bun run build)
import { create, insert, save } from "@orama/orama";

const db = await create({
  schema: { title: "string", body: "string", url: "string" } as const,
});

for (const page of compiledPages) {
  await insert(db, { title: page.title, body: page.plainText, url: page.url });
}

const serialized = JSON.stringify(await save(db));
await Bun.write("dist/search-index.json", serialized);
```

Client-side query:

```typescript
import { create, load, search } from "@orama/orama";

const raw = await fetch("/search-index.json").then(r => r.json());
const db = await create({ schema: { title: "string", body: "string", url: "string" } as const });
await load(db, raw);
const results = await search(db, { term: query });
```

### Cloud tier

Managed index with AI Answer Engine, analytics, and auto-sync. Free tier: 2 projects, 500 docs, 500 AI sessions/month.

**Pricing:** Free → $100/month (Build) → $1,450/month (Scale)  
**Docs:** https://docs.orama.com/docs/orama-js  
**GitHub:** https://github.com/oramasearch/orama

---

## Option 3: Algolia

Hosted Search-as-a-Service — best analytics and relevance tuning.

### Standard (self-managed index)

Push page data to Algolia after build:

```typescript
import algoliasearch from "algoliasearch";

const client = algoliasearch(env.ALGOLIA_APP_ID, env.ALGOLIA_ADMIN_KEY);
const index = client.initIndex("flint_pages");
await index.saveObjects(records);
```

**Pricing:** Free tier: 10K requests/month, 1M records. Overage: $0.50/1K requests, $0.40/1K records.  
**Env vars:** `ALGOLIA_APP_ID`, `ALGOLIA_ADMIN_KEY`, `ALGOLIA_SEARCH_KEY` (public, safe to embed)

### DocSearch (free for qualifying sites)

Algolia runs a hosted crawler weekly. Apply at https://docsearch.algolia.com/. Requirements: public site, technical documentation content, "Search by Algolia" attribution. No build step changes needed.

**Docs:** https://docsearch.algolia.com/docs/what-is-docsearch

---

## Option 4: Cloudflare Workers AI + Vectorize

Semantic/natural-language search at the edge. Requires a Worker at query time — not purely static.

### Architecture

```
Build time:
  Markdown content → Workers AI embedding model → Vectorize index

Query time (Worker):
  Browser → /api/search?q=... → Worker
    → Workers AI: embed query text
    → Vectorize: nearest-neighbor search
    → Return matched pages
```

### Build-time indexing

```typescript
// scripts/index-search.ts
const ACCOUNT_ID = process.env.CF_ACCOUNT_ID!;
const API_TOKEN  = process.env.CF_API_TOKEN!;

async function embedText(text: string): Promise<number[]> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/@cf/baai/bge-small-en-v1.5`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: [text] }),
    }
  );
  const { result } = await res.json<{ result: { data: number[][] } }>();
  return result.data[0];
}

// Then upsert into Vectorize index via REST API
```

### Query Worker

```typescript
export default {
  async fetch(request: Request, env: Env) {
    const { q } = Object.fromEntries(new URL(request.url).searchParams);
    // embed query
    const vector = await env.AI.run("@cf/baai/bge-small-en-v1.5", { text: [q] });
    // query Vectorize
    const results = await env.VECTORIZE.query(vector.data[0], { topK: 10, returnMetadata: "all" });
    return Response.json(results.matches.map(m => m.metadata));
  },
};
```

**Pricing:** Workers AI: 10K neurons/day free. Vectorize: 30M queried dimensions/month free.  
**Complexity:** 🔴 High  
**Docs:**  
- https://developers.cloudflare.com/workers-ai/  
- https://developers.cloudflare.com/vectorize/

---

## Option 5: Fuse.js — Simplest, small sites only

Pure JavaScript fuzzy search. Entire index loaded into browser memory.

```typescript
// Build step — write dist/search-index.json
const index = pages.map(p => ({ title: p.title, body: p.plainText, url: p.url }));
await Bun.write("dist/search-index.json", JSON.stringify(index));

// Client
import Fuse from "fuse.js";
const data = await fetch("/search-index.json").then(r => r.json());
const fuse = new Fuse(data, { keys: ["title", "body"], threshold: 0.3, ignoreLocation: true });
const results = fuse.search(query);
```

**Caveat:** Whole index loads into RAM — scales poorly past ~200 pages. Fuzzy algorithm produces worse relevance than Pagefind/Orama on long body text.

**Complexity:** 🟢 Low · **Free, MIT** · https://www.fusejs.io/

---

## Comparison

| | Pagefind | Orama (OSS) | Algolia | CF Vectorize | Fuse.js |
|--|---------|------------|---------|-------------|---------|
| Search type | Full-text | Full-text + vector | Full-text + AI | Semantic vector | Fuzzy |
| Runtime | Client WASM | Client JS | Cloud API | CF Worker | Client JS |
| Build step | Node API in `scripts/build.ts` | Custom indexer | Index push script | Embedding script | Custom JSON writer |
| Fully static | ✅ | ✅ | ✅ (browser calls Algolia) | ❌ (needs Worker) | ✅ |
| Complexity | 🟢 Low | 🟢 Low | 🟡 Medium | 🔴 High | 🟢 Low |
| Pricing | Free | Free / $0–$1,450+/mo | Free tier / DocSearch | Free tier | Free |
| Result quality | Excellent | Excellent | Excellent + analytics | Semantic/AI | Acceptable (<200 pages) |

---

## Implementation Plan (Pagefind)

1. `bun add -d pagefind` in project root
2. Add Pagefind build step to end of `scripts/build.ts`
3. Add `data-pagefind-body` attribute to the main content element in all templates under `themes/default/templates/`
4. Add `data-pagefind-ignore` to navigation, header, footer elements
5. Create a `SearchBar` component (`src/components/search-bar.ts`) that renders the pagefind UI script tags + widget div
6. Register `{{search-bar}}` in `src/index.ts` and add to relevant templates
7. Run `bun run build` — verify `dist/pagefind/` is generated
8. Verify search works locally: `bun run dev` → open site → test search
