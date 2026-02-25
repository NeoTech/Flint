# Flint Static — Serverless Extension Backlog

This document tracks potential Backend-as-a-Service features for extending Flint Static beyond a pure static site generator. Each item has a companion deep-dive doc in this folder.

All features follow the existing pattern: a `functions/feature-handler.ts` (Bun HTTP server) paired with a `functions/feature-cloudflare.ts` (Cloudflare Workers adapter), deploying alongside the checkout Worker.

---

## Feature Index

| # | Feature | File | Complexity | Priority |
|---|---------|------|-----------|---------|
| 1 | [Authentication & Authorization](#1-authn--authz) | [authn-authz.md](authn-authz.md) | Low–High | High |
| 2 | [User Registration + Database](#2-user-registration--database) | [user-registration-db.md](user-registration-db.md) | Low–Medium | High |
| 3 | [MCP Server for Manager](#3-mcp-server-for-manager) | [mcp-server.md](mcp-server.md) | Medium | High |
| 4 | [Serverless Forms + Email](#4-serverless-forms--email) | [forms-email.md](forms-email.md) | Low | Medium |
| 5 | [Full-Text Search](#5-full-text-search) | [search.md](search.md) | Low | Medium |
| 6 | [Comments & Social Features](#6-comments--social-features) | [comments-social.md](comments-social.md) | Low–High | Low |
| 7 | [File Uploads & Media Management](#7-file-uploads--media-management) | [file-uploads-media.md](file-uploads-media.md) | Low–Medium | Medium |
| 8 | [Container Orchestration & Deployment](#8-container-orchestration--deployment) | [container-orchestration.md](container-orchestration.md) | Low–High | Low |

---

## 1. AuthN / AuthZ

**Status:** `[ ] Todo`

Add authentication and authorization so Flint Static sites can protect content, gated sections, or member areas.

**Options explored:**
- Cloudflare Access (Zero Trust) — free for ≤50 users, no code required
- Clerk — hosted auth with free 50k MRU, drop-in JS SDK
- Better Auth — self-hosted, Bun/Workers compatible
- Custom `jose` + Cloudflare KV JWT sessions — full control, no vendor
- Passwordless magic links via Resend + KV tokens

**Quickest win:** Cloudflare Access to protect the Manager UI today (zero code, infra-only config).
**Best for customer-facing sites:** Clerk Hobby (free) + `@clerk/backend` in a Worker.

→ **See [authn-authz.md](authn-authz.md)**

---

## 2. User Registration + Database

**Status:** `[ ] Todo`

A registration and login system requires a database. All options target the Cloudflare Workers runtime (no TCP, no Node native modules).

**Options explored:**
- Cloudflare D1 (edge SQLite) — **recommended**, binding-based, zero secrets, Free plan: 5M reads/day
- Turso (libSQL) — similar to D1 but external account + secrets needed
- Neon (serverless Postgres) — full Postgres power, `@neondatabase/serverless` HTTP driver
- Cloudflare KV — suitable for sessions only, not user records

**Password hashing:** PBKDF2 via `crypto.subtle` (built into Workers, zero deps, OWASP-compliant at 600k iterations).
**JWTs:** `jose` library (edge-compatible, 0 native deps).

→ **See [user-registration-db.md](user-registration-db.md)**

---

## 3. MCP Server for Manager

**Status:** `[ ] Todo`

Add a [Model Context Protocol](https://modelcontextprotocol.io) server endpoint to Flint Static Manager so AI agents (Claude, VS Code Copilot, Cursor) can remotely create/edit content, trigger builds, and manage products without opening the browser UI.

**Approach:**
- Add `POST /mcp` + `GET /mcp` endpoints to the existing Bun router (Streamable HTTP transport)
- Use `@modelcontextprotocol/sdk` v1.x + Zod
- Auth via `Authorization: Bearer <MANAGER_API_KEY>` (same key the Manager already uses)
- MCP Tools: `list_pages`, `get_page`, `create_page`, `update_page`, `delete_page`, `trigger_build`, `sync_products`
- MCP Resources: `page://{siteId}/{path}`, `flint://sites`
- Config for VS Code: `.vscode/mcp.json` (Streamable HTTP, port 8080)

→ **See [mcp-server.md](mcp-server.md)**

---

## 4. Serverless Forms + Email

**Status:** `[ ] Todo`

Contact forms, lead capture, and notification emails — all via a Cloudflare Worker, 0 servers.

**Recommended stack:**
- **Resend** for transactional email — 3,000 free/month, arbitrary recipients, REST API works in Workers
- **Cloudflare Turnstile** for CAPTCHA — free, invisible, no UX friction
- **HTMX** on the client — form submits w/o page reload, Worker returns HTML fragment

**Extras documented:**
- Cloudflare Workers Email Routing (owner-notification only, no arbitrary recipients)
- Postmark (better deliverability for high volume)
- Form-to-Airtable / Form-to-Notion / Form-to-Pipedream webhook patterns

→ **See [forms-email.md](forms-email.md)**

---

## 5. Full-Text Search

**Status:** `[ ] Todo`

Add search to a Flint Static site. Options range from zero-infrastructure to edge AI.

**Options explored:**
- **Pagefind** — **recommended**, Rust binary runs post-build, generates WASM index in `dist/pagefind/`, 100% static, free, MIT
- Orama — TypeScript-native, client-side or cloud, vector/hybrid search available
- Algolia — hosted, best analytics; DocSearch free for qualifying sites
- Cloudflare Workers AI + Vectorize — semantic/natural-language search, requires a Worker at query time
- Fuse.js — pure JS fuzzy, fine for <200 pages

→ **See [search.md](search.md)**

---

## 6. Comments & Social Features

**Status:** `[ ] Todo`

User-generated content and social signals for blog posts and product pages.

**Options explored:**
- **Giscus** — GitHub Discussions-backed, single `<script>` tag, **recommended quickstart**
- Utterances — GitHub Issues-backed, simpler but fewer features (unmaintained)
- Custom Worker + D1 — self-hosted comments, full control, moderation workflow
- Workers AI moderation — `@cf/meta/llama-guard-3-8b` for content safety filtering
- **OG/Twitter Card meta tags** — gaps identified in current `renderHead()` output
- **RSS/Atom feed** — build-time generation from `Type: post` pages

→ **See [comments-social.md](comments-social.md)**

---

## 7. File Uploads & Media Management

**Status:** `[ ] Todo`

Image uploads, responsive image generation, and video delivery.

**Options explored:**
- **Cloudflare R2** — S3-compatible, zero egress fees, Free: 10 GB + 1M ops/mo; presigned PUT URL pattern for browser direct upload
- **Cloudflare Images** — on-demand transform (resize, WebP/AVIF) via `cdn-cgi/image/` URL; Free: 5,000 unique transforms/mo
- **sharp** — Bun-compatible `libvips` binding for build-time responsive image generation
- UploadThing — developer-friendly hosted uploads, Free: 2 GB
- Cloudflare Stream — video hosting + HLS delivery; no free tier, $5/1,000 min stored

**Recommended pattern:** R2 for storage + `sharp` at build time for static images + CF Images Transform for dynamic CMS uploads.

→ **See [file-uploads-media.md](file-uploads-media.md)**

---

## 8. Container Orchestration & Deployment

**Status:** `[ ] Todo`

Scaling the Flint Static Manager and build pipeline beyond a single Docker container.

**Options explored:**
- **Cloudflare Workflows** — durable multi-step pipelines for Stripe sync, email sequences, build coordination; Free plan; **recommended phase-1**
- **Cloudflare Durable Objects** — stateful edge for WebSocket relay, rate limiting, build queue; SQLite storage now free
- **Fly.io** — persistent Bun containers, Machines API for ephemeral build jobs; ~$5/mo; **recommended for hosted Manager**
- **Railway** — git-push deploys, Hobby $5/mo with $5 credit included
- **Render.com** — native Bun runtime, static site hosting alternative, $7/mo always-on
- **Kubernetes** — enterprise scale, Fly Kubernetes $75/mo/cluster, high complexity

→ **See [container-orchestration.md](container-orchestration.md)**

---

## Suggested Roadmap

### Phase 1 — Low hanging fruit (days of work each)
- [ ] **Pagefind search** — post-build step, zero infra, massive UX win
- [ ] **Contact form** — Resend + Turnstile + Worker handler
- [ ] **OG/Twitter Card tags** — add to `renderHead()`, zero backend needed, huge social sharing improvement
- [ ] **RSS/Atom feed** — build-time generation, no backend
- [ ] **Giscus comments** — single script tag on blog post template

### Phase 2 — Auth + data layer (1–2 weeks each)
- [ ] **Cloudflare Access** — protect Manager UI (infra-only, no code)
- [ ] **User registration** — D1 + PBKDF2 + `jose` + Worker; enables member areas
- [ ] **MCP server** — unlock AI agent control of content

### Phase 3 — Media + scale (as needed)
- [ ] **R2 + sharp** — image upload pipeline for content editors
- [ ] **Cloudflare Workflows** — durable Stripe sync pipeline
- [ ] **Fly.io deployment** — persistent hosted Manager with volume-backed registry
