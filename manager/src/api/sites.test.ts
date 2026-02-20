/**
 * Tests for api/sites.ts — register, list, and remove site instances.
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { SiteEntry } from '../registry.js';

// ---- mock registry ----------------------------------------------------------

let mockRegistry: SiteEntry[] = [];

mock.module('../registry.js', () => ({
  loadRegistry: () => [...mockRegistry],
  upsertSite: (entry: SiteEntry) => {
    const idx = mockRegistry.findIndex(s => s.id === entry.id);
    if (idx >= 0) mockRegistry[idx] = entry;
    else mockRegistry.push(entry);
  },
  removeSite: (id: string) => {
    mockRegistry = mockRegistry.filter(s => s.id !== id);
  },
  getSite: (id: string) => mockRegistry.find(s => s.id === id) ?? null,
  resolveSitePath: (site: SiteEntry) => site.path,
}));

const { handleListSites, handleAddSite, handleRemoveSite } = await import('./sites.js');

// ---- helpers ----------------------------------------------------------------

function makeRequest(body: unknown, method = 'POST'): Request {
  return new Request('http://localhost/', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function jsonBody(r: Response): Promise<unknown> {
  return r.json();
}

// ---- setup ------------------------------------------------------------------

let tempDir: string;

beforeEach(() => {
  mockRegistry = [];
  tempDir = mkdtempSync(join(tmpdir(), 'manager-sites-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

// ---- handleListSites --------------------------------------------------------

describe('handleListSites', () => {
  it('returns empty array when registry is empty', async () => {
    const resp = handleListSites();
    expect(resp.status).toBe(200);
    const body = await jsonBody(resp);
    expect(body).toEqual([]);
  });

  it('returns all registered sites', async () => {
    mockRegistry = [
      { id: 'site-a', name: 'Site A', path: tempDir },
      { id: 'site-b', name: 'Site B', path: tempDir },
    ];
    const resp = handleListSites();
    expect(resp.status).toBe(200);
    const body = await jsonBody(resp) as SiteEntry[];
    expect(body).toHaveLength(2);
    expect(body.map(s => s.id)).toContain('site-a');
    expect(body.map(s => s.id)).toContain('site-b');
  });
});

// ---- handleAddSite ----------------------------------------------------------

describe('handleAddSite', () => {
  it('adds a valid site and returns 201', async () => {
    const req = makeRequest({ id: 'new-site', name: 'New Site', path: tempDir });
    const resp = await handleAddSite(req);
    expect(resp.status).toBe(201);
    const body = await jsonBody(resp) as SiteEntry;
    expect(body.id).toBe('new-site');
    expect(mockRegistry.some(s => s.id === 'new-site')).toBe(true);
  });

  it('returns 400 if id is missing', async () => {
    const req = makeRequest({ name: 'No ID', path: tempDir });
    const resp = await handleAddSite(req);
    expect(resp.status).toBe(400);
    const body = await jsonBody(resp) as Record<string, string>;
    expect(body.error).toBeTruthy();
    expect(mockRegistry).toHaveLength(0);
  });

  it('returns 400 if name is missing', async () => {
    const req = makeRequest({ id: 'x', path: tempDir });
    const resp = await handleAddSite(req);
    expect(resp.status).toBe(400);
  });

  it('returns 400 if path is missing', async () => {
    const req = makeRequest({ id: 'x', name: 'X' });
    const resp = await handleAddSite(req);
    expect(resp.status).toBe(400);
  });

  it('returns 400 if path does not exist on disk', async () => {
    const req = makeRequest({ id: 'x', name: 'X', path: '/nonexistent/path/xyz' });
    const resp = await handleAddSite(req);
    expect(resp.status).toBe(400);
    const body = await jsonBody(resp) as Record<string, string>;
    expect(body.error).toContain('does not exist');
    expect(mockRegistry).toHaveLength(0);
  });

  it('sanitizes id to lowercase-kebab', async () => {
    const sanitizedDir = mkdtempSync(join(tmpdir(), 'sanitize-test-'));
    try {
      const req = makeRequest({ id: 'My New Site!!', name: 'My Site', path: sanitizedDir });
      const resp = await handleAddSite(req);
      expect(resp.status).toBe(201);
      const body = await jsonBody(resp) as SiteEntry;
      // Only lowercase letters, numbers and hyphens
      expect(body.id).toMatch(/^[a-z0-9-]+$/);
      expect(body.id).not.toMatch(/[A-Z!]/);
    } finally {
      rmSync(sanitizedDir, { recursive: true, force: true });
    }
  });

  it('returns 400 on invalid JSON body', async () => {
    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json{{{',
    });
    const resp = await handleAddSite(req);
    expect(resp.status).toBe(400);
  });

  it('stores optional description and theme fields', async () => {
    const req = makeRequest({
      id: 'full-site',
      name: 'Full Site',
      path: tempDir,
      description: 'A test site',
      theme: 'dark',
    });
    const resp = await handleAddSite(req);
    expect(resp.status).toBe(201);
    const body = await jsonBody(resp) as SiteEntry;
    expect(body.description).toBe('A test site');
    expect(body.theme).toBe('dark');
  });
});

// ---- handleRemoveSite -------------------------------------------------------

describe('handleRemoveSite', () => {
  it('removes an existing site and returns 200', async () => {
    mockRegistry = [{ id: 'to-remove', name: 'Remove Me', path: tempDir }];
    const resp = handleRemoveSite('to-remove');
    expect(resp.status).toBe(200);
    const body = await jsonBody(resp) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(mockRegistry.some(s => s.id === 'to-remove')).toBe(false);
  });

  it('returns 404 for unknown site id', async () => {
    const resp = handleRemoveSite('ghost-site');
    expect(resp.status).toBe(404);
    const body = await jsonBody(resp) as Record<string, string>;
    expect(body.error).toContain('ghost-site');
  });

  it('does not modify registry when site not found', () => {
    mockRegistry = [{ id: 'keep-me', name: 'Keep', path: tempDir }];
    handleRemoveSite('nonexistent');
    expect(mockRegistry).toHaveLength(1);
    expect(mockRegistry[0].id).toBe('keep-me');
  });
});
