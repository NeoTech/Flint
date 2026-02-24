/**
 * Tests for api/deploy.ts — read/write service config files.
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import {
  mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// ---- mock registry ----------------------------------------------------------

let mockSitePath = '';

mock.module('../registry.js', () => ({
  getSite: (id: string) => id === 'test' ? { id: 'test', name: 'Test', path: mockSitePath } : null,
  resolveSitePath: (site: { path: string }) => site.path,
  loadRegistry: () => [],
  saveRegistry: () => {},
  upsertSite: () => {},
  removeSite: () => {},
}));

const { handleGetDeployConfig, handleSaveDeployConfig } = await import('./deploy.js');

// ---- helpers ----------------------------------------------------------------

async function json(r: Response): Promise<unknown> {
  return r.json();
}

function putReq(body: unknown): Request {
  return new Request('http://localhost/', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ---- setup ------------------------------------------------------------------

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'manager-deploy-test-'));
  mockSitePath = tempDir;
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

// ---- handleGetDeployConfig --------------------------------------------------

describe('handleGetDeployConfig — unknown site', () => {
  it('returns 404 for unknown site', async () => {
    const resp = handleGetDeployConfig('unknown', 'vercel');
    expect(resp.status).toBe(404);
  });
});

describe('handleGetDeployConfig — unknown service', () => {
  it('returns 400 for unknown service', async () => {
    const resp = handleGetDeployConfig('test', 'fakePlatform');
    expect(resp.status).toBe(400);
  });
});

describe('handleGetDeployConfig — vercel (no file)', () => {
  it('returns exists:false with normalised defaults when vercel.json absent', async () => {
    const resp = handleGetDeployConfig('test', 'vercel');
    expect(resp.status).toBe(200);
    const data = await json(resp) as Record<string, unknown>;
    expect(data.exists).toBe(false);
    expect(data.configFile).toBe('vercel.json');
    const cfg = data.config as Record<string, unknown>;
    expect(cfg.outputDirectory).toBe('dist');
  });
});

describe('handleGetDeployConfig — vercel (file exists)', () => {
  it('parses existing vercel.json and returns normalised config', async () => {
    writeFileSync(join(tempDir, 'vercel.json'), JSON.stringify({
      outputDirectory: 'public',
      buildCommand: 'bun run build',
      cleanUrls: true,
    }), 'utf-8');

    const resp = handleGetDeployConfig('test', 'vercel');
    expect(resp.status).toBe(200);
    const data = await json(resp) as Record<string, unknown>;
    expect(data.exists).toBe(true);
    const cfg = data.config as Record<string, unknown>;
    expect(cfg.outputDirectory).toBe('public');
    expect(cfg.buildCommand).toBe('bun run build');
    expect(cfg.cleanUrls).toBe(true);
  });
});

describe('handleGetDeployConfig — cloudflare', () => {
  it('returns empty config and exists:false (env-only service, no config file)', async () => {
    const resp = handleGetDeployConfig('test', 'cloudflare');
    expect(resp.status).toBe(200);
    const data = await json(resp) as Record<string, unknown>;
    expect(data.exists).toBe(false);
    expect(data.configFile).toBe('');
    expect(data.config).toEqual({});
  });

  it('reports set status of Worker env vars from .env file', async () => {
    writeFileSync(join(tempDir, '.env'), 'CF_WORKER_NAME=flint-checkout\nCLOUDFLARE_ACCOUNT_ID=abc123\n', 'utf-8');
    const resp = handleGetDeployConfig('test', 'cloudflare');
    const data = await json(resp) as Record<string, unknown>;
    const envVars = data.envVars as Array<{ name: string; set: boolean }>;
    expect(envVars.find(v => v.name === 'CF_WORKER_NAME')?.set).toBe(true);
    expect(envVars.find(v => v.name === 'CLOUDFLARE_ACCOUNT_ID')?.set).toBe(true);
    expect(envVars.find(v => v.name === 'CF_WORKER_MAIN')?.set).toBe(false);
  });
});

describe('handleGetDeployConfig — netlify', () => {
  it('parses existing netlify.toml build section', async () => {
    writeFileSync(join(tempDir, 'netlify.toml'),
      '[build]\npublish = "dist"\ncommand = "bun run build"\n', 'utf-8');
    const resp = handleGetDeployConfig('test', 'netlify');
    expect(resp.status).toBe(200);
    const data = await json(resp) as Record<string, unknown>;
    expect(data.exists).toBe(true);
    const cfg = data.config as Record<string, unknown>;
    expect(cfg.publish).toBe('dist');
    expect(cfg.command).toBe('bun run build');
    expect(cfg.functionsDir).toBe('');
  });

  it('parses [functions] directory from netlify.toml', async () => {
    writeFileSync(join(tempDir, 'netlify.toml'),
      '[build]\npublish = "dist"\n\n[functions]\ndirectory = "netlify/functions"\n', 'utf-8');
    const resp = handleGetDeployConfig('test', 'netlify');
    const data = await json(resp) as Record<string, unknown>;
    const cfg = data.config as Record<string, unknown>;
    expect(cfg.functionsDir).toBe('netlify/functions');
  });
});

describe('handleGetDeployConfig — env vars', () => {
  it('reports env var set status from .env file', async () => {
    writeFileSync(join(tempDir, '.env'), 'VERCEL_TOKEN=tok123\n', 'utf-8');
    const resp = handleGetDeployConfig('test', 'vercel');
    const data = await json(resp) as Record<string, unknown>;
    const envVars = data.envVars as Array<{ name: string; set: boolean }>;
    const tokenVar = envVars.find(v => v.name === 'VERCEL_TOKEN');
    expect(tokenVar?.set).toBe(true);
  });

  it('reports env var missing when .env absent', async () => {
    const resp = handleGetDeployConfig('test', 'vercel');
    const data = await json(resp) as Record<string, unknown>;
    const envVars = data.envVars as Array<{ name: string; set: boolean }>;
    expect(envVars.every(v => !v.set)).toBe(true);
  });
});

// ---- handleSaveDeployConfig -------------------------------------------------

describe('handleSaveDeployConfig — vercel', () => {
  it('creates vercel.json with correct shape', async () => {
    const resp = await handleSaveDeployConfig('test', 'vercel', putReq({
      outputDirectory: 'dist',
      buildCommand: 'bun run build',
      cleanUrls: true,
      trailingSlash: false,
    }));
    expect(resp.status).toBe(200);
    const data = await json(resp) as Record<string, unknown>;
    expect(data.ok).toBe(true);
    expect(data.configFile).toBe('vercel.json');

    const written = JSON.parse(readFileSync(join(tempDir, 'vercel.json'), 'utf-8'));
    expect(written.outputDirectory).toBe('dist');
    expect(written.cleanUrls).toBe(true);
    expect(written.buildCommand).toBe('bun run build');
  });

  it('preserves unmanaged fields on existing vercel.json', async () => {
    writeFileSync(join(tempDir, 'vercel.json'), JSON.stringify({ myCustomField: 42 }), 'utf-8');
    await handleSaveDeployConfig('test', 'vercel', putReq({ outputDirectory: 'dist' }));
    const written = JSON.parse(readFileSync(join(tempDir, 'vercel.json'), 'utf-8'));
    expect(written.myCustomField).toBe(42);
    expect(written.outputDirectory).toBe('dist');
  });
});

describe('handleSaveDeployConfig — netlify', () => {
  it('creates a valid netlify.toml with build section', async () => {
    const resp = await handleSaveDeployConfig('test', 'netlify', putReq({
      publish: 'dist',
      command: 'bun run build',
    }));
    expect(resp.status).toBe(200);
    expect(existsSync(join(tempDir, 'netlify.toml'))).toBe(true);
    const raw = readFileSync(join(tempDir, 'netlify.toml'), 'utf-8');
    expect(raw).toContain('publish');
    expect(raw).toContain('dist');
  });

  it('writes [functions] directory when functionsDir provided', async () => {
    await handleSaveDeployConfig('test', 'netlify', putReq({
      publish: 'dist',
      command: 'bun run build',
      functionsDir: 'netlify/functions',
    }));
    const raw = readFileSync(join(tempDir, 'netlify.toml'), 'utf-8');
    expect(raw).toContain('netlify/functions');
    // Re-read as parsed config to confirm structure
    const resp = handleGetDeployConfig('test', 'netlify');
    const data = await json(resp) as Record<string, unknown>;
    const cfg = data.config as Record<string, unknown>;
    expect(cfg.functionsDir).toBe('netlify/functions');
  });

  it('omits [functions] section when functionsDir is empty', async () => {
    await handleSaveDeployConfig('test', 'netlify', putReq({
      publish: 'dist',
      command: 'bun run build',
      functionsDir: '',
    }));
    const raw = readFileSync(join(tempDir, 'netlify.toml'), 'utf-8');
    expect(raw).not.toContain('[functions]');
  });
});

describe('handleSaveDeployConfig — cloudflare', () => {
  it('returns 400 because cloudflare is env-only (no config file to write)', async () => {
    const resp = await handleSaveDeployConfig('test', 'cloudflare', putReq({
      name: 'my-site',
    }));
    expect(resp.status).toBe(400);
    const data = await resp.json() as { error: string };
    expect(data.error).toMatch(/no config file/i);
  });

  it('returns 400 for cloudflare-pages too (env-only)', async () => {
    const resp = await handleSaveDeployConfig('test', 'cloudflare-pages', putReq({
      name: 'my-site',
    }));
    expect(resp.status).toBe(400);
    const data = await resp.json() as { error: string };
    expect(data.error).toMatch(/no config file/i);
  });
});

describe('handleSaveDeployConfig — ghpages', () => {
  it('returns 400 because ghpages has no config file to write', async () => {
    const resp = await handleSaveDeployConfig('test', 'ghpages', putReq({
      branch: 'main',
    }));
    expect(resp.status).toBe(400);
    const data = await resp.json() as { error: string };
    expect(data.error).toMatch(/no config file/i);
  });
});

describe('handleSaveDeployConfig — errors', () => {
  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const resp = await handleSaveDeployConfig('test', 'vercel', req);
    expect(resp.status).toBe(400);
  });

  it('returns 400 for unknown service', async () => {
    const resp = await handleSaveDeployConfig('test', 'unknown', putReq({}));
    expect(resp.status).toBe(400);
  });

  it('returns 404 for unknown site', async () => {
    const resp = await handleSaveDeployConfig('unknown', 'vercel', putReq({}));
    expect(resp.status).toBe(404);
  });
});
