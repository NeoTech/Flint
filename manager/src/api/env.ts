/**
 * API: Env — read and write a site's .env file.
 *
 * GET /sites/:id/env       — returns key-value pairs; secret values are masked
 * PUT /sites/:id/env       — write updated key-value pairs back to .env
 *
 * Keys matching MASK_PATTERN are shown as "••••••" in the GET response.
 * A client can send the mask value back unchanged — the server preserves the
 * original value in that case (masked values are round-tripped safely).
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getSite, resolveSitePath } from '../registry.js';

const MASK_PATTERN = /SECRET|KEY|TOKEN|PASSWORD|PRIVATE|STRIPE/i;
const MASK_VALUE = '••••••';

export interface EnvEntry {
  key: string;
  value: string;
  masked: boolean;
}

export function handleGetEnv(siteId: string): Response {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);

  const envPath = join(resolveSitePath(site), '.env');
  const raw = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';
  const entries = parseEnv(raw);

  const sanitized: EnvEntry[] = entries.map(({ key, value }) => {
    const masked = MASK_PATTERN.test(key);
    return { key, value: masked ? MASK_VALUE : value, masked };
  });

  return json(sanitized);
}

export async function handleSaveEnv(siteId: string, req: Request): Promise<Response> {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);

  let body: EnvEntry[];
  try { body = (await req.json()) as EnvEntry[]; } catch { return error('Invalid JSON', 400); }
  if (!Array.isArray(body)) return error('Expected array of { key, value, masked }', 400);

  const envPath = join(resolveSitePath(site), '.env');

  // Load original values so we can preserve masked secrets that weren't changed
  const original = existsSync(envPath)
    ? Object.fromEntries(parseEnv(readFileSync(envPath, 'utf-8')).map(e => [e.key, e.value]))
    : {} as Record<string, string>;

  const lines: string[] = body.map(({ key, value, masked }) => {
    const finalValue = masked && value === MASK_VALUE ? (original[key] ?? '') : value;
    return `${key}=${finalValue}`;
  });

  writeFileSync(envPath, lines.join('\n') + '\n', 'utf-8');
  return json({ ok: true });
}

// ---- helpers ----------------------------------------------------------------

function parseEnv(raw: string): { key: string; value: string }[] {
  const result: { key: string; value: string }[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    result.push({ key, value });
  }
  return result;
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
