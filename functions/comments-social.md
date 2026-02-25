# Comments & Social Features

**Status:** `[ ] Todo`  
**Complexity:** Low (Giscus) → High (custom Worker + D1)  
**References:** [TODO.md](TODO.md)

User-generated content and social signals for Flint Static blog posts and product pages.

---

## 1. Giscus — Recommended Quickstart

GitHub Discussions-backed comment system. Single `<script>` tag. No backend required.

**How it works:**
- Giscus queries GitHub Discussions to match the embedding page (by `pathname`, URL, `<title>`, or `og:title`)
- On first comment, the giscus bot auto-creates a Discussion
- Visitors authenticate via the giscus GitHub App (OAuth) to post — or comment directly on GitHub
- Comments sync bidirectionally between your site and GitHub Discussions

**Setup steps:**
1. Repo must be **public**
2. Install [giscus GitHub App](https://github.com/apps/giscus) on the repo
3. Enable GitHub Discussions in repo Settings → Features
4. Generate your config at https://giscus.app to get `data-repo-id` and `data-category-id`

**Embed in `themes/default/templates/post.html`:**

```html
<script src="https://giscus.app/client.js"
        data-repo="owner/repo"
        data-repo-id="R_kgDO..."
        data-category="General"
        data-category-id="DIC_kwDO..."
        data-mapping="og:title"
        data-strict="0"
        data-reactions-enabled="1"
        data-emit-metadata="0"
        data-input-position="bottom"
        data-theme="preferred_color_scheme"
        data-lang="en"
        crossorigin="anonymous"
        async>
</script>
```

Use `data-mapping="og:title"` (requires OG tags — see Section 5 below) or `data-mapping="pathname"`.

**Features:** Per-post reactions, threaded replies, dark/light theme auto-detection, lazy loading, multiple localisations, self-hostable.

| | |
|--|--|
| **Complexity** | 🟢 Low — single script tag |
| **Backend** | None (GitHub is the backend) |
| **Requirement** | Public GitHub repo |
| **Privacy** | No tracking, data in GitHub Discussions |
| **Docs** | https://giscus.app · https://github.com/giscus/giscus/blob/main/ADVANCED-USAGE.md |

---

## 2. Utterances — GitHub Issues-backed

Simpler than Giscus but fewer features and unmaintained (last commit ~4 years ago).

```html
<script src="https://utteranc.es/client.js"
        repo="owner/repo"
        issue-term="pathname"
        theme="github-light"
        crossorigin="anonymous"
        async>
</script>
```

**Key differences from Giscus:**

| | Utterances | Giscus |
|--|-----------|-------|
| Storage | GitHub Issues | GitHub Discussions |
| Reactions | Issue-level only | Per-comment + post-level |
| Threaded replies | No | Yes |
| Maintenance | Stale | Actively maintained |

**Migration from Utterances → Giscus:** Convert Issues to Discussions (GitHub feature), then switch the script tag.

**Docs:** https://utteranc.es

---

## 3. Custom Serverless Comments (Worker + D1 + HTMX)

Full control: self-hosted, no GitHub account required, own the data, custom moderation.

### Architecture

```
Browser (HTMX)
  → GET  /api/comments?page=/blog/post    → JSON → render comment list
  → POST /api/comments { page, author, body }  → validate → moderate → D1 insert
```

### D1 Schema

```sql
CREATE TABLE comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  page       TEXT NOT NULL,
  author     TEXT NOT NULL,
  body       TEXT NOT NULL,
  approved   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_comments_page ON comments(page);
```

### Worker Handler

```typescript
interface Env { DB: D1Database; AI: Ai; }

export async function handleComments(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  // GET: List approved comments for a page
  if (request.method === "GET") {
    const page = url.searchParams.get("page") ?? "/";
    const { results } = await env.DB
      .prepare("SELECT author, body, created_at FROM comments WHERE page = ? AND approved = 1 ORDER BY created_at ASC")
      .bind(page)
      .all<{ author: string; body: string; created_at: string }>();

    // Return HTML fragment for HTMX swap
    const html = results.map(c => `
      <div class="border-l-4 border-gray-200 pl-4 py-2">
        <p class="text-sm font-semibold text-gray-700">${esc(c.author)}</p>
        <p class="mt-1 text-gray-600">${esc(c.body)}</p>
        <time class="text-xs text-gray-400">${c.created_at}</time>
      </div>
    `).join("") || '<p class="text-gray-400 text-sm">No comments yet. Be the first!</p>';

    return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
  }

  // POST: Submit a new comment
  if (request.method === "POST") {
    const body = await request.formData();
    const page   = (body.get("page")   as string | null)?.trim() ?? "";
    const author = (body.get("author") as string | null)?.trim() ?? "";
    const text   = (body.get("body")   as string | null)?.trim() ?? "";

    if (!author || !text || author.length > 100 || text.length > 2000) {
      return new Response('<p class="text-red-600">Invalid comment data.</p>', { status: 422 });
    }

    // AI moderation (optional — see Section 4)
    const isSafe = await moderateComment(text, env);
    if (!isSafe) {
      return new Response('<p class="text-red-600">Comment blocked by moderation.</p>', { status: 400 });
    }

    await env.DB
      .prepare("INSERT INTO comments (page, author, body, approved) VALUES (?, ?, ?, ?)")
      .bind(page, author, text, 0)  // approved=0 for manual review, or 1 for auto-approve
      .run();

    return new Response('<p class="text-green-600">Comment submitted for review. Thank you!</p>');
  }

  return new Response("Method Not Allowed", { status: 405 });
}

function esc(s: string): string {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
```

### HTMX integration in Flint Static post template

```html
<!-- Load existing comments -->
<div id="comments"
     hx-get="/api/comments?page={{short-uri}}"
     hx-trigger="load"
     hx-swap="innerHTML">
  <p class="text-gray-400 text-sm">Loading comments…</p>
</div>

<!-- Comment form -->
<form hx-post="/api/comments"
      hx-target="#comment-result"
      hx-swap="innerHTML"
      class="mt-6 space-y-3">
  <input type="hidden" name="page" value="{{short-uri}}">
  <input type="text" name="author" placeholder="Your name" required maxlength="100"
         class="block w-full rounded border-gray-300 shadow-sm">
  <textarea name="body" rows="3" placeholder="Leave a comment…" required maxlength="2000"
            class="block w-full rounded border-gray-300 shadow-sm"></textarea>
  <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
    Post comment
  </button>
</form>
<div id="comment-result"></div>
```

| | |
|--|--|
| **Complexity** | 🔴 High — Worker + D1 schema + moderation + HTMX wiring |
| **Backend** | Cloudflare Worker + D1 database |
| **Cost** | Free tier sufficient for low-medium traffic |
| **D1 docs** | https://developers.cloudflare.com/d1/ |

---

## 4. Workers AI — Comment Moderation

Add automatic content safety filtering to the custom comments Worker.

**Binding setup in `wrangler.toml`:**

```toml
[ai]
binding = "AI"
```

**Moderation function:**

```typescript
async function moderateComment(text: string, env: Env): Promise<boolean> {
  // Fast first pass: sentiment / toxicity classification
  const result = await env.AI.run("@cf/huggingface/distilbert-sst-2-int8", {
    text,
  });
  // result.label is "POSITIVE" or "NEGATIVE"; use as proxy for toxicity
  if (result.label === "NEGATIVE" && result.score > 0.95) return false;

  return true;  // comment passes
}
```

For stronger classification, use `@cf/meta/llama-guard-3-8b`:

```typescript
const safety = await env.AI.run("@cf/meta/llama-guard-3-8b", {
  prompt: `Is this comment safe to publish on a public website? Reply only "safe" or "unsafe".\n\nComment: "${text}"`,
});
if (safety.response?.toLowerCase().includes("unsafe")) return false;
```

**Free tier:** 10,000 neurons/day (shared across all Workers AI calls)  
**Docs:**  
- https://developers.cloudflare.com/workers-ai/models/  
- https://developers.cloudflare.com/workers-ai/models/llama-guard-3-8b

---

## 5. Open Graph + Twitter Card Meta Tags

Social sharing preview cards require OG tags in the `<head>`. Currently missing from Flint Static's `renderHead()`.

### Required tags (add to `src/core/helpers.ts` or equivalent `renderHead()`)

```typescript
// Add to renderHead() in the core builder

// Open Graph
`<meta property="og:title" content="${escHtml(context.title)}">`,
`<meta property="og:description" content="${escHtml(context.description ?? "")}">`,
`<meta property="og:type" content="${context.type === "post" ? "article" : "website"}">`,
`<meta property="og:url" content="${config.siteUrl}${context.url}">`,
context.image
  ? `<meta property="og:image" content="${escHtml(context.image)}">`
  : "",
`<meta property="og:site_name" content="${escHtml(config.siteTitle)}">`,

// Twitter / X Cards
`<meta name="twitter:card" content="${context.image ? "summary_large_image" : "summary"}">`,
`<meta name="twitter:title" content="${escHtml(context.title)}">`,
`<meta name="twitter:description" content="${escHtml(context.description ?? "")}">`,
context.image
  ? `<meta name="twitter:image" content="${escHtml(context.image)}">`
  : "",

// Article-specific (for Type: post)
context.type === "post" && context.date
  ? `<meta property="article:published_time" content="${context.date}T00:00:00Z">`
  : "",
context.type === "post" && context.author
  ? `<meta property="article:author" content="${escHtml(context.author)}">`
  : "",
```

**New frontmatter field needed:** `Image: https://yoursite.com/static/og-image.jpg`  
**New build config fields needed:** `siteUrl`, `siteTitle`  
**Complexity:** 🟢 Low — purely additive changes to `renderHead()`

---

## 6. RSS / Atom Feed Generation

Generate a standard `dist/feed.xml` at build time from all `Type: post` pages.

### Atom 1.0 format (recommended over RSS 2.0)

```typescript
// scripts/build-feed.ts  (or add to scripts/build.ts)
import { readdir } from "fs/promises";

interface FeedPage {
  title: string;
  url: string;
  date: string;
  description: string;
  author: string;
  labels: string[];
  html: string;
}

export async function buildFeed(pages: FeedPage[], config: { siteUrl: string; siteTitle: string }): Promise<string> {
  const updated = pages[0]?.date ? `${pages[0].date}T00:00:00Z` : new Date().toISOString();

  const entries = pages.map(p => `  <entry>
    <title>${escXml(p.title)}</title>
    <link rel="alternate" href="${config.siteUrl}${p.url}"/>
    <id>${config.siteUrl}${p.url}</id>
    <updated>${p.date}T00:00:00Z</updated>
    <published>${p.date}T00:00:00Z</published>
    <author><name>${escXml(p.author)}</name></author>
    <summary type="html">${escXml(p.description)}</summary>
    ${p.labels.map(l => `<category term="${escXml(l)}"/>`).join("\n    ")}
  </entry>`).join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escXml(config.siteTitle)}</title>
  <link href="${config.siteUrl}/"/>
  <link rel="self" href="${config.siteUrl}/feed.xml"/>
  <id>${config.siteUrl}/</id>
  <updated>${updated}</updated>
${entries}
</feed>`;
}

function escXml(s: string): string {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
          .replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}
```

**Add feed autodiscovery to `renderHead()`:**

```html
<link rel="alternate" type="application/atom+xml" href="/feed.xml" title="Feed">
```

**Complexity:** 🟢 Low — pure build-time, no backend  
**Validator:** https://validator.w3.org/feed/

---

## Comparison

| Feature | Complexity | Backend | Cost |
|---------|-----------|---------|------|
| **Giscus** | 🟢 Low | None (GitHub) | Free |
| Utterances | 🟢 Low | None (GitHub) | Free |
| Custom comments (Worker + D1) | 🔴 High | CF Worker + D1 | Free tier |
| Workers AI moderation | 🟡 Medium | CF Worker (above) | Free tier |
| OG / Twitter Card tags | 🟢 Low | None (build-time) | Free |
| RSS/Atom feed | 🟢 Low | None (static file) | Free |

---

## Implementation Plan (Giscus — quickstart)

1. Enable GitHub Discussions on the repo
2. Install giscus GitHub App
3. Generate config at https://giscus.app
4. Add `<script>` block to `themes/default/templates/post.html` (or a new `Comments` Flint Static component)
5. Add OG tags to `renderHead()` so `data-mapping="og:title"` works
6. Add `siteUrl` + `siteTitle` to build config for OG `og:url` and `og:site_name`
7. Add `feed.xml` build step to `scripts/build.ts` for RSS autodiscovery to work with feed readers
