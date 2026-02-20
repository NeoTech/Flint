/**
 * Tests for api/themes.ts — list themes, get/set active theme, list templates.
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import {
  mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, existsSync,
} from 'fs';
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

const {
  handleListThemes,
  handleGetActiveTheme,
  handleSetActiveTheme,
  handleListTemplates,
} = await import('./themes.js');

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

function makeThemeDir(base: string, name: string): string {
  const d = join(base, 'themes', name);
  mkdirSync(d, { recursive: true });
  return d;
}

// ---- setup ------------------------------------------------------------------

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'manager-themes-test-'));
  mockSitePath = tempDir;
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

// ---- handleListThemes -------------------------------------------------------

describe('handleListThemes', () => {
  it('returns empty array when themes dir absent', async () => {
    const resp = handleListThemes('test');
    expect(resp.status).toBe(200);
    expect(await jsonBody(resp)).toEqual([]);
  });

  it('returns only directories, not files', async () => {
    makeThemeDir(tempDir, 'default');
    writeFileSync(join(tempDir, 'themes', 'README.md'), '# Themes');
    const resp = handleListThemes('test');
    const body = await jsonBody(resp) as string[];
    expect(body).toContain('default');
    expect(body).not.toContain('README.md');
  });

  it('returns multiple theme directories', async () => {
    makeThemeDir(tempDir, 'default');
    makeThemeDir(tempDir, 'dark');
    const resp = handleListThemes('test');
    const body = await jsonBody(resp) as string[];
    expect(body.sort()).toEqual(['dark', 'default']);
  });

  it('returns 404 for unknown site', () => {
    expect(handleListThemes('ghost').status).toBe(404);
  });
});

// ---- handleGetActiveTheme ---------------------------------------------------

describe('handleGetActiveTheme', () => {
  it('returns "default" when no .env exists', async () => {
    const resp = handleGetActiveTheme('test');
    expect(resp.status).toBe(200);
    expect(await jsonBody(resp)).toEqual({ theme: 'default' });
  });

  it('returns THEME value from .env', async () => {
    writeFileSync(join(tempDir, '.env'), 'THEME=dark\n');
    const resp = handleGetActiveTheme('test');
    expect(await jsonBody(resp)).toEqual({ theme: 'dark' });
  });

  it('returns "default" when .env exists but has no THEME line', async () => {
    writeFileSync(join(tempDir, '.env'), 'FOO=bar\n');
    const resp = handleGetActiveTheme('test');
    expect(await jsonBody(resp)).toEqual({ theme: 'default' });
  });

  it('handles THEME= with empty value as default', async () => {
    writeFileSync(join(tempDir, '.env'), 'THEME=\n');
    const resp = handleGetActiveTheme('test');
    expect(await jsonBody(resp)).toEqual({ theme: 'default' });
  });

  it('returns 404 for unknown site', () => {
    expect(handleGetActiveTheme('ghost').status).toBe(404);
  });
});

// ---- handleSetActiveTheme ---------------------------------------------------

describe('handleSetActiveTheme', () => {
  it('writes THEME to existing .env, preserving other lines', async () => {
    writeFileSync(join(tempDir, '.env'), 'FOO=bar\n');
    makeThemeDir(tempDir, 'dark');
    const resp = await handleSetActiveTheme('test', makePutRequest({ theme: 'dark' }));
    expect(resp.status).toBe(200);
    const saved = readFileSync(join(tempDir, '.env'), 'utf-8');
    expect(saved).toContain('THEME=dark');
    expect(saved).toContain('FOO=bar');
  });

  it('updates an existing THEME line in place', async () => {
    writeFileSync(join(tempDir, '.env'), 'THEME=default\n');
    makeThemeDir(tempDir, 'dark');
    await handleSetActiveTheme('test', makePutRequest({ theme: 'dark' }));
    const saved = readFileSync(join(tempDir, '.env'), 'utf-8');
    // Should only appear once
    expect(saved.match(/THEME=/g) ?? []).toHaveLength(1);
    expect(saved).toContain('THEME=dark');
    expect(saved).not.toContain('THEME=default');
  });

  it('creates .env if none exists', async () => {
    makeThemeDir(tempDir, 'dark');
    expect(existsSync(join(tempDir, '.env'))).toBe(false);
    const resp = await handleSetActiveTheme('test', makePutRequest({ theme: 'dark' }));
    expect(resp.status).toBe(200);
    expect(existsSync(join(tempDir, '.env'))).toBe(true);
    expect(readFileSync(join(tempDir, '.env'), 'utf-8')).toContain('THEME=dark');
  });

  it('returns 404 if theme directory does not exist', async () => {
    const resp = await handleSetActiveTheme('test', makePutRequest({ theme: 'missing-theme' }));
    expect(resp.status).toBe(404);
    const body = await jsonBody(resp) as Record<string, string>;
    expect(body.error).toContain('missing-theme');
  });

  it('returns 400 if theme field missing from body', async () => {
    makeThemeDir(tempDir, 'dark');
    const resp = await handleSetActiveTheme('test', makePutRequest({}));
    expect(resp.status).toBe(400);
  });

  it('returns 400 on invalid JSON', async () => {
    const req = new Request('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad json',
    });
    const resp = await handleSetActiveTheme('test', req);
    expect(resp.status).toBe(400);
  });

  it('returns 404 for unknown site', async () => {
    const resp = await handleSetActiveTheme('ghost', makePutRequest({ theme: 'default' }));
    expect(resp.status).toBe(404);
  });
});

// ---- handleListTemplates ----------------------------------------------------

describe('handleListTemplates', () => {
  it('returns empty array when templates dir absent', async () => {
    makeThemeDir(tempDir, 'default');
    // no templates subdir
    const resp = handleListTemplates('test', 'default');
    expect(resp.status).toBe(200);
    expect(await jsonBody(resp)).toEqual([]);
  });

  it('returns only .html files with name and content', async () => {
    const tplDir = join(tempDir, 'themes', 'default', 'templates');
    mkdirSync(tplDir, { recursive: true });
    writeFileSync(join(tplDir, 'home.html'), '<h1>Home</h1>');
    writeFileSync(join(tplDir, 'blog.html'), '<h1>Blog</h1>');
    writeFileSync(join(tplDir, 'notes.txt'), 'should be excluded');
    const resp = handleListTemplates('test', 'default');
    const body = await jsonBody(resp) as Array<{ name: string; content: string }>;
    expect(body).toHaveLength(2);
    expect(body.map(t => t.name)).toContain('home.html');
    expect(body.map(t => t.name)).toContain('blog.html');
    expect(body.map(t => t.name)).not.toContain('notes.txt');
  });

  it('reads correct content of each template', async () => {
    const tplDir = join(tempDir, 'themes', 'default', 'templates');
    mkdirSync(tplDir, { recursive: true });
    const content = '<!DOCTYPE html><html><body>{{content}}</body></html>';
    writeFileSync(join(tplDir, 'default.html'), content);
    const resp = handleListTemplates('test', 'default');
    const body = await jsonBody(resp) as Array<{ name: string; content: string }>;
    expect(body[0].content).toBe(content);
  });

  it('returns 404 for unknown site', () => {
    expect(handleListTemplates('ghost', 'default').status).toBe(404);
  });
});
