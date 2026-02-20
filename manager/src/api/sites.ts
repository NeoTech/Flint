/**
 * API: Sites — register, list, and remove site instances.
 *
 * POST /api/sites          — add a site to the registry
 * DELETE /api/sites/:id    — remove a site from the registry
 */
import { upsertSite, removeSite, loadRegistry, type SiteEntry } from '../registry.js';
import { resolveSitePath } from '../registry.js';
import { existsSync } from 'fs';

export function handleListSites(): Response {
  const sites = loadRegistry();
  return jsonResponse(sites);
}

export async function handleAddSite(req: Request): Promise<Response> {
  let body: Partial<SiteEntry>;
  try {
    body = (await req.json()) as Partial<SiteEntry>;
  } catch {
    return errorResponse('Invalid JSON', 400);
  }

  if (!body.id || !body.name || !body.path) {
    return errorResponse('id, name and path are required', 400);
  }

  const entry: SiteEntry = {
    id: sanitizeId(body.id),
    name: body.name,
    path: body.path,
    description: body.description,
    theme: body.theme,
  };

  const resolved = resolveSitePath(entry);
  if (!existsSync(resolved)) {
    return errorResponse(`Path does not exist: ${resolved}`, 400);
  }

  upsertSite(entry);
  return jsonResponse(entry, 201);
}

export function handleRemoveSite(id: string): Response {
  const sites = loadRegistry();
  if (!sites.find(s => s.id === id)) {
    return errorResponse(`Site not found: ${id}`, 404);
  }
  removeSite(id);
  return jsonResponse({ ok: true });
}

function sanitizeId(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(msg: string, status = 400): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
