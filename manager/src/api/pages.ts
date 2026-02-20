/**
 * API: Pages — CRUD + reorder + parsed frontmatter for content/*.md files.
 *
 * GET    /sites/:id/pages               — list all pages (tree)
 * GET    /sites/:id/pages/*path         — read a page (raw markdown)
 * GET    /sites/:id/pages/*path/parsed  — read parsed { frontmatter, body }
 * POST   /sites/:id/pages               — create a new page
 * PUT    /sites/:id/pages/*path         — save page content (raw)
 * PUT    /sites/:id/pages/*path/parsed  — save parsed { frontmatter, body }
 * PATCH  /sites/:id/pages/reorder       — reorder siblings (writes Order: N)
 * DELETE /sites/:id/pages/*path         — delete a page
 */
import { readFileSync, writeFileSync, unlinkSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, dirname, extname } from 'path';
import { mkdirSync } from 'fs';
import matter from 'gray-matter';
import { getSite, resolveSitePath } from '../registry.js';

export interface PageNode {
  name: string;
  path: string;   // relative to content/ e.g. "blog/index.md"
  isDir: boolean;
  children?: PageNode[];
}

export function handleListPages(siteId: string): Response {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);
  const contentDir = join(resolveSitePath(site), 'content');
  if (!existsSync(contentDir)) return notFound('content dir');
  const tree = buildTree(contentDir, contentDir);
  return json(tree);
}

export function handleGetPage(siteId: string, pagePath: string): Response {
  const file = resolvePagePath(siteId, pagePath);
  if (!file) return notFound(pagePath);
  if (!existsSync(file.abs)) return notFound(pagePath);
  const content = readFileSync(file.abs, 'utf-8');
  return json({ path: pagePath, content });
}

export function handleGetPageParsed(siteId: string, pagePath: string): Response {
  const file = resolvePagePath(siteId, pagePath);
  if (!file || !existsSync(file.abs)) return notFound(pagePath);
  const raw = readFileSync(file.abs, 'utf-8');
  const parsed = matter(raw);
  return json({ frontmatter: parsed.data, body: parsed.content });
}

export async function handleCreatePage(siteId: string, req: Request): Promise<Response> {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);

  let body: { path: string; content: string };
  try { body = (await req.json()) as { path: string; content: string }; } catch { return error('Invalid JSON', 400); }
  if (!body.path || !body.content) return error('path and content are required', 400);

  // Sanitise to prevent path traversal (same pattern as resolvePagePath)
  const safe = body.path.replace(/\.\./g, '').replace(/^\/+/, '');
  const abs = join(resolveSitePath(site), 'content', safe);
  if (existsSync(abs)) return error(`Page already exists: ${safe}`, 409);

  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body.content, 'utf-8');
  return json({ ok: true, path: safe }, 201);
}

export async function handleUpdatePage(siteId: string, pagePath: string, req: Request): Promise<Response> {
  const file = resolvePagePath(siteId, pagePath);
  if (!file) return notFound(siteId);

  let body: { content: string };
  try { body = (await req.json()) as { content: string }; } catch { return error('Invalid JSON', 400); }
  if (typeof body.content !== 'string') return error('content is required', 400);

  mkdirSync(dirname(file.abs), { recursive: true });
  writeFileSync(file.abs, body.content, 'utf-8');
  return json({ ok: true });
}

export async function handleUpdatePageParsed(siteId: string, pagePath: string, req: Request): Promise<Response> {
  const file = resolvePagePath(siteId, pagePath);
  if (!file) return notFound(siteId);

  let body: { frontmatter: Record<string, unknown>; body: string };
  try { body = (await req.json()) as { frontmatter: Record<string, unknown>; body: string }; }
  catch { return error('Invalid JSON', 400); }

  mkdirSync(dirname(file.abs), { recursive: true });
  // matter.stringify prepends YAML front matter with --- fences
  const content = matter.stringify(body.body ?? '', body.frontmatter ?? {});
  writeFileSync(file.abs, content, 'utf-8');
  return json({ ok: true });
}

export async function handleReorderPages(siteId: string, req: Request): Promise<Response> {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);

  let body: { items: Array<{ path: string; order: number }> };
  try { body = (await req.json()) as { items: Array<{ path: string; order: number }> }; }
  catch { return error('Invalid JSON', 400); }
  if (!Array.isArray(body.items)) return error('items array required', 400);

  const sitePath = resolveSitePath(site);
  for (const item of body.items) {
    const safe = item.path.replace(/\.\./g, '').replace(/^\/+/, '');
    const abs = join(sitePath, 'content', safe);
    if (!existsSync(abs)) continue;
    const raw = readFileSync(abs, 'utf-8');
    const parsed = matter(raw);
    parsed.data['Order'] = item.order;
    writeFileSync(abs, matter.stringify(parsed.content, parsed.data), 'utf-8');
  }
  return json({ ok: true });
}

export function handleDeletePage(siteId: string, pagePath: string): Response {
  const file = resolvePagePath(siteId, pagePath);
  if (!file || !existsSync(file.abs)) return notFound(pagePath);
  unlinkSync(file.abs);
  return json({ ok: true });
}

// ---- helpers ----------------------------------------------------------------

function resolvePagePath(siteId: string, pagePath: string): { abs: string } | null {
  const site = getSite(siteId);
  if (!site) return null;
  // Sanitise to prevent path traversal
  const safe = pagePath.replace(/\.\./g, '').replace(/^\/+/, '');
  const abs = join(resolveSitePath(site), 'content', safe);
  return { abs };
}

function buildTree(dir: string, root: string): PageNode[] {
  const entries = readdirSync(dir);
  const nodes: PageNode[] = [];
  for (const entry of entries) {
    const abs = join(dir, entry);
    const rel = relative(root, abs).replace(/\\/g, '/');
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      nodes.push({ name: entry, path: rel, isDir: true, children: buildTree(abs, root) });
    } else if (extname(entry) === '.md') {
      nodes.push({ name: entry, path: rel, isDir: false });
    }
  }
  return nodes;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function error(msg: string, status = 400): Response {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json' } });
}
function notFound(what: string): Response {
  return error(`Not found: ${what}`, 404);
}
