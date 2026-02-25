# Container Orchestration & Deployment

**Status:** `[ ] Todo`  
**Complexity:** Low (Cloudflare Workflows / Fly.io) → High (Kubernetes)  
**References:** [TODO.md](TODO.md)

Scaling the Flint Static Manager and build pipeline beyond a single Docker container, and adding durable serverless capabilities.

---

## Recommended Roadmap

| Phase | What | Why |
|-------|------|-----|
| 1 | Cloudflare Workflows for Stripe sync | Durable retryable pipeline, free tier, zero new infra |
| 2 | Fly.io for hosted Manager | Persistent container, Machines API for build isolation |
| 3 | Fly Machines API for per-site builds | Complete isolation, ephemeral, usage-based cost |
| 4 | Durable Objects for stateful edge | WebSocket relay, real-time build logs, rate limiting |
| 5 | Kubernetes | Enterprise scale (50+ sites, multi-team) |

---

## 1. Cloudflare Workflows — Recommended First Step

Durable multi-step applications built on Cloudflare Workers. Each step has automatic retry logic and persists its result — survives Worker restarts. Steps can sleep for seconds, hours, or days. Steps can wait for external events (webhooks, user input).

**Use cases for Flint Static:**

| Scenario | How |
|----------|-----|
| Async Stripe product sync | Trigger Workflow on `products.yaml` save → step 1: validate schema → step 2: sync Stripe prices (retries on rate limit) → step 3: trigger CF Pages deploy |
| Email onboarding sequences | New user registered → Workflow: send welcome email → `step.sleep(1 day)` → send tips email → `step.sleep(3 days)` → check engagement |
| Build pipeline with approval | Trigger build → run build → `step.waitForEvent('approved')` → deploy to production |
| Multi-site batch rebuilds | Fan-out: one Workflow per site, errors isolated per site |

**Example — durable Stripe sync:**

```typescript
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";

interface SyncParams { siteId: string; force?: boolean }

export class StripeSyncWorkflow extends WorkflowEntrypoint<Env, SyncParams> {
  async run(event: WorkflowEvent<SyncParams>, step: WorkflowStep) {

    const products = await step.do("validate-products", async () => {
      return await readAndValidateProducts(event.payload.siteId);
    });

    const stripeData = await step.do("sync-stripe", async () => {
      // Automatically retried if Stripe rate-limits or returns 5xx
      return await syncStripeProducts(products, event.payload.force);
    });

    await step.do("write-price-ids", async () => {
      await writeProductsYaml(event.payload.siteId, stripeData);
    });

    await step.do("trigger-build", async () => {
      await triggerCFPagesDeploy(event.payload.siteId);
    });
  }
}
```

**Trigger from Manager API:**

```typescript
const instance = await env.STRIPE_SYNC_WORKFLOW.create({ params: { siteId, force } });
return Response.json({ workflowId: instance.id });
```

**Pricing:**

| | Free Plan | Paid Plan |
|--|-----------|----------|
| Requests | 100K/day (shared w/ Workers) | 10M/mo + $0.30/million |
| CPU time | 10ms/call | 30M CPU-ms/mo + $0.02/M ms |
| State retention | 3 days | 7 days |
| Idle (sleeping, waiting) | **Not billed** | **Not billed** |

**Complexity:** 🟢 Low — stays 100% on Cloudflare, no new vendors  
**Docs:** https://developers.cloudflare.com/workflows/

---

## 2. Cloudflare Durable Objects — Stateful Edge

A special Worker class with globally-unique routing — requests from anywhere in the world hit the same instance. Maintains in-memory state across requests.

**Use cases for Flint Static:**

| Scenario | How |
|----------|-----|
| Real-time build log streaming | One DO per active build; Manager SSE log viewer connects via WebSocket; DO broadcasts `bun run build` stdout to all connected clients |
| Per-site rate limiting | One DO per site in Manager API; prevents concurrent builds triggering race conditions |
| Cart/checkout state | Replace the Bun checkout server DO that holds cart state per session — no cold starts |
| Build queue coordination | FIFO queue per site; prevents `bun run build` from running concurrently mid-sync |

**WebSocket relay example:**

```typescript
export class BuildLogRelay extends DurableObject {
  private sessions = new Set<WebSocket>();

  fetch(request: Request) {
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      this.sessions.add(server);
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response("Expected WebSocket", { status: 426 });
  }

  // Called by the build runner to broadcast a log line
  async broadcast(line: string) {
    for (const ws of this.sessions) {
      try { ws.send(line); } catch { this.sessions.delete(ws); }
    }
  }
}
```

**Pricing:**

| | Free Plan | Paid Plan |
|--|-----------|----------|
| Requests | 100K/day | 1M/mo + $0.15/million |
| SQLite rows read | 5M/day | 25B/mo + $0.001/million |
| SQLite rows written | 100K/day | 50M/mo + $1.00/million |
| SQL storage | 5 GB total | $0.20/GB-month |

**Complexity:** 🟡 Medium — requires architectural rethink for stateful flows  
**Docs:** https://developers.cloudflare.com/durable-objects/

---

## 3. Fly.io — Recommended for Persistent Hosted Manager

Run Docker containers as fast-starting VMs ("Machines") distributed globally. Fly's Machines API enables programmatic provisioning — ideal for ephemeral per-site build jobs.

**Deploying the Manager:**

Uses the existing `manager/Dockerfile` unchanged.

```bash
cd manager
fly auth login
fly launch   # detects Dockerfile, picks region, creates fly.toml
fly volumes create flint_data --size 1      # persistent volume for registry.json
fly deploy
```

**`fly.toml` for the Manager:**

```toml
app = "flint-manager"
primary_region = "lhr"   # London; choose nearest to you

[build]

[http_service]
  internal_port = 8080
  force_https   = true
  auto_start_machines = true
  auto_stop_machines  = true
  min_machines_running = 1

[mounts]
  source      = "flint_data"
  destination = "/data"

[env]
  MANAGER_PORT    = "8080"
  MANAGER_LOG_DIR = "/data/logs"
```

**Volumes:** Persistent disk for `manager.config.yaml` registry (so it survives container restarts/redeploys).

**Fly Machines API (for programmatic build jobs):**

```typescript
// Manager: spawn an ephemeral build machine per site
const res = await fetch(`https://api.machines.dev/v1/apps/flint-builder/machines`, {
  method: "POST",
  headers: {
    Authorization:  `Bearer ${env.FLY_API_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    config: {
      image: "oven/bun:1",
      cmd:   ["bun", "run", "build"],
      env:   { SITE_PATH: `/sites/${siteId}` },
      mounts: [{ volume: siteVolumeId, path: `/sites/${siteId}` }],
      guest: { cpu_kind: "shared", cpus: 1, memory_mb: 512 },
    },
    region: "lhr",
  }),
});
const { id: machineId } = await res.json();
// Poll /machines/{id}/wait for completion, then destroy
```

**Pricing:**

| Resource | Cost |
|----------|------|
| `shared-cpu-1x` 512 MB | ~$3.19/month running continuously |
| Stopped Machine (rootfs) | $0.15/GB/month |
| Volume (persistent disk) | $0.15/GB/month |
| Outbound egress (NA/EU) | $0.02/GB |
| Dedicated IPv4 | $2/month |

**No free tier** for new accounts. Credit card required.

**Complexity:** 🟢 Low–Medium  
**Docs:** https://fly.io/docs/ · https://docs.machines.dev/

---

## 4. Railway — Easiest Git-push Deploy

Git-native deploys with Dockerfile support. Hobby plan includes $5/month credit — small Manager instances often run free within the credit.

```bash
cd manager
railway login
railway init
railway up   # deploy via Dockerfile
```

**Set env vars:**

```bash
railway variables set MANAGER_API_KEY=<your-key>
railway variables set MANAGER_PORT=8080
```

**Pricing:**

| Plan | Cost | Included credit | Max RAM |
|------|------|----------------|---------|
| Free | $0 | $1/month | 0.5 GB |
| Hobby | $5/month | $5/month | 6 GB |
| Pro | $20/month | $20/month | 1 TB |

Resource rates (on top of subscription): RAM $10/GB-month, vCPU $20/vCPU-month.

Small Manager (~256 MB RAM, 0.1 vCPU continuous) typically fits within the Hobby credit — effectively free.

**Complexity:** 🟢 Low  
**Docs:** https://docs.railway.com/

---

## 5. Render.com — Native Bun Runtime

Zero-DevOps cloud with a native Bun runtime (no Docker needed) and an always-on free static site hosting alternative for `dist/`.

**Deploy Manager (native Bun, no Docker):**

1. Push `manager/` directory to a GitHub repo
2. Render dashboard → New Web Service → connect repo → select language: Bun
3. Set `MANAGER_API_KEY` env var

**Deploy static site (alternative to Cloudflare Pages):**

Render's static hosting is CDN-backed, instant cache invalidation, 100 GB/month bandwidth — free tier, always on.

**Pricing:**

| Service | Cost | Notes |
|---------|------|-------|
| Static site | Free | CDN, custom domain, 100 GB/mo bandwidth |
| Web service (free) | $0 | Spins down after 15 min inactivity (cold starts) |
| Web service (starter) | $7/month | Always-on, 512 MB RAM, 0.5 vCPU |
| Persistent disk | $0.25/GB/month | |

**Complexity:** 🟢 Low  
**Docs:** https://render.com/docs · https://render.com/docs/deploy-bun-docker

---

## 6. Kubernetes — Enterprise Scale

Running the Flint Static Manager in a K8s cluster. Recommended only for 50+ sites, multi-team setups, or organisations already running K8s for other workloads.

**Minimal viable Helm chart concepts:**

```yaml
# Chart.yaml
name: flint-manager
version: 0.1.0

# values.yaml
replicaCount: 2
image:
  repository: your-registry/flint-manager
  tag: latest
service:
  type: ClusterIP
  port: 8080
ingress:
  enabled: true
  className: traefik
  host: manager.example.com
  tls: true
persistence:
  enabled: true
  size: 1Gi            # for registry.json + logs
  storageClass: standard
secrets:
  managerApiKey: ""    # injected from K8s Secret
```

**Key objects:**
- `Deployment` (Manager replicas)
- `Service` (ClusterIP)
- `Ingress` or `IngressRoute` (Traefik)
- `PersistentVolumeClaim` (registry.json + logs)
- `Secret` (API key, Stripe keys, env vars)
- `Job` template (for `bun run build` per site trigger)
- `CronJob` (optional: scheduled Stripe sync)

**Scaling issue with replicas:** `registry.json` is file-based and not safe for concurrent writes across multiple pods. Solution: replace file registry with Postgres (Railway/Render managed DB, or hosted Neon) or mount a single RWX PVC with file locking.

**Fly Kubernetes (FKS):** The lowest-friction K8s path — Fly manages the control plane.

**Pricing:** FKS: $75/month/cluster + compute.

**Complexity:** 🔴 High  
**Docs:** https://fly.io/docs/kubernetes/ · https://kubernetes.io/docs/

---

## Container Orchestration at Scale

### Current baseline (1–20 sites)

Single Docker container + Traefik reverse proxy + optional ngrok tunnel. Documented in `manager/docker-compose.yml`. Cost: ~$5–15/month VPS.

### Fly.io single Machine + Volume (20–100 sites)

Persistent Fly Machine for Manager, Volume for `registry.json`. Auto-stop/start billing. Cost: ~$8–20/month.

### Fly Machines API for build isolation (100–500 sites)

Manager provisions ephemeral Fly Machines per build job via the Machines API:
1. User triggers build in Manager UI
2. Manager calls Fly Machines API to create a Machine with `oven/bun:1`
3. Machine runs `bun run build && bun run deploy:cloudflare:pages`
4. Manager SSE endpoint streams Machine logs
5. Machine is destroyed after completion

Complete per-site build isolation. Usage-based cost.

### K8s + shared Traefik Ingress (500+ sites)

```
Internet
    │
    ▼
Traefik IngressController (LoadBalancer)
    │
    ├── manager.example.com → flint-manager Service (2 replicas)
    │
    └── K8s Jobs (bun run build per site trigger)
```

Cost: $75/month K8s cluster + compute.

---

## Env Vars / Secrets Reference

```env
# Fly.io (for Machines API integration in Manager)
FLY_API_TOKEN=

# Cloudflare Workflows (binding in wrangler.toml — no env var)
# [[workflows]]
# binding = "STRIPE_SYNC_WORKFLOW"
# class_name = "StripeSyncWorkflow"
# name = "stripe-sync"
```

---

## Implementation Plan

### Phase 1 — Cloudflare Workflows (Stripe sync)

1. Create `functions/stripe-sync-workflow.ts` — `WorkflowEntrypoint` class with steps wrapping existing `stripe-sync.ts` logic
2. Add Workflow binding to `wrangler.toml`
3. Update `scripts/build.ts --stripe-sync` to optionally trigger the Workflow instead of running sync in-process
4. Write tests: `functions/stripe-sync-workflow.test.ts`

### Phase 2 — Fly.io deployment

1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. `fly auth login`
3. `cd manager && fly launch` (uses existing `Dockerfile`)
4. `fly volumes create flint_data --size 1`
5. Update `fly.toml` to mount volume at `/data`
6. Update `manager/src/registry.ts` to use configurable `REGISTRY_PATH` env var pointing to `/data/manager.config.yaml`
7. Set secrets: `fly secrets set MANAGER_API_KEY=<key>`
8. `fly deploy`
