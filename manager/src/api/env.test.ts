/**
 * Tests for api/env.ts — read/write .env with secret masking.
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// ---- mock registry ----------------------------------------------------------

let mockSitePath = '';

mock.module('../registry.js', () => ({
  getSite: (id: string) => id === 'test' ? { id: 'test', name: 'Test', path: mockSitePath } : null,
  resolveSitePath: (site: { path: string }) => site.path,
  // include full surface so other test files don't see a partial mock
  loadRegistry: () => [],
  saveRegistry: () => {},
  upsertSite: () => {},
  removeSite: () => {},
}));

const { handleGetEnv, handleSaveEnv } = await import('./env.js');

// ---- helpers ----------------------------------------------------------------

async function jsonBody(r: Response): Promise<unknown> {
  return r.json();
}

function makePutRequest(body: unknown): Request {
  return new Request('http://localhost/', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const MASK = '••••••';

// ---- setup ------------------------------------------------------------------

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'manager-env-test-'));
  mockSitePath = tempDir;
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

// ---- handleGetEnv -----------------------------------------------------------

describe('handleGetEnv', () => {
  it('returns empty array when .env does not exist', async () => {
    const resp = handleGetEnv('test');
    expect(resp.status).toBe(200);
    expect(await jsonBody(resp)).toEqual([]);
  });

  it('returns plain key-value pairs unmasked', async () => {
    writeFileSync(join(tempDir, '.env'), 'TITLE=My Site\nFOO=bar\n');
    const resp = handleGetEnv('test');
    expect(resp.status).toBe(200);
    const body = await jsonBody(resp) as Array<{ key: string; value: string; masked: boolean }>;
    expect(body.find(e => e.key === 'TITLE')).toMatchObject({ value: 'My Site', masked: false });
    expect(body.find(e => e.key === 'FOO')).toMatchObject({ value: 'bar', masked: false });
  });

  it('masks fields containing SECRET', async () => {
    writeFileSync(join(tempDir, '.env'), 'API_SECRET=abc123\n');
    const resp = handleGetEnv('test');
    const body = await jsonBody(resp) as Array<{ key: string; value: string; masked: boolean }>;
    expect(body[0]).toMatchObject({ key: 'API_SECRET', value: MASK, masked: true });
  });

  it('masks fields containing KEY', async () => {
    writeFileSync(join(tempDir, '.env'), 'STRIPE_KEY=sk_test_xyz\n');
    const resp = handleGetEnv('test');
    const body = await jsonBody(resp) as Array<{ key: string; value: string; masked: boolean }>;
    expect(body[0].masked).toBe(true);
    expect(body[0].value).toBe(MASK);
  });

  it('masks TOKEN, PASSWORD, PRIVATE, STRIPE fields', async () => {
    const env = [
      'SESSION_TOKEN=tok123',
      'DB_PASSWORD=secret',
      'PRIVATE_KEY=rsa-key',
      'STRIPE_SECRET=whsec_xxx',
    ].join('\n');
    writeFileSync(join(tempDir, '.env'), env);
    const resp = handleGetEnv('test');
    const body = await jsonBody(resp) as Array<{ key: string; value: string; masked: boolean }>;
    for (const entry of body) {
      expect(entry.masked).toBe(true);
      expect(entry.value).toBe(MASK);
    }
  });

  it('does not mask THEME= line', async () => {
    writeFileSync(join(tempDir, '.env'), 'THEME=dark\n');
    const resp = handleGetEnv('test');
    const body = await jsonBody(resp) as Array<{ key: string; value: string; masked: boolean }>;
    expect(body[0]).toMatchObject({ key: 'THEME', value: 'dark', masked: false });
  });

  it('skips comment lines and blank lines', async () => {
    writeFileSync(join(tempDir, '.env'), '# comment\n\nFOO=bar\n');
    const resp = handleGetEnv('test');
    const body = await jsonBody(resp) as unknown[];
    expect(body).toHaveLength(1);
  });

  it('returns 404 for unknown site', () => {
    const resp = handleGetEnv('ghost');
    expect(resp.status).toBe(404);
  });
});

// ---- handleSaveEnv ----------------------------------------------------------

describe('handleSaveEnv', () => {
  it('writes new env file from given entries', async () => {
    const req = makePutRequest([
      { key: 'THEME', value: 'dark', masked: false },
      { key: 'SITE_TITLE', value: 'My Blog', masked: false },
    ]);
    const resp = await handleSaveEnv('test', req);
    expect(resp.status).toBe(200);
    const saved = readFileSync(join(tempDir, '.env'), 'utf-8');
    expect(saved).toContain('THEME=dark');
    expect(saved).toContain('SITE_TITLE=My Blog');
  });

  it('masked entry with mask sentinel preserves original secret', async () => {
    writeFileSync(join(tempDir, '.env'), 'API_KEY=real-secret\n');
    const req = makePutRequest([{ key: 'API_KEY', value: MASK, masked: true }]);
    const resp = await handleSaveEnv('test', req);
    expect(resp.status).toBe(200);
    const saved = readFileSync(join(tempDir, '.env'), 'utf-8');
    expect(saved).toContain('API_KEY=real-secret');
    expect(saved).not.toContain(MASK);
  });

  it('masked entry with new value overwrites the secret', async () => {
    writeFileSync(join(tempDir, '.env'), 'API_KEY=old-secret\n');
    const req = makePutRequest([{ key: 'API_KEY', value: 'new-value', masked: true }]);
    const resp = await handleSaveEnv('test', req);
    expect(resp.status).toBe(200);
    const saved = readFileSync(join(tempDir, '.env'), 'utf-8');
    expect(saved).toContain('API_KEY=new-value');
    expect(saved).not.toContain('old-secret');
  });

  it('creates .env if it does not exist', async () => {
    expect(existsSync(join(tempDir, '.env'))).toBe(false);
    const req = makePutRequest([{ key: 'FOO', value: 'bar', masked: false }]);
    const resp = await handleSaveEnv('test', req);
    expect(resp.status).toBe(200);
    expect(existsSync(join(tempDir, '.env'))).toBe(true);
  });

  it('preserved masked key absent from original falls back to empty string', async () => {
    // No original .env
    const req = makePutRequest([{ key: 'API_KEY', value: MASK, masked: true }]);
    const resp = await handleSaveEnv('test', req);
    expect(resp.status).toBe(200);
    const saved = readFileSync(join(tempDir, '.env'), 'utf-8');
    expect(saved).toContain('API_KEY=');
    // the value should be empty (not the mask sentinel)
    expect(saved).not.toContain(MASK);
  });

  it('returns 400 on invalid JSON', async () => {
    const req = new Request('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json{{{',
    });
    const resp = await handleSaveEnv('test', req);
    expect(resp.status).toBe(400);
  });

  it('returns 400 if body is not an array', async () => {
    const req = makePutRequest({ key: 'FOO', value: 'bar' });
    const resp = await handleSaveEnv('test', req);
    expect(resp.status).toBe(400);
  });

  it('returns 404 for unknown site', async () => {
    const req = makePutRequest([]);
    const resp = await handleSaveEnv('ghost', req);
    expect(resp.status).toBe(404);
  });

  it('round-trips multiple entries including one masked and one plain', async () => {
    writeFileSync(join(tempDir, '.env'), 'STRIPE_KEY=sk_live_xyz\nTHEME=light\n');
    const req = makePutRequest([
      { key: 'STRIPE_KEY', value: MASK, masked: true },
      { key: 'THEME', value: 'dark', masked: false },
    ]);
    await handleSaveEnv('test', req);
    const saved = readFileSync(join(tempDir, '.env'), 'utf-8');
    // Secret preserved, plain updated
    expect(saved).toContain('STRIPE_KEY=sk_live_xyz');
    expect(saved).toContain('THEME=dark');
  });
});
