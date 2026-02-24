/**
 * API: Deploy Config — read/write service config files (not deploy trigger).
 *
 * Supports:
 *   cloudflare       → env-only (CF_WORKER_NAME, CF_WORKER_MAIN, CF_WORKER_COMPAT_DATE)
 *   cloudflare-pages → env-only (CF_PAGES_PROJECT, CF_PAGES_DIR)
 *   vercel           → vercel.json
 *   netlify          → netlify.toml
 *   ghpages          → .github/workflows/deploy.yml
 *
 * GET /sites/:id/deploy/:service/config  — read normalised config
 * PUT /sites/:id/deploy/:service/config  — write/merge config
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { getSite, resolveSitePath } from '../registry.js';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { load as loadYaml, dump as dumpYaml } from 'js-yaml';

// ---- Service metadata -------------------------------------------------------

const SERVICE_CONFIGS = {
  // Cloudflare Workers — no config file; all settings come from .env
  cloudflare: {
    file: '',
    label: 'Cloudflare Workers',
    envVars: ['CLOUDFLARE_EMAIL', 'CLOUDFLARE_GLOBAL_API_KEY', 'CLOUDFLARE_ACCOUNT_ID', 'CF_WORKER_NAME', 'CF_WORKER_MAIN', 'CF_WORKER_COMPAT_DATE'],
  },
  // Cloudflare Pages — no config file; all settings come from .env
  'cloudflare-pages': {
    file: '',
    label: 'Cloudflare Pages',
    envVars: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'CF_PAGES_PROJECT', 'CF_PAGES_DIR'],
  },
  vercel: {
    file: 'vercel.json',
    label: 'Vercel',
    envVars: ['VERCEL_TOKEN'],
  },
  netlify: {
    file: 'netlify.toml',
    label: 'Netlify',
    envVars: ['NETLIFY_AUTH_TOKEN', 'NETLIFY_SITE_ID'],
  },
  // gh-pages deploys directly via git push — no dedicated config file.
  // Credentials are set via .env (GH_TOKEN + GH_REPO).
  ghpages: {
    file: '',
    label: 'GitHub Pages',
    envVars: ['GH_TOKEN', 'GH_REPO'],
  },
} as const;

export type DeployService = keyof typeof SERVICE_CONFIGS;

export interface DeployConfigResult {
  service: string;
  label: string;
  configFile: string;
  exists: boolean;
  config: Record<string, unknown>;
  envVars: Array<{ name: string; set: boolean }>;
}

// ---- Handlers ---------------------------------------------------------------

export function handleGetDeployConfig(siteId: string, service: string): Response {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);
  const meta = SERVICE_CONFIGS[service as DeployService];
  if (!meta) return error(`Unknown service: ${service}`);

  const sitePath = resolveSitePath(site);
  const configPath = join(sitePath, meta.file);
  const env = loadSiteEnv(sitePath);

  const exists = meta.file ? existsSync(configPath) : false;
  let config: Record<string, unknown> = {};
  if (exists && meta.file) {
    try {
      const raw = readFileSync(configPath, 'utf-8');
      if (meta.file.endsWith('.json')) {
        config = JSON.parse(raw) as Record<string, unknown>;
      } else if (meta.file.endsWith('.toml')) {
        config = parseToml(raw) as Record<string, unknown>;
      } else {
        config = (loadYaml(raw) ?? {}) as Record<string, unknown>;
      }
    } catch {
      config = {};
    }
  }

  const result: DeployConfigResult = {
    service,
    label: meta.label,
    configFile: meta.file,
    exists,
    config: normaliseConfig(service, config),
    envVars: meta.envVars.map(name => ({ name, set: !!(env[name]) })),
  };

  return json(result);
}

export async function handleSaveDeployConfig(siteId: string, service: string, req: Request): Promise<Response> {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);
  const meta = SERVICE_CONFIGS[service as DeployService];
  if (!meta) return error(`Unknown service: ${service}`);
  if (!meta.file) return error('This service has no config file to write.', 400);

  let fields: Record<string, unknown>;
  try {
    fields = await req.json() as Record<string, unknown>;
  } catch {
    return error('Invalid JSON body');
  }

  const sitePath = resolveSitePath(site);
  const configPath = join(sitePath, meta.file);

  // Ensure parent directory exists (e.g. .github/workflows/)
  mkdirSync(dirname(configPath), { recursive: true });

  // Load existing to preserve unmanaged fields
  let existing: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, 'utf-8');
      if (meta.file.endsWith('.json')) existing = JSON.parse(raw) as Record<string, unknown>;
      else if (meta.file.endsWith('.toml')) existing = parseToml(raw) as Record<string, unknown>;
      else existing = (loadYaml(raw) ?? {}) as Record<string, unknown>;
    } catch { existing = {}; }
  }

  const merged = mergeConfig(service, existing, fields);

  try {
    if (meta.file.endsWith('.json')) {
      writeFileSync(configPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
    } else if (meta.file.endsWith('.toml')) {
      writeFileSync(configPath, stringifyToml(merged as Parameters<typeof stringifyToml>[0]), 'utf-8');
    } else {
      writeFileSync(configPath, dumpYaml(merged, { lineWidth: 120 }), 'utf-8');
    }
  } catch (e) {
    return error(`Failed to write config: ${(e as Error).message}`, 500);
  }

  return json({ ok: true, configFile: meta.file });
}

// ---- Normalise: raw file content → flat form fields ----------------------------

function normaliseConfig(service: string, raw: Record<string, unknown>): Record<string, unknown> {
  switch (service) {
    case 'cloudflare':
    case 'cloudflare-pages':
      return {};
    case 'vercel': {
      return {
        outputDirectory: raw.outputDirectory ?? 'dist',
        buildCommand:    raw.buildCommand ?? '',
        framework:       raw.framework ?? '',
        cleanUrls:       raw.cleanUrls ?? false,
        trailingSlash:   raw.trailingSlash ?? false,
      };
    }
    case 'netlify': {
      const build = (raw.build ?? {}) as Record<string, unknown>;
      const functions = (raw.functions ?? {}) as Record<string, unknown>;
      return {
        publish:      build.publish ?? 'dist',
        command:      build.command ?? '',
        environment:  (build.environment ?? {}) as Record<string, string>,
        functionsDir: (functions.directory as string) ?? '',
      };
    }
    case 'ghpages':
      return {};
    default:
      return raw;
  }
}

// ---- Merge: form fields → file representation --------------------------------

function mergeConfig(
  service: string,
  existing: Record<string, unknown>,
  fields: Record<string, unknown>,
): Record<string, unknown> {
  switch (service) {
    case 'cloudflare':
    case 'cloudflare-pages':
      return { ...existing };

    case 'vercel': {
      const out: Record<string, unknown> = { ...existing };
      if (fields.outputDirectory) out.outputDirectory = fields.outputDirectory;
      if (fields.buildCommand)    out.buildCommand    = fields.buildCommand;
      if (fields.framework)       out.framework       = fields.framework;
      if (typeof fields.cleanUrls   === 'boolean') out.cleanUrls   = fields.cleanUrls;
      if (typeof fields.trailingSlash === 'boolean') out.trailingSlash = fields.trailingSlash;
      return out;
    }

    case 'netlify': {
      const out: Record<string, unknown> = { ...existing };
      out.build = {
        ...((existing.build ?? {}) as Record<string, unknown>),
        publish: fields.publish ?? 'dist',
        command: fields.command ?? '',
        ...(fields.environment && typeof fields.environment === 'object'
          ? { environment: fields.environment }
          : {}),
      };
      const funcDir = (fields.functionsDir as string | undefined)?.trim();
      if (funcDir) {
        out.functions = { ...((existing.functions ?? {}) as Record<string, unknown>), directory: funcDir };
      } else if (existing.functions) {
        out.functions = existing.functions;
      }
      return out;
    }

    case 'ghpages':
      return existing;

    default:
      return { ...existing, ...fields };
  }
}

// ---- Helpers -----------------------------------------------------------------

function loadSiteEnv(sitePath: string): Record<string, string> {
  const envPath = join(sitePath, '.env');
  if (!existsSync(envPath)) return {};
  const result: Record<string, string> = {};
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    result[t.slice(0, eq)] = t.slice(eq + 1);
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
