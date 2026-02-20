/**
 * API: Media — list, upload, serve and delete files in a site's static/ folder.
 *
 * GET  /sites/:id/media/list          — JSON array of MediaFile
 * GET  /sites/:id/media/file/*path    — serve the raw file (for in-manager preview)
 * POST /sites/:id/media/upload        — multipart, field "files[]", optional field "folder"
 * DEL  /sites/:id/media/*path         — delete file
 */
import { readdirSync, statSync, unlinkSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join, relative, extname } from 'path';
import { getSite, resolveSitePath } from '../registry.js';

const IMAGE_EXTS  = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif', '.ico']);
const ALLOWED_EXTS = new Set([
  ...IMAGE_EXTS,
  '.pdf', '.zip',
  '.mp4', '.webm', '.mov',
  '.mp3', '.ogg', '.wav',
  '.woff', '.woff2', '.ttf',
  '.txt', '.json', '.xml', '.csv',
]);

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.txt': 'text/plain', '.json': 'application/json',
  '.xml': 'application/xml', '.csv': 'text/csv',
};

export interface MediaFile {
  name: string;
  /** Path relative to static/ */
  path: string;
  /** Public URL on the built site (e.g. /static/images/hero.jpg) */
  url: string;
  size: number;
  type: 'image' | 'pdf' | 'video' | 'audio' | 'other';
  ext: string;
}

function fileType(ext: string): MediaFile['type'] {
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (ext === '.pdf') return 'pdf';
  if (['.mp4', '.webm', '.mov'].includes(ext)) return 'video';
  if (['.mp3', '.ogg', '.wav'].includes(ext)) return 'audio';
  return 'other';
}

function walkDir(dir: string, root: string): MediaFile[] {
  if (!existsSync(dir)) return [];
  const out: MediaFile[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const s = statSync(abs);
    if (s.isDirectory()) {
      out.push(...walkDir(abs, root));
    } else {
      const ext = extname(entry).toLowerCase();
      if (!ALLOWED_EXTS.has(ext)) continue;
      const rel = relative(root, abs).replace(/\\/g, '/');
      out.push({ name: entry, path: rel, url: '/static/' + rel, size: s.size, type: fileType(ext), ext });
    }
  }
  return out;
}

// ---- Handlers ---------------------------------------------------------------

export function handleListMedia(siteId: string): Response {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);
  const files = walkDir(join(resolveSitePath(site), 'static'), join(resolveSitePath(site), 'static'));
  return json(files);
}

export function handleServeMediaFile(siteId: string, filePath: string): Response {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);
  const safe = filePath.replace(/\.\./g, '').replace(/^\/+/, '');
  const abs = join(resolveSitePath(site), 'static', safe);
  if (!existsSync(abs)) return error('File not found', 404);
  const data = readFileSync(abs);
  const ext = extname(abs).toLowerCase();
  return new Response(data, {
    headers: {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=60',
    },
  });
}

export async function handleUploadMedia(siteId: string, req: Request): Promise<Response> {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);

  let form: unknown;
  try { form = await req.formData(); } catch { return error('Invalid multipart/form-data', 400); }
  const fd = form as { get(k: string): unknown; entries(): Iterable<[string, unknown]> };

  const subfolder = ((fd.get('folder') ?? '') as string)
    .replace(/\.\./g, '').replace(/^\//, '').replace(/\/$/, '');
  const staticDir = join(resolveSitePath(site), 'static');
  const targetDir  = subfolder ? join(staticDir, subfolder) : staticDir;

  const uploaded: string[] = [];
  for (const [, val] of fd.entries()) {
    // Bun gives us File objects for file fields
    if (typeof val !== 'object' || val === null || !('arrayBuffer' in val) || !('name' in val)) continue;
    const file = val as { name: string; arrayBuffer(): Promise<ArrayBuffer> };
    const ext = extname(file.name).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) continue;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, safeName), Buffer.from(await file.arrayBuffer()));
    uploaded.push((subfolder ? subfolder + '/' : '') + safeName);
  }
  if (uploaded.length === 0) return error('No valid files uploaded', 400);
  return json({ ok: true, uploaded });
}

export function handleDeleteMedia(siteId: string, filePath: string): Response {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);
  const safe = filePath.replace(/\.\./g, '').replace(/^\/+/, '');
  if (!safe) return error('Invalid path', 400);
  const abs = join(resolveSitePath(site), 'static', safe);
  if (!existsSync(abs)) return error('File not found', 404);
  try {
    unlinkSync(abs);
    return json({ ok: true });
  } catch (e) {
    return error('Delete failed: ' + String(e), 500);
  }
}

// ---- helpers ----------------------------------------------------------------

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function error(msg: string, status = 400): Response {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json' } });
}
function notFound(what: string): Response {
  return error(`Not found: ${what}`, 404);
}
