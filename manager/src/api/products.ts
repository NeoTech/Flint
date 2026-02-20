/**
 * API: Products — read/write products.yaml (raw + parsed), trigger generate and sync.
 *
 * GET    /sites/:id/products            — read products.yaml raw YAML
 * PUT    /sites/:id/products            — write products.yaml (raw)
 * GET    /sites/:id/products/parsed     — read as { products: Product[] }
 * PUT    /sites/:id/products/parsed     — write from { products: Product[] }
 * POST   /sites/:id/products/generate   — run `bun run generate` (SSE)
 * POST   /sites/:id/products/sync       — run `bun run build:sync` (SSE)
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { getSite, resolveSitePath } from '../registry.js';
import { spawnAsStream } from '../runner.js';

export interface Product {
  id: string;
  title: string;
  description?: string;
  price_cents?: number;
  currency?: string;
  image?: string;
  order?: number;
  labels?: string[];
  stripe_price_id?: string;
  stripe_payment_link?: string;
  tax_code?: string;
}

export function handleGetProducts(siteId: string): Response {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);

  const productsPath = join(resolveSitePath(site), 'products.yaml');
  if (!existsSync(productsPath)) {
    return json({ content: '' });
  }
  const content = readFileSync(productsPath, 'utf-8');
  return json({ content });
}

export async function handleSaveProducts(siteId: string, req: Request): Promise<Response> {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);

  let body: { content: string };
  try { body = (await req.json()) as { content: string }; } catch { return error('Invalid JSON', 400); }
  if (typeof body.content !== 'string') return error('content is required', 400);

  const productsPath = join(resolveSitePath(site), 'products.yaml');
  writeFileSync(productsPath, body.content, 'utf-8');
  return json({ ok: true });
}

export function handleGetProductsParsed(siteId: string): Response {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);

  const productsPath = join(resolveSitePath(site), 'products.yaml');
  if (!existsSync(productsPath)) return json({ products: [] });

  const raw = readFileSync(productsPath, 'utf-8');
  const parsed = yaml.load(raw) as { products?: Product[] } | null;
  return json({ products: parsed?.products ?? [] });
}

export async function handleSaveProductsParsed(siteId: string, req: Request): Promise<Response> {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);

  let body: { products: Product[] };
  try { body = (await req.json()) as { products: Product[] }; } catch { return error('Invalid JSON', 400); }
  if (!Array.isArray(body.products)) return error('products array required', 400);

  const productsPath = join(resolveSitePath(site), 'products.yaml');
  writeFileSync(productsPath, yaml.dump({ products: body.products }, { lineWidth: 120 }), 'utf-8');
  return json({ ok: true });
}

export function handleGenerateProducts(siteId: string): Response {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);

  const stream = spawnAsStream(['bun', 'run', 'generate'], resolveSitePath(site));
  return sseResponse(stream);
}

export function handleSyncProducts(siteId: string, force = false): Response {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);

  const script = force ? 'build:sync:force' : 'build:sync';
  const stream = spawnAsStream(['bun', 'run', script], resolveSitePath(site));
  return sseResponse(stream);
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
function sseResponse(stream: ReadableStream<string>): Response {
  const encoder = new TextEncoder();
  // Avoid pipeThrough(new TransformStream(...)) — test environments (e.g. happy-dom)
  // replace the global TransformStream with a browser polyfill whose .readable
  // is not recognised by Bun's native pipeThrough check.
  const body = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const reader = stream.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          ctrl.enqueue(encoder.encode(value));
        }
      } finally {
        ctrl.close();
      }
    },
  });
  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
