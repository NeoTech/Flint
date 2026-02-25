---
title: Static Site Hosting
Short-URI: hosting
Template: default
Type: page
Parent: root
Order: 5
Category: Documentation
Labels: [hosting, deployment, cloudflare, vercel, netlify, github-pages]
Author: System
Date: 2026-02-24
Description: Compare static site hosting platforms for Flint Static sites — GitHub Pages, Cloudflare Pages, Vercel, and Netlify — including configuration tokens, serverless capability, and checkout mode compatibility.
Keywords: [static hosting, deployment, github pages, cloudflare pages, vercel, netlify, serverless, payment links]
---

Flint Static compiles your content, templates, and components into a self-contained set of plain HTML, CSS, and JavaScript files written to the `dist/` directory. Because the output contains no server-side logic, it can be served from any host capable of delivering static assets — a CDN edge network, a simple object store, or a traditional web server. This keeps hosting costs low, deployment simple, and page-load performance high.

The critical decision when choosing a hosting platform is which checkout mode your site uses. In **payment-links** mode, Flint Static embeds Stripe Payment Links directly into product pages; no server-side code runs at purchase time, and the entire site remains fully static. Any platform that can serve the `dist/` folder is compatible. In **serverless** mode, a Bun HTTP function (or its Cloudflare Worker equivalent) must run alongside the static site to handle cart sessions, create Stripe PaymentIntents, and process webhooks. This mode requires a platform that provides a serverless runtime — not all static hosts qualify. Choosing the wrong platform for serverless mode means checkout will be unavailable at runtime.

This page covers four platforms and their suitability for both modes. **GitHub Pages** is the simplest option and supports payment-links mode only. **Cloudflare Pages** pairs static asset delivery with **Cloudflare Workers**, making it the recommended platform for serverless mode; deployment uses the Direct Upload API configured via **`CLOUDFLARE_ACCOUNT_ID`**, **`CLOUDFLARE_API_TOKEN`**, and **`CF_PAGES_PROJECT`**. **Vercel** and **Netlify** both offer integrated serverless function runtimes and are viable alternatives for teams already invested in those ecosystems, each with their own environment variable conventions and deployment API conventions.

Each platform section below documents the required environment variables, the exact deploy command to use, any platform-specific configuration files, and a compatibility summary for payment-links and serverless checkout modes. Read the section for your target platform in full before running a first deploy.

---

## Platform Comparison

| Platform | Static hosting | Serverless functions | Checkout mode | Free tier | Required env vars |
|---|---|---|---|---|---|
| GitHub Pages | ✅ | ❌ No runtime | Payment-links only | Unlimited requests (public repos) | `GH_TOKEN`, `GH_REPO` |
| Cloudflare Pages | ✅ | ✅ Workers (edge) | Both | 500 deploys/mo, 100k Worker req/day | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_GLOBAL_API_KEY` + `CLOUDFLARE_EMAIL`, `CF_PAGES_PROJECT` |
| Vercel | ✅ | ✅ Serverless + Edge | Both | 100 deploys/day, 1M function req/mo | `VERCEL_TOKEN` |
| Netlify | ✅ | ✅ Lambda-backed | Both | 100 deploys/day, 125k function req/mo | `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID` |

### Choosing a platform

If you use **payment-links** checkout mode, any of the four platforms works. GitHub Pages is the simplest option — there is no function runtime to configure, and deploys require only a token and repo name.

If you use **serverless** checkout mode, choose one of the three platforms that support a function runtime: **Cloudflare Pages + Workers** (edge-deployed, lowest global latency), **Vercel** (straightforward setup with Node/Bun runtime support), or **Netlify** (atomic static + function deploys backed by AWS Lambda). GitHub Pages does not support a server runtime and cannot host the checkout function.

The env vars listed above are set in the site `.env` file. Flint Static Manager reads them automatically when you trigger a deploy from the Build page, so no manual copy-paste into a dashboard is required.

---

## GitHub Pages

Static files only, hosted directly from a Git repository. No server-side runtime is available. Content is CDN-distributed via GitHub's global infrastructure.

### Checkout mode compatibility

- ✅ **Payment-links mode** — Stripe handles the checkout server; no function runtime needed. GitHub Pages serves the static UI perfectly.
- ❌ **Serverless mode** — GitHub Pages cannot execute server-side code. A Bun or Worker function cannot run here. Use a different platform if you need the serverless checkout.

### How it works

Flint Static's `dist/` folder is pushed to the `gh-pages` branch (or whichever branch is configured in the repository's Pages settings). GitHub serves the site at `https://<username>.github.io/<repo>`, or at a custom domain if one is configured. Deploys are triggered via Flint Static Manager as an SSE stream, which runs the `ghpages` deploy script behind the scenes.

### Configuration

| Variable | Required | Description |
|---|---|---|
| `GH_TOKEN` | ✅ Yes | GitHub Personal Access Token (classic) with `repo` scope (which includes `pages` write) — or a fine-grained token with "Pages" read & write permission on the target repository. |
| `GH_REPO` | ✅ Yes | Target repository in `owner/repo` format, e.g. `acme/my-site`. |

**Creating a `GH_TOKEN`**

For a classic token: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token → tick the `repo` scope → copy the token immediately (it will not be shown again).

For a fine-grained token: GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token → select the target repository → under Repository permissions set Pages to **Read and Write** → generate and copy.

**Free tier** — GitHub Pages is entirely free for public repositories. Private repositories require a GitHub paid plan (Team or Enterprise).

**Custom domains** — Add a `CNAME` file to `dist/` containing your domain, or configure the custom domain in the repository's Pages settings. HTTPS is provisioned automatically via Let's Encrypt.

**Limitations**

- No server-side execution — static files only.
- 1 GB published site size limit per repository.
- 100 GB/month soft bandwidth limit.
- Builds are limited to 10 per hour when using GitHub Actions; Flint Static's direct-push method does not count against this limit.

---

## Cloudflare Pages + Workers

Cloudflare Pages serves static assets from a global CDN (330+ PoPs). Cloudflare Workers is a V8-isolate serverless runtime that runs at the edge. Together they form a full-stack deployment for Flint Static sites.

### Checkout mode compatibility

- ✅ **Payment-links mode** — Deploy with Pages only. No Worker needed.
- ✅ **Serverless mode** — Deploy Pages (static site) + a Cloudflare Worker (checkout function) together. The Worker handles cart/payment API calls; Pages serves the UI.

### How it works

Two completely separate deploy steps:

1. `bun run deploy:cloudflare:pages` → uploads `dist/` to Cloudflare Pages via the Direct Upload API (no wrangler needed, uses raw fetch).
2. `bun run deploy:checkout:cloudflare` → bundles and uploads the checkout Worker via `wrangler deploy`, then sets Worker secrets.

### Cloudflare Pages configuration

| Variable | Required | Description |
|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | ✅ Yes | Your Cloudflare account ID. Found in the Cloudflare dashboard right sidebar or in the `https://dash.cloudflare.com/` URL after login. A 32-character hex string. |
| `CLOUDFLARE_GLOBAL_API_KEY` | Either/Or | Legacy Global API Key — full account access. Found: Cloudflare Dashboard → My Profile → API Tokens → Global API Key. Must be used together with `CLOUDFLARE_EMAIL`. |
| `CLOUDFLARE_EMAIL` | With Global Key | The email address of your Cloudflare account. Required when using `CLOUDFLARE_GLOBAL_API_KEY`. |
| `CLOUDFLARE_API_TOKEN` | Either/Or | Scoped API Token (recommended). Create at Cloudflare Dashboard → My Profile → API Tokens → Create Token. Use the "Edit Cloudflare Workers" template or a custom token with `Account:Cloudflare Pages:Edit` permission. |
| `CF_PAGES_PROJECT` | ✅ Yes | The Cloudflare Pages project name (slug), e.g. `my-site`. Created automatically on first deploy if it does not already exist. |
| `CF_PAGES_DIR` | Optional | Directory to deploy. Defaults to `dist` if not set. |

**Token type guidance**

- `CLOUDFLARE_GLOBAL_API_KEY` + `CLOUDFLARE_EMAIL` — easy to set up, but grants full account access. Suitable for personal projects.
- `CLOUDFLARE_API_TOKEN` (scoped) — recommended for production or shared environments. Requires the `Account > Cloudflare Pages > Edit` permission for Pages deploys. Format: a 40-character string created at `dash.cloudflare.com/profile/api-tokens`.

### Cloudflare Workers configuration (serverless checkout only)

| Variable | Required | Description |
|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | ✅ Yes | Same account ID as above. |
| `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_WORKERS_TOKEN` | ✅ Yes | API token with `Account > Workers Scripts > Edit` permission. Can be the same scoped token used for Pages if it includes both permissions. |
| `CF_WORKER_NAME` | Optional | Name of the Worker script. Defaults to `flint-checkout`. |
| `CF_WORKER_MAIN` | Optional | Entry point file of the Worker. Defaults to `functions/checkout-cloudflare.ts`. |
| `CF_WORKER_COMPAT_DATE` | Optional | Compatibility date for the Workers runtime, e.g. `2024-09-23`. Controls which runtime behaviours are active. |
| `CLOUDFLARE_ZONE_ID` | Optional | Cloudflare Zone ID of your domain — only needed for custom domain routing via a Worker route. |
| `CLOUDFLARE_WORKER_ROUTE` | Optional | Route pattern to add, e.g. `checkout.example.com/*`. Only used when `CLOUDFLARE_ZONE_ID` is also set. |

The deploy script also sets these as **Worker secrets** (not `.env` vars — they are pushed directly to the Worker via `wrangler secret put`):

- `STRIPE_SECRET_KEY` — your Stripe secret key.
- `SITE_URL` — the live site URL, derived from `CLOUDFLARE_SITE_URL` override or `SITE_URL` + `BASE_PATH`.

### Free tier

- **Pages:** Unlimited static requests, 500 deployments/month, 20,000 files per deployment (each file up to 25 MB), 1 build/minute.
- **Workers:** 100,000 requests/day on the free plan, 10 ms CPU time per invocation. The `workers.dev` subdomain is free.

### Custom domains

Configured in the Cloudflare Pages dashboard or via the API. DNS must be managed through Cloudflare, or a CNAME pointed at `<project>.pages.dev`.

---

## Vercel

Vercel is a hybrid platform offering global static CDN delivery and serverless/edge functions. Flint Static deploys pre-built static output from `dist/` directly via the Vercel REST API — no Vercel CLI dependency needed in automated contexts.

### Checkout mode compatibility

- ✅ **Payment-links mode** — Deploy the static `dist/` output. No functions required.
- ✅ **Serverless mode** — Vercel Functions (placed in an `api/` directory) run alongside the static site. Supports Node.js, Bun, and Edge runtimes.

### How it works

Flint Static Manager triggers a deploy via the Vercel REST API (`POST https://api.vercel.com/v13/deployments`) with `target: "production"`. Files from `dist/` are uploaded directly — no wrangler or Vercel CLI needed.

For non-Git deploys (Flint Static's approach): files are hashed with SHA256, uploaded to Vercel's file store, and referenced in the deployment payload. `projectSettings.framework` is set to `null` (Vercel's "Other" preset — no framework detection, no build step executed on Vercel's side).

### Configuration

| Variable | Required | Description |
|---|---|---|
| `VERCEL_TOKEN` | ✅ Yes | Personal Access Token from `vercel.com/account/tokens`. Opaque string — no fixed prefix or format. Used as `Authorization: Bearer <VERCEL_TOKEN>`. |
| `VERCEL_TEAM_ID` | Optional | Team ID (format: `team_...`). Required when deploying to a team account instead of a personal account. Passed as `?teamId=<id>` query parameter on all API calls. |
| `VERCEL_PROJECT_ID` | Optional | Existing Vercel project ID to deploy into. If omitted, a project is created using the deployment `name` field. |

**Creating a `VERCEL_TOKEN`**

Vercel Dashboard → Account Settings → Tokens → Create. Name the token (e.g. `flint-deploy`), set scope to "Full Account" or restrict to a specific team. Copy immediately — shown only once. Token has no fixed format (opaque bearer string).

### `vercel.json` configuration

Place `vercel.json` in the project root:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": null,
  "outputDirectory": "dist",
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

Key fields:

- `"framework": null` — tells Vercel this is a pre-built static site; disables framework detection and build execution on Vercel's side.
- `"outputDirectory": "dist"` — matches Flint Static's build output directory.
- `"cleanUrls": true` — removes `.html` extensions from URLs (e.g. `/about` instead of `/about.html`).
- `"trailingSlash": false` — strips trailing slashes, issuing 308 redirects.

### Hobby (free) tier limits

| Limit | Value |
|---|---|
| Deployments per day | 100 |
| Deployments per hour | 100 |
| Concurrent builds | 1 |
| Static file upload | 100 MB |
| Source files per deployment | 15,000 |
| Fast Data Transfer | 100 GB/month |
| Function max duration | 60 seconds |
| Function regions | Single region only |
| Runtime log retention | 1 hour |
| Git repos | Personal only (no org repos) |

**Notable:** Organization Git repos require a Pro plan. For Flint Static's direct API upload approach, Git organization restrictions do not apply.

### Functions (serverless checkout)

Place the checkout handler at `api/checkout.ts` in the project root. Vercel auto-detects files in the `api/` directory and deploys them as serverless functions. Supports the Bun runtime via `"runtime": "nodejs22.x"` or the Edge runtime. Function invocations are included on the Hobby tier (1 million/month).

---

## Netlify

Netlify is a static hosting + serverless functions platform. Static sites are deployed via their REST API using either a ZIP upload or a file-digest method. Functions are co-deployed alongside the static site, version-controlled with it, and roll back together on restore.

### Checkout mode compatibility

- ✅ **Payment-links mode** — Deploy only the static `dist/` output. No functions required.
- ✅ **Serverless mode** — Netlify Functions run alongside the static site. Functions are opt-in — add a `functions` directory and reference it in `netlify.toml`. Functions and static files are immutable per deploy and roll back together.

### How it works

Flint Static Manager triggers deploys via the Netlify REST API. Two upload approaches are supported:

1. **ZIP upload (simple):** POST the `dist/` folder as a zip to `https://api.netlify.com/api/v1/sites/{site_id}/deploys`. Limited to 25,000 files per deploy.
2. **File-digest (efficient):** POST a JSON manifest of `{ filename: sha1 }` pairs; Netlify responds with which files it needs uploaded. Only changed files are transferred. This is Flint Static's default approach for incremental deploys.

### Configuration

| Variable | Required | Description |
|---|---|---|
| `NETLIFY_AUTH_TOKEN` | ✅ Yes | Personal Access Token from `app.netlify.com/user/applications` → "Personal access tokens" → "New access token". Opaque string. Used as `Authorization: Bearer <NETLIFY_AUTH_TOKEN>`. Also consumed by the Netlify CLI under the same name. |
| `NETLIFY_SITE_ID` | ✅ Yes | UUID of the target Netlify site (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`). Found in: Netlify Dashboard → Project → Project configuration → General → Project details → **Project ID**. Interchangeable with the site's Netlify subdomain in API paths. |

**Creating a `NETLIFY_AUTH_TOKEN`**

Netlify Dashboard → avatar menu → User settings → Applications → Personal access tokens → New access token → set a name and optional expiration date → Generate. Copy immediately — shown only once. Optionally scope to specific SAML team(s). Token is an opaque string with no fixed format or prefix.

**Finding your `NETLIFY_SITE_ID`**

Open the site in the Netlify Dashboard → Site configuration → General → Project details → **Project ID** field. It is a standard UUID, e.g. `3970e0fe-8564-4903-9a55-c5f8de49fb8b`.

### `netlify.toml` configuration

Place `netlify.toml` at the project root:

```toml
[build]
  publish = "dist"
  functions = "functions"   # only needed for serverless checkout

[build.environment]
  NODE_VERSION = "20"

[[headers]]
  for = "/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

Key fields:

- `publish = "dist"` — matches Flint Static's build output directory.
- `functions` — path to your serverless functions directory. Omit entirely for static-only deploys.
- `[[headers]]` and `[[redirects]]` arrays support CDN-level rules without a server.

### Free tier limits

| Limit | Value |
|---|---|
| Deploys via API | 3 per minute, 100 per day |
| ZIP extraction file limit | 25,000 files per deploy |
| Bandwidth | 100 GB/month |
| Function timeout (synchronous) | 60 seconds |
| Function timeout (background) | 15 minutes |
| Function memory | 1,024 MB |
| Function invocations | 125,000/month |

### Functions (serverless checkout)

Netlify Functions run as AWS Lambda under the hood (us-east-2 by default). Three function types are available:

- **Synchronous** — respond immediately, 60 s timeout, 6 MB request/response (buffered).
- **Background** — fire-and-forget, 15-minute timeout, 256 KB response.
- **Scheduled** — cron-triggered, 60 s timeout.

Functions are deployed atomically with the static site — every deploy includes both. Rolling back a deploy restores both the static files and the function code to the previous state simultaneously.

### Deploy API endpoint reference

ZIP upload method:

```
POST https://api.netlify.com/api/v1/sites/{site_id}/deploys
Authorization: Bearer <NETLIFY_AUTH_TOKEN>
Content-Type: application/zip
Body: <raw zip bytes>
```

File-digest method (incremental, used by Flint Static):

```
# Step 1 — send file manifest
POST https://api.netlify.com/api/v1/sites/{site_id}/deploys
Authorization: Bearer <NETLIFY_AUTH_TOKEN>
Content-Type: application/json
Body: { "files": { "/index.html": "<sha1>", "/main.css": "<sha1>" } }
→ Response: { "id": "<deploy_id>", "required": ["<sha1>", ...] }

# Step 2 — upload only the files Netlify requests
PUT https://api.netlify.com/api/v1/deploys/{deploy_id}/files/index.html
Authorization: Bearer <NETLIFY_AUTH_TOKEN>
Content-Type: application/octet-stream
Body: <raw file bytes>
```
