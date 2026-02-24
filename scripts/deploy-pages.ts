/**
 * Deploy the Flint static site to Cloudflare Pages via the Direct Upload API.
 *
 * Does NOT use wrangler — calls the CF API directly so it works reliably in
 * all subprocess contexts (terminal, manager SSE runner, CI).
 *
 * Steps:
 *   1. Read project name + dist dir from .env (CF_PAGES_PROJECT / CF_PAGES_DIR)
 *   2. Scan dist/ and compute MD5 hash for every file
 *   3. Ensure the Pages project exists (create if not)
 *   4. Get a short-lived upload JWT from CF
 *   5. POST check-missing → find which file hashes CF doesn't have yet
 *   6. Upload missing files in batches of 50
 *   7. Upsert all hashes so CF knows the full set
 *   8. POST create deployment with full manifest
 *
 * Run: bun run deploy:cloudflare:pages
 */

import { createHash } from 'crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const UPLOAD_API = 'https://api.cloudflare.com/client/v4/pages/assets';
const UPLOAD_BATCH = 50; // files per upload request

const ROOT = process.cwd();
const CF_API = 'https://api.cloudflare.com/client/v4';

/* ------------------------------------------------------------------ */
/*  Config from .env                                                   */
/* ------------------------------------------------------------------ */

function readPagesConfig(): { name: string; distDir: string } {
  const name    = getEnv('CF_PAGES_PROJECT')?.trim();
  const distDir = getEnv('CF_PAGES_DIR')?.trim() || 'dist';
  if (!name) throw new Error('CF_PAGES_PROJECT not set in .env. Add: CF_PAGES_PROJECT=your-project-name');
  return { name, distDir };
}

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
  return process.env[key] ?? envFile[key] ?? '';
}

/* ------------------------------------------------------------------ */
/*  Cloudflare API auth headers                                       */
/* ------------------------------------------------------------------ */

function getCfApiHeaders(): Record<string, string> {
  const token = getEnv('CLOUDFLARE_API_TOKEN');
  if (token) return { Authorization: `Bearer ${token}` };
  const apiKey = getEnv('CLOUDFLARE_GLOBAL_API_KEY');
  const email  = getEnv('CLOUDFLARE_EMAIL');
  if (apiKey && email) return { 'X-Auth-Email': email, 'X-Auth-Key': apiKey };
  throw new Error(
    'No Cloudflare credentials found.\n' +
    'Add CLOUDFLARE_API_TOKEN (recommended) or CLOUDFLARE_GLOBAL_API_KEY + CLOUDFLARE_EMAIL to .env',
  );
}

type CfResponse<T = unknown> = { success: boolean; result: T; errors: { code: number; message: string }[] };

async function cfFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<CfResponse<T>> {
  const res = await fetch(`${CF_API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getCfApiHeaders(),
      ...(options.headers as Record<string, string> | undefined),
    },
  });
  return res.json() as Promise<CfResponse<T>>;
}

/* ------------------------------------------------------------------ */
/*  File scanning + hashing                                           */
/* ------------------------------------------------------------------ */

interface FileEntry {
  absPath:     string;
  urlPath:     string; // /index.html, /assets/main.css, …
  hash:        string; // MD5 hex
  bytes:       Buffer;
  contentType: string;
}

function getMimeType(name: string): string {
  if (name.endsWith('.html'))                        return 'text/html; charset=utf-8';
  if (name.endsWith('.css'))                         return 'text/css; charset=utf-8';
  if (name.endsWith('.js'))                          return 'application/javascript; charset=utf-8';
  if (name.endsWith('.json'))                        return 'application/json; charset=utf-8';
  if (name.endsWith('.txt'))                         return 'text/plain; charset=utf-8';
  if (name.endsWith('.xml'))                         return 'application/xml; charset=utf-8';
  if (name.endsWith('.map'))                         return 'application/json; charset=utf-8';
  if (name.endsWith('.svg'))                         return 'image/svg+xml';
  if (name.endsWith('.png'))                         return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.gif'))                         return 'image/gif';
  if (name.endsWith('.ico'))                         return 'image/x-icon';
  if (name.endsWith('.webp'))                        return 'image/webp';
  if (name.endsWith('.woff'))                        return 'font/woff';
  if (name.endsWith('.woff2'))                       return 'font/woff2';
  if (name.endsWith('.ttf'))                         return 'font/ttf';
  return 'application/octet-stream';
}

function scanDir(baseDir: string): FileEntry[] {
  const entries: FileEntry[] = [];
  function walk(dir: string): void {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) {
        walk(abs);
      } else {
        const bytes = readFileSync(abs) as Buffer;
        const hash  = createHash('md5').update(bytes).digest('hex');
        const rel   = relative(baseDir, abs).replace(/\\/g, '/');
        entries.push({ absPath: abs, urlPath: `/${rel}`, hash, bytes, contentType: getMimeType(name) });
      }
    }
  }
  walk(baseDir);
  return entries;
}

/* ------------------------------------------------------------------ */
/*  Direct Upload API                                                  */
/* ------------------------------------------------------------------ */

async function getUploadToken(accountId: string, projectName: string): Promise<string> {
  const res = await cfFetch<{ jwt: string }>(`/accounts/${accountId}/pages/projects/${projectName}/upload-token`);
  if (!res.success || !res.result?.jwt) {
    throw new Error(`Failed to get upload token: ${res.errors?.map((e) => e.message).join(', ')}`);
  }
  return res.result.jwt;
}

async function checkMissing(jwt: string, hashes: string[]): Promise<string[]> {
  const res = await fetch(`${UPLOAD_API}/check-missing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ hashes }),
  });
  const data = await res.json() as CfResponse<string[]>;
  if (!data.success) throw new Error(`check-missing failed: ${JSON.stringify(data.errors)}`);
  return data.result ?? [];
}

async function upsertHashes(jwt: string, hashes: string[]): Promise<void> {
  const res = await fetch(`${UPLOAD_API}/upsert-hashes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ hashes }),
  });
  const data = await res.json() as CfResponse;
  if (!data.success) throw new Error(`upsert-hashes failed: ${JSON.stringify(data.errors)}`);
}

async function uploadBatch(jwt: string, files: FileEntry[]): Promise<void> {
  const payload = files.map((f) => ({
    key:      f.hash,
    value:    f.bytes.toString('base64'),
    metadata: { contentType: f.contentType },
    base64:   true,
  }));
  const res = await fetch(`${UPLOAD_API}/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(payload),
  });
  const data = await res.json() as CfResponse;
  if (!data.success) throw new Error(`upload failed: ${JSON.stringify(data.errors)}`);
}

async function createDeployment(
  accountId: string,
  projectName: string,
  manifest: Record<string, string>,
): Promise<{ id: string; url: string }> {
  let branch = 'main';
  let commitHash = '';
  let commitMessage = '';
  try {
    const { execSync } = await import('child_process');
    branch        = execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT }).toString().trim();
    commitHash    = execSync('git rev-parse HEAD',              { cwd: ROOT }).toString().trim();
    commitMessage = execSync('git log -1 --format=%s',          { cwd: ROOT }).toString().trim();
  } catch { /* no git — use defaults */ }

  const form = new FormData();
  form.append('manifest',       JSON.stringify(manifest));
  form.append('branch',         branch);
  if (commitHash)    form.append('commit_hash',    commitHash);
  if (commitMessage) form.append('commit_message', commitMessage);
  form.append('commit_dirty', 'true');

  const res = await fetch(`${CF_API}/accounts/${accountId}/pages/projects/${projectName}/deployments`, {
    method: 'POST',
    headers: getCfApiHeaders(),
    body: form,
  });
  const data = await res.json() as CfResponse<{ id: string; url: string; short_id: string }>;
  if (!data.success) {
    throw new Error(`create deployment failed: ${JSON.stringify(data.errors)}`);
  }
  return {
    id:  data.result.id,
    url: data.result.url ?? `https://${data.result.short_id}.${projectName}.pages.dev`,
  };
}

/* ------------------------------------------------------------------ */
/*  Ensure project exists                                             */
/* ------------------------------------------------------------------ */

async function ensureProject(accountId: string, projectName: string): Promise<void> {
  const res = await cfFetch(`/accounts/${accountId}/pages/projects/${projectName}`);

  if (res.success) {
    console.log(`  ✔ Project "${projectName}" already exists`);
    return;
  }

  // Error 8000007 = project not found — create it
  const notFound = res.errors?.some((e) => e.code === 8000007);
  if (!notFound) {
    throw new Error(`Cloudflare API: ${res.errors?.map((e) => e.message).join(', ')}`);
  }

  console.log(`  ℹ Project "${projectName}" not found — creating...`);
  const create = await cfFetch(`/accounts/${accountId}/pages/projects`, {
    method: 'POST',
    body: JSON.stringify({ name: projectName, production_branch: 'main' }),
  });
  if (!create.success) {
    throw new Error(`Failed to create project: ${create.errors?.map((e) => e.message).join(', ')}`);
  }
  console.log(`  ✔ Project "${projectName}" created`);
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const { name, distDir } = readPagesConfig();
  const absDistDir = join(ROOT, distDir);

  const accountId = getEnv('CLOUDFLARE_ACCOUNT_ID');
  if (!accountId) throw new Error('CLOUDFLARE_ACCOUNT_ID not found in .env');

  if (!existsSync(absDistDir)) {
    throw new Error(`Build output directory "${distDir}" does not exist.\nRun "bun run build" first.`);
  }

  console.log(`\nDeploying "${name}" from "${distDir}" to Cloudflare Pages...\n`);

  await ensureProject(accountId, name);

  // Scan all files in dist/
  const files = scanDir(absDistDir);
  if (files.length === 0) {
    throw new Error(`Build output directory "${distDir}" is empty.\nRun "bun run build" first.`);
  }
  console.log(`  Scanning ${files.length} files...`);

  // Get short-lived upload JWT
  const jwt = await getUploadToken(accountId, name);

  // Determine which files CF is missing
  const allHashes     = files.map((f) => f.hash);
  const missingHashes = await checkMissing(jwt, allHashes);
  const cached = files.length - missingHashes.length;
  console.log(`  ${missingHashes.length} to upload, ${cached} already cached`);

  // Upload missing files in batches
  if (missingHashes.length > 0) {
    const missing = files.filter((f) => missingHashes.includes(f.hash));
    for (let i = 0; i < missing.length; i += UPLOAD_BATCH) {
      const batch = missing.slice(i, i + UPLOAD_BATCH);
      const done  = Math.min(i + batch.length, missing.length);
      process.stdout.write(`  Uploading ${done}/${missing.length}...\r`);
      await uploadBatch(jwt, batch);
    }
    process.stdout.write('\n');
  }

  // Register all hashes with CF so the manifest is complete
  await upsertHashes(jwt, allHashes);

  // Build manifest: { "/path/to/file.html": "md5hash", … }
  const manifest = Object.fromEntries(files.map((f) => [f.urlPath, f.hash]));

  // Create the actual deployment record
  console.log('  Creating deployment...');
  const deployment = await createDeployment(accountId, name, manifest);
  console.log(`\n  ✔ Deployed: ${deployment.url}`);
  console.log('\n✔ Deployed successfully\n');
}

main().catch((err) => {
  console.error('\n✘', (err as Error).message);
  process.exit(1);
});
