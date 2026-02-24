# Agent Lessons

## Rule Violations & Patterns to Avoid

### 1. Never kill processes — inform the user instead
**Date:** 2026-02-23  
**What happened:** Got `EADDRINUSE` on port 8080. Instead of stopping and informing the user, I ran `taskkill /PID ... /F` directly from a tool call.  
**Rule violated:** From `.github/copilot-instructions.md`:
> **EADDRINUSE error**: Inform the user the server is already running. Do **not** kill the process.

**Correct behaviour:**  
When port is in use, say: "The server is already running on port 8080. Please run `taskkill /IM bun.exe /F` (Windows) or `pkill bun` (macOS/Linux) to clear it, then restart."  
Never use `taskkill`, `kill`, `pkill`, or any process-termination command from agent tools.

**Prevention rule:** Before running any terminal command containing `taskkill`, `kill -9`, `pkill`, or `kill /F`, STOP. Re-read the EADDRINUSE rule. Inform the user instead.

---

### 2. Never mix Build page (Pages deploy) and Workers page (Worker deploy)
**Date:** 2026-02-24  
**What happened:** Asked to fix cloudflare deploy on the Workers page. Instead changed the Build page cloudflare target to also run the Worker script, breaking Pages deploys. Then asked again and still conflated the two pages.

**Rule:** These are completely separate flows — NEVER touch one when asked about the other:

| Sidebar item | URL | Function |
|---|---|---|
| **Build** | `/sites/:id/build` | Deploys static site to **Cloudflare Pages** via `wrangler pages deploy` |
| **Workers** | `/sites/:id/deploy/*` | Deploys **Cloudflare Worker** via `bun run deploy:checkout:cloudflare` |

**Extra:** The Cloudflare card on the Build page has no config form page. Its "Configure →" link goes to `/env` (not `/deploy/cloudflare`).

**Prevention rule:** Before touching any cloudflare deploy code, state aloud which flow is being changed — Build page (Pages) or Workers page (Worker). If the user says "Deploy page" or "deploy section" they mean the **Workers** sidebar item. If they say "Build page deploy section" they mean the Pages deploy cards at the bottom of the Build page.
