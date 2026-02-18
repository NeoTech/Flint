/**
 * Deploy the Flint checkout handler to Cloudflare Workers.
 *
 * Uses wrangler CLI (bundled as devDependency) for Worker upload and secrets.
 * Authentication via env vars â€” no interactive login needed.
 *
 * Authentication priority (wrangler reads these automatically):
 *   CLOUDFLARE_API_TOKEN   â€” scoped API token (preferred)
 *   CLOUDFLARE_API_KEY + CLOUDFLARE_EMAIL â€” Global API Key fallback
 *
 * Steps:
 *   1. Read config from .env
 *   2. wrangler deploy  â†’ bundles + uploads Worker + enables workers.dev
 *   3. wrangler secret put  → sets STRIPE_SECRET_KEY, SITE_URL (combined with BASE_PATH), address vars
 *   4. Creates a zone route if CLOUDFLARE_ZONE_ID + CLOUDFLARE_WORKER_ROUTE are set
 *
 * Run: bun run deploy:checkout:cloudflare
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const WORKER_NAME = 'flint-checkout';
const CF_API = 'https://api.cloudflare.com/client/v4';

/* ------------------------------------------------------------------ */
/*  Env helpers                                                        */
/* ------------------------------------------------------------------ */

function readEnvFile(): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(join(ROOT, '.env'), 'utf-8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#') && l.includes('='))
        .map((l) => {
          const idx = l.indexOf('=');
          return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()] as [string, string];
        }),
    );
  } catch {
    return {};
  }
}

const envFile = readEnvFile();

function getEnv(key: string): string {
  return process.env[key] || envFile[key] || '';
}

function patchEnvFile(key: string, value: string): void {
  const envPath = join(ROOT, '.env');
  let contents = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(contents)) {
    contents = contents.replace(regex, `${key}=${value}`);
  } else {
    contents += `\n${key}=${value}\n`;
  }
  writeFileSync(envPath, contents, 'utf-8');
  console.log(`  âœ“ Written ${key} to .env`);
}

/* ------------------------------------------------------------------ */
/*  Wrangler auth env                                                  */
/* ------------------------------------------------------------------ */

function getWranglerEnv(): Record<string, string> {
  const env: Record<string, string> = { ...process.env as Record<string, string> };

  // Wrangler uses CLOUDFLARE_API_TOKEN for Bearer token auth
  const token = getEnv('CLOUDFLARE_WORKERS_TOKEN') || getEnv('CLOUDFLARE_API_TOKEN');
  if (token) {
    env['CLOUDFLARE_API_TOKEN'] = token;
    return env;
  }

  // Wrangler uses CLOUDFLARE_API_KEY + CLOUDFLARE_EMAIL for Global Key auth
  const apiKey = getEnv('CLOUDFLARE_GLOBAL_API_KEY');
  const email = getEnv('CLOUDFLARE_EMAIL');
  if (apiKey && email) {
    env['CLOUDFLARE_API_KEY'] = apiKey;
    env['CLOUDFLARE_EMAIL'] = email;
    return env;
  }

  throw new Error(
    'No Cloudflare credentials found.\n' +
    'Add CLOUDFLARE_WORKERS_TOKEN or (CLOUDFLARE_GLOBAL_API_KEY + CLOUDFLARE_EMAIL) to .env',
  );
}

/* ------------------------------------------------------------------ */
/*  Run a wrangler command                                             */
/* ------------------------------------------------------------------ */

async function wrangler(args: string[], stdin?: string): Promise<string> {
  const env = getWranglerEnv();
  const accountId = getEnv('CLOUDFLARE_ACCOUNT_ID');
  if (accountId) env['CLOUDFLARE_ACCOUNT_ID'] = accountId;

  const proc = Bun.spawn(['bunx', 'wrangler', ...args], {
    cwd: ROOT,
    env,
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: stdin !== undefined ? new TextEncoder().encode(stdin + '\n') : undefined,
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(`wrangler ${args[0]} failed (exit ${exitCode}):\n${stderr || stdout}`);
  }

  return stdout + stderr;
}

/* ------------------------------------------------------------------ */
/*  Step 1: Deploy Worker                                              */
/* ------------------------------------------------------------------ */

async function deployWorker(): Promise<void> {
  console.log('  Deploying Worker via wrangler...');
  await wrangler(['deploy', '--config', 'wrangler.toml', '--name', WORKER_NAME]);
  console.log('  ✔ Deployed');
}

/* ------------------------------------------------------------------ */
/*  Resolve Worker URL from CF API                                     */
/* ------------------------------------------------------------------ */

async function getWorkerUrl(): Promise<string> {
  const accountId = getEnv('CLOUDFLARE_ACCOUNT_ID');
  if (!accountId) return `https://${WORKER_NAME}.workers.dev`;
  try {
    const result = (await cfFetch(`/accounts/${accountId}/workers/subdomain`)) as { subdomain: string };
    if (result?.subdomain) return `https://${WORKER_NAME}.${result.subdomain}.workers.dev`;
  } catch {
    // ignore — fall through to generic URL
  }
  return `https://${WORKER_NAME}.workers.dev`;
}

/* ------------------------------------------------------------------ */
/*  Step 2: Set secrets via wrangler secret put                        */
/* ------------------------------------------------------------------ */

async function putSecret(name: string, value: string): Promise<void> {
  await wrangler(['secret', 'put', name, '--name', WORKER_NAME], value);
  console.log(`  âœ“ Secret: ${name}`);
}

async function setSecrets(): Promise<void> {
  console.log('  Setting Worker secrets...');

  const stripeKey = getEnv('STRIPE_SECRET_KEY');
  if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not found in .env');
  await putSecret('STRIPE_SECRET_KEY', stripeKey);

  // CLOUDFLARE_SITE_URL overrides SITE_URL+BASE_PATH — set it to your production URL
  // so local SITE_URL (localhost) doesn't get pushed to the Worker.
  const fullSiteUrl = (() => {
    const override = getEnv('CLOUDFLARE_SITE_URL');
    if (override) return override.replace(/\/$/, '');
    const siteUrl = getEnv('SITE_URL');
    if (!siteUrl) throw new Error('SITE_URL or CLOUDFLARE_SITE_URL not found in .env');
    const basePath = getEnv('BASE_PATH').replace(/\/$/, '');
    return siteUrl.replace(/\/$/, '') + basePath;
  })();
  await putSecret('SITE_URL', fullSiteUrl);
  console.log(`  ℹ SITE_URL secret → ${fullSiteUrl}`);

  const billing = getEnv('STRIPE_BILLING_ADDRESS');
  if (billing) await putSecret('STRIPE_BILLING_ADDRESS', billing);

  const shipping = getEnv('STRIPE_SHIPPING_COUNTRIES');
  if (shipping) await putSecret('STRIPE_SHIPPING_COUNTRIES', shipping);
}

/* ------------------------------------------------------------------ */
/*  Step 3: Zone route (optional, via REST API)                        */
/* ------------------------------------------------------------------ */

function getCfApiHeaders(): Record<string, string> {
  const token = getEnv('CLOUDFLARE_WORKERS_TOKEN') || getEnv('CLOUDFLARE_API_TOKEN');
  if (token) return { Authorization: `Bearer ${token}` };
  const apiKey = getEnv('CLOUDFLARE_GLOBAL_API_KEY');
  const email = getEnv('CLOUDFLARE_EMAIL');
  if (apiKey && email) return { 'X-Auth-Email': email, 'X-Auth-Key': apiKey };
  throw new Error('No Cloudflare credentials');
}

async function cfFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${CF_API}${path}`, {
    ...options,
    headers: { ...getCfApiHeaders(), ...(options.headers as Record<string, string> | undefined) },
  });
  const json = (await res.json()) as { success: boolean; result: unknown; errors: { message: string }[] };
  if (!json.success) {
    throw new Error(`Cloudflare API: ${json.errors?.map((e) => e.message).join(', ')}`);
  }
  return json.result;
}

async function ensureRoute(): Promise<void> {
  const zoneId = getEnv('CLOUDFLARE_ZONE_ID');
  const routePattern = getEnv('CLOUDFLARE_WORKER_ROUTE');

  if (!zoneId || !routePattern) {
    console.log('  â„¹ No CLOUDFLARE_ZONE_ID/CLOUDFLARE_WORKER_ROUTE â€” using workers.dev subdomain');
    return;
  }

  console.log(`  Setting zone route: ${routePattern}`);
  const routes = (await cfFetch(`/zones/${zoneId}/workers/routes`)) as Array<{
    id: string; pattern: string; script: string;
  }>;
  const existing = routes?.find((r) => r.pattern === routePattern);

  if (existing?.script === WORKER_NAME) {
    console.log('  âœ“ Route already correct');
    return;
  }

  if (existing) {
    await cfFetch(`/zones/${zoneId}/workers/routes/${existing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: routePattern, script: WORKER_NAME }),
    });
  } else {
    await cfFetch(`/zones/${zoneId}/workers/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: routePattern, script: WORKER_NAME }),
    });
  }
  console.log(`  âœ“ Route set: ${routePattern}`);
}

/* ------------------------------------------------------------------ */
/*  Step 3b: Enable workers.dev subdomain (REST API)                   */
/* ------------------------------------------------------------------ */

async function enableSubdomain(): Promise<void> {
  const accountId = getEnv('CLOUDFLARE_ACCOUNT_ID');
  if (!accountId) {
    console.log('  ℹ No CLOUDFLARE_ACCOUNT_ID — skipping subdomain enable');
    return;
  }
  console.log('  Enabling workers.dev subdomain...');
  try {
    await cfFetch(`/accounts/${accountId}/workers/scripts/${WORKER_NAME}/subdomain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    console.log('  ✔ workers.dev subdomain enabled');
  } catch (err) {
    // Non-fatal — subdomain may already be enabled
    console.warn('  ⚠ Could not enable workers.dev subdomain:', err instanceof Error ? err.message : err);
  }
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function deploy(): Promise<void> {
  console.log('\n🚀 Deploying Flint checkout → Cloudflare Workers\n');

  await deployWorker();
  await setSecrets();
  await enableSubdomain();
  await ensureRoute();

  const workerUrl = await getWorkerUrl();
  console.log('\n✅ Deployed!\n');
  console.log(`  Worker: ${workerUrl}/checkout`);
  console.log(`  Health: ${workerUrl}/health`);
  console.log('\n  Ensure .env and GitHub Variables have:');
  console.log('    CHECKOUT_MODE=serverless');
  console.log(`    CHECKOUT_ENDPOINT=${workerUrl}\n`);
}

deploy().catch((err) => {
  console.error('\nâŒ Deploy failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
