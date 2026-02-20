/**
 * API: Build + Deploy — trigger builds and deployments, streamed via SSE.
 *
 * POST /sites/:id/build              — compile pages + Rspack production bundle
 * GET  /sites/:id/build/targets      — list deploy targets and their availability
 * POST /sites/:id/deploy/:target     — deploy dist/ to a platform (SSE)
 *
 * Deploy targets are detected from the site's .env file.
 * Tokens are never logged — they are passed as environment variables only.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getSite, resolveSitePath } from '../registry.js';
import { spawnChained } from '../runner.js';

// ---- Build ------------------------------------------------------------------

export function handleBuild(siteId: string): Response {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);

  const cwd = resolveSitePath(site);
  const stream = spawnChained([
    { label: '● Compiling pages…',                   cmd: ['bun', 'run', 'build'] },
    { label: '● Bundling client JS (production)…',   cmd: ['bunx', '--bun', 'rspack', 'build', '--mode', 'production'] },
  ], cwd);

  return sseResponse(stream);
}

// ---- Deploy targets ---------------------------------------------------------

export interface DeployTarget {
  id: string;
  label: string;
  available: boolean;
  /** Env var names that are missing */
  missing: string[];
}

const TARGETS: Array<{ id: string; label: string; requires: string[] }> = [
  { id: 'cloudflare', label: 'Cloudflare Pages', requires: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'CF_PAGES_PROJECT'] },
  { id: 'vercel',     label: 'Vercel',            requires: ['VERCEL_TOKEN'] },
  { id: 'netlify',    label: 'Netlify',            requires: ['NETLIFY_AUTH_TOKEN', 'NETLIFY_SITE_ID'] },
  { id: 'ghpages',    label: 'GitHub Pages',       requires: ['GH_TOKEN', 'GH_REPO'] },
];

export function handleGetDeployTargets(siteId: string): Response {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);

  const env = loadSiteEnv(resolveSitePath(site));
  const targets: DeployTarget[] = TARGETS.map(t => {
    const missing = t.requires.filter(k => !env[k]);
    return { id: t.id, label: t.label, available: missing.length === 0, missing };
  });

  return json(targets);
}

// ---- Deploy -----------------------------------------------------------------

export function handleDeploy(siteId: string, target: string): Response {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);

  const cwd = resolveSitePath(site);
  const env = loadSiteEnv(cwd);

  type Step = { label: string; cmd: string[]; env?: Record<string, string> };
  let steps: Step[];

  switch (target) {
    case 'cloudflare':
      steps = [{
        label: '● Deploying to Cloudflare Pages…',
        cmd: ['bunx', 'wrangler', 'pages', 'deploy', 'dist', '--project-name', env['CF_PAGES_PROJECT'] ?? ''],
        env: { CLOUDFLARE_API_TOKEN: env['CLOUDFLARE_API_TOKEN'] ?? '', CLOUDFLARE_ACCOUNT_ID: env['CLOUDFLARE_ACCOUNT_ID'] ?? '' },
      }];
      break;

    case 'vercel':
      steps = [{
        label: '● Deploying to Vercel…',
        cmd: ['bunx', 'vercel', '--token', env['VERCEL_TOKEN'] ?? '', '--yes', '--prod'],
      }];
      break;

    case 'netlify':
      steps = [{
        label: '● Deploying to Netlify…',
        cmd: ['bunx', 'netlify', 'deploy', '--dir', 'dist', '--prod'],
        env: { NETLIFY_AUTH_TOKEN: env['NETLIFY_AUTH_TOKEN'] ?? '', NETLIFY_SITE_ID: env['NETLIFY_SITE_ID'] ?? '' },
      }];
      break;

    case 'ghpages':
      steps = [{
        label: '● Deploying to GitHub Pages…',
        cmd: ['bunx', 'gh-pages', '-d', 'dist'],
        env: { GITHUB_TOKEN: env['GH_TOKEN'] ?? '' },
      }];
      break;

    default:
      return json({ error: `Unknown deploy target: ${target}` }, 400);
  }

  return sseResponse(spawnChained(steps, cwd));
}

// ---- Test ------------------------------------------------------------------

export function handleTest(siteId: string): Response {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);

  // Use explicit relative paths so Bun matches only the site's own folders,
  // not manager/src/ or any nested directory.
  const stream = spawnChained([
    { label: '● Running tests…', cmd: ['bun', 'test', '--no-watch', './src/', './scripts/'] },
  ], resolveSitePath(site));

  return sseResponse(stream);
}

// ---- Download dist/ -------------------------------------------------------

/**
 * Stream dist/ as a gzip-compressed tar archive for browser download.
 * Works as a fallback when no deploy platform tokens are configured.
 */
export function handleDownloadDist(siteId: string): Response {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);

  const sitePath = resolveSitePath(site);
  const distPath = join(sitePath, 'dist');

  if (!existsSync(distPath)) {
    return json({ error: 'dist/ not found — run a build first' }, 404);
  }

  const proc = Bun.spawn(['tar', '-czf', '-', '-C', sitePath, 'dist'], {
    stdout: 'pipe',
    stderr: 'ignore',
  });

  const safeName = site.id.replace(/[^a-z0-9-]/gi, '_');
  return new Response(proc.stdout as ReadableStream, {
    headers: {
      'Content-Type': 'application/x-gzip',
      'Content-Disposition': `attachment; filename="${safeName}-dist.tar.gz"`,
      'Cache-Control': 'no-store',
    },
  });
}

// ---- Helpers ----------------------------------------------------------------

function loadSiteEnv(sitePath: string): Record<string, string> {
  const envPath = join(sitePath, '.env');
  if (!existsSync(envPath)) return {};
  const result: Record<string, string> = {};
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    result[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return result;
}

function notFound(what: string): Response {
  return json({ error: `Not found: ${what}` }, 404);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
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
