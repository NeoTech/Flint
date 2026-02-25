---
name: deploy
description: Deploy the Flint Static site and/or checkout worker to Cloudflare Pages, Vercel, Netlify, or GitHub Pages. Use when asked to "deploy the site", "push to production", "deploy to Cloudflare", "deploy the worker", or "deploy checkout server".
---

# Deploy

## Trigger Phrases

"deploy the site", "deploy to cloudflare", "push to production", "deploy the worker",
"deploy checkout server", "deploy checkout to cloudflare", "publish the site", "go live"

---

## Quick Reference

| Command | What it does | Required env vars |
|---------|-------------|-------------------|
| `bun run deploy:cloudflare:pages` | Deploy static site → Cloudflare Pages | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CF_PAGES_PROJECT` |
| `bun run deploy:checkout:cloudflare` | Deploy checkout → Cloudflare Worker | `CLOUDFLARE_API_TOKEN` or (`CLOUDFLARE_GLOBAL_API_KEY` + `CLOUDFLARE_EMAIL`), `CF_WORKER_NAME`, `STRIPE_SECRET_KEY`, `SITE_URL` |
| `bun run build:sync` | Stripe sync + rebuild (required before deploy when products changed) | `STRIPE_SECRET_KEY` |

**Env var file:** `.env` in project root. Edit via manager at `/sites/:id/env`.

---

## Procedure: Full Deploy (Site + Worker)

Use when shop products changed, worker secrets changed, or deploying from scratch.

```bash
# 1. Sync Stripe prices and rebuild
bun run build:sync

# 2. Deploy static site
bun run deploy:cloudflare:pages

# 3. Deploy checkout worker (if secrets or worker code changed)
bun run deploy:checkout:cloudflare
```

---

## Procedure: Site Only (No Shop Changes)

Use for content-only changes with no product or worker updates.

```bash
# 1. Build
bun run build

# 2. Deploy
bun run deploy:cloudflare:pages
```

---

## Procedure: Deploy via Manager UI

1. Open manager → select site → **Build** in sidebar
2. Review deploy targets (only targets with required env vars are enabled)
3. Click **Build + Deploy** next to the target (Cloudflare, Vercel, Netlify, GitHub Pages)

The Build page deploys the **static site** only. For the checkout Worker, use the **Workers** page (`/sites/:id/deploy/cloudflare`).

---

## Environment Variables

### Static Site Targets

| Target | Required vars |
|--------|--------------|
| Cloudflare Pages | `CLOUDFLARE_API_TOKEN` *(scoped, Pages:Edit)*, `CLOUDFLARE_ACCOUNT_ID`, `CF_PAGES_PROJECT`, `CF_PAGES_DIR` *(default: dist)* |
| Vercel | `VERCEL_TOKEN` |
| Netlify | `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID` |
| GitHub Pages | `GH_TOKEN`, `GH_REPO` |

### Checkout Worker

| Var | Purpose |
|-----|---------|
| `CF_WORKER_NAME` | Worker name (default: `flint-checkout`) |
| `CF_WORKER_MAIN` | Entry file (default: `functions/checkout-cloudflare.ts`) |
| `CF_WORKER_COMPAT_DATE` | Compatibility date |
| `STRIPE_SECRET_KEY` | Set as Worker secret |
| `SITE_URL` or `CLOUDFLARE_SITE_URL` | Set as Worker secret |
| `STRIPE_BILLING_ADDRESS` | Optional Worker secret |
| `STRIPE_SHIPPING_COUNTRIES` | Optional Worker secret |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Pages deploy appears to succeed but no deployment record appears | `CLOUDFLARE_GLOBAL_API_KEY` used instead of scoped token | Set `CLOUDFLARE_API_TOKEN` with **Pages:Edit** scope — Global API Key does NOT work for Pages |
| "No such price" error at checkout | Stripe price IDs missing | Run `bun run build:sync`, then redeploy site |
| Worker `GET /checkout` returns `{"error":"Not found"}` | Expected — only `POST /checkout` is valid | Use `GET /health` to verify worker is alive: `curl https://{CF_WORKER_NAME}.{subdomain}.workers.dev/health` → `{"ok":true}` |
| Worker health check fails | Worker not deployed or wrong URL | Run `bun run deploy:checkout:cloudflare`, check `CF_WORKER_NAME` |
| Target disabled in manager Build page | Required env vars not set | Add missing vars in `.env` or manager Env editor |
| Project auto-create fails | `CLOUDFLARE_ACCOUNT_ID` missing or wrong | Verify account ID in Cloudflare dashboard → right sidebar |
