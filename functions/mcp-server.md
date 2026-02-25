# MCP Server for Flint Static Manager

**Status:** `[ ] Todo`  
**Complexity:** Medium  
**References:** [TODO.md](TODO.md)

Add a [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server endpoint to Flint Static Manager so AI agents (Claude Desktop, VS Code Copilot, Cursor) can create/edit content, trigger builds, and manage products without opening the browser UI.

---

## What is MCP?

An open standard (Apache 2.0, Linux Foundation) for connecting AI applications to external tools and data sources. Think USB-C for AI. Any MCP **host** (Claude, VS Code Copilot, Cursor) can connect to any MCP **server** to call Tools, read Resources, and use Prompts.

**Spec version:** `2025-06-18` (latest stable)  
**Spec URL:** https://modelcontextprotocol.io/specification/2025-06-18  
**Wire protocol:** JSON-RPC 2.0, UTF-8

---

## Transport: Streamable HTTP

The right choice for a running Bun server. Single endpoint (`/mcp`):

- **POST `/mcp`** — Client sends any JSON-RPC message; server responds with `application/json` or `text/event-stream`
- **GET `/mcp`** — Optional SSE stream for server-initiated notifications

Session management via `Mcp-Session-Id` response header set during `initialize`; client echoes it on all subsequent requests.

**Use stateless mode** (`sessionIdGenerator: undefined`) for Flint Static Manager — build and sync operations are one-shot calls, no long-running subscriptions needed.

---

## SDK

```bash
bun add @modelcontextprotocol/sdk zod
```

Use SDK v1.x (stable). v2 split packages are pre-alpha.

- **npm:** https://www.npmjs.com/package/@modelcontextprotocol/sdk
- **API docs:** https://modelcontextprotocol.github.io/typescript-sdk/

For Bun compatibility, use the Hono middleware (Hono runs natively on Bun):

```bash
bun add @modelcontextprotocol/sdk @modelcontextprotocol/hono hono zod
```

---

## Proposed Tool Surface

| Tool | Parameters | Action |
|------|-----------|--------|
| `list_sites` | — | Returns all sites from registry |
| `list_pages` | `siteId` | Lists all `.md` content files for a site |
| `get_page` | `siteId`, `path` | Reads raw Markdown + frontmatter |
| `create_page` | `siteId`, `path`, `frontmatter`, `body` | Creates a new `.md` file |
| `update_page` | `siteId`, `path`, `content` | Overwrites page content |
| `delete_page` | `siteId`, `path` | Deletes a content page |
| `trigger_build` | `siteId` | Runs `bun run build` |
| `sync_products` | `siteId`, `force?` | Runs `bun run build:sync` (or `:force`) |
| `get_products` | `siteId` | Returns parsed `products.yaml` as JSON |
| `update_products` | `siteId`, `products` | Writes updated products array |

---

## Proposed Resource Surface

| URI | Content |
|-----|---------|
| `flint://sites` | JSON list of all registered sites |
| `page://{siteId}/{path}` | Raw Markdown content of a page |
| `flint://{siteId}/products` | Raw `products.yaml` content |

---

## Proposed Prompts

| Name | Purpose |
|------|---------|
| `create-content-page` | Scaffold a new page with correct frontmatter |
| `update-product-listing` | Guide agent to update `products.yaml` correctly |
| `build-and-deploy` | Workflow: sync → build → deploy |

---

## Implementation Sketch

### `manager/src/mcp/server.ts`

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPages, readPage, createPage, updatePage, deletePage } from "../api/pages.js";
import { listSites } from "../api/sites.js";

export const server = new McpServer({
  name: "flint-manager",
  version: "1.0.0",
});

server.registerTool(
  "list_pages",
  {
    title: "List Pages",
    description: "List all content pages for a site",
    inputSchema: { siteId: z.string() },
  },
  async ({ siteId }) => {
    const pages = await getPages(siteId);
    return { content: [{ type: "text", text: JSON.stringify(pages) }] };
  }
);

server.registerTool(
  "create_page",
  {
    title: "Create Page",
    description: "Create a new Markdown content page",
    inputSchema: {
      siteId:      z.string(),
      path:        z.string().describe("Relative path like blog/my-post.md"),
      frontmatter: z.record(z.unknown()).describe("YAML frontmatter as an object"),
      body:        z.string().describe("Markdown body content"),
    },
  },
  async ({ siteId, path, frontmatter, body }) => {
    await createPage(siteId, path, frontmatter, body);
    return { content: [{ type: "text", text: `Created ${path}` }] };
  }
);

// ... repeat for update_page, delete_page, trigger_build, sync_products, get_products, update_products
```

### `manager/src/mcp/handler.ts`

```typescript
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { server } from "./server.js";

export async function handleMcp(request: Request, env: { MANAGER_API_KEY: string }): Promise<Response> {
  // Bearer token auth
  const auth = request.headers.get("Authorization");
  if (auth !== `Bearer ${env.MANAGER_API_KEY}`) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="Flint Manager"' },
    });
  }

  // Validate Origin to prevent DNS rebinding attacks
  const origin = request.headers.get("Origin");
  if (origin && !isAllowedOrigin(origin)) {
    return new Response("Forbidden", { status: 403 });
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}
```

### Wire into `manager/src/router.ts`

```typescript
import { handleMcp } from "./mcp/handler.js";

// In the request dispatcher:
if (url.pathname === "/mcp" && (method === "POST" || method === "GET")) {
  return handleMcp(request, env);
}
```

---

## Authentication

**Simple bearer token** — same `MANAGER_API_KEY` the Manager already uses:

```
Authorization: Bearer <MANAGER_API_KEY>
```

On 401, return `WWW-Authenticate: Bearer realm="Flint Manager"`.

Full OAuth 2.1 (what the MCP spec recommends for public servers) is not needed for a private internal tool.

---

## Client Configuration

### VS Code Copilot — `.vscode/mcp.json`

```json
{
  "servers": {
    "flintManager": {
      "type": "http",
      "url": "http://localhost:8080/mcp",
      "headers": {
        "Authorization": "Bearer ${input:flint-api-key}"
      }
    }
  },
  "inputs": [
    {
      "type": "promptString",
      "id": "flint-api-key",
      "description": "Flint Manager API Key",
      "password": true
    }
  ]
}
```

VS Code first tries Streamable HTTP, then falls back to legacy SSE.

### Claude Desktop

Add via `claude.ai/settings` → Connectors → Add custom connector. Enter URL `http://localhost:8080/mcp` and complete auth flow. No config file editing required.

### Cursor

Settings → MCP → Add server → enter URL and Authorization header.

---

## Testing

The MCP SDK provides an `InMemoryTransport` for unit testing without HTTP:

```typescript
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { server } from "./server.js";

describe("MCP tools", () => {
  it("list_pages returns pages", async () => {
    // Use InMemoryTransport to call tools directly
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    // ... send tool call via clientTransport and assert response
  });
});
```

Test file: `manager/src/mcp/server.test.ts`

---

## Implementation Plan

1. `bun add @modelcontextprotocol/sdk zod` in `manager/`
2. Create `manager/src/mcp/server.ts` — `McpServer`, register tools/resources/prompts delegating to existing `api/*.ts` handlers
3. Create `manager/src/mcp/handler.ts` — Streamable HTTP transport wiring + bearer token auth + Origin validation
4. Wire `POST /mcp` and `GET /mcp` into `manager/src/router.ts`
5. Write `manager/src/mcp/server.test.ts` using `InMemoryTransport`
6. Create `.vscode/mcp.json` in workspace root for dev use
7. Update `manager/.env.docker.example` — no new env vars needed (reuses `MANAGER_API_KEY`)
8. Document in `manager/README.md` or `docs/`

---

## Key Spec Constraints

- **Validate `Origin` header** — prevents DNS rebinding attacks (spec MUST)
- Tool handlers must validate all inputs (spec MUST)
- Return `isError: true` on tool execution failure — NOT a JSON-RPC error
- Use standard JSON-RPC error codes for protocol errors: `-32602` bad params, `-32603` internal
- Return `WWW-Authenticate` header on all 401 responses

---

## Reference Links

| Resource | URL |
|----------|-----|
| MCP Spec (latest) | https://modelcontextprotocol.io/specification/2025-06-18 |
| MCP Introduction | https://modelcontextprotocol.io/introduction |
| TypeScript SDK (v1.x) | https://github.com/modelcontextprotocol/typescript-sdk/tree/v1.x |
| Transport spec | https://modelcontextprotocol.io/specification/2025-06-18/basic/transports |
| Auth spec | https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization |
| VS Code MCP config | https://code.visualstudio.com/docs/copilot/reference/mcp-configuration |
| VS Code MCP guide | https://code.visualstudio.com/docs/copilot/chat/mcp-servers |
