/**
 * Tests for api/pages.ts — CRUD + reorder handlers.
 *
 * Uses Bun's module mocking to avoid needing a real registry file.
 * Each test group creates a fresh temp dir with a minimal content/ folder.
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// ---- mock registry before importing the handlers ----
let mockSitePath = '';

mock.module('../registry.js', () => ({
  getSite: (id: string) => id === 'test' ? { id: 'test', name: 'Test', path: mockSitePath } : null,
  resolveSitePath: (site: { path: string }) => site.path,
  // full surface — prevents partial-mock errors when files share the module cache
  loadRegistry: () => [],
  saveRegistry: () => {},
  upsertSite: () => {},
  removeSite: () => {},
}));

// Import AFTER mock is registered
const {
  handleCreatePage,
  handleGetPage,
  handleGetPageParsed,
  handleUpdatePage,
  handleUpdatePageParsed,
  handleDeletePage,
  handleReorderPages,
} = await import('./pages.js');

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

// ---- test setup -------------------------------------------------------------

let tempDir: string;
let contentDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'manager-pages-test-'));
  contentDir = join(tempDir, 'content');
  mkdirSync(contentDir, { recursive: true });
  // Point mock to fresh directory
  mockSitePath = tempDir;
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

// ---- handleCreatePage -------------------------------------------------------

describe('handleCreatePage', () => {
  it('creates a new markdown file at the given path', async () => {
    const req = makeRequest({ path: 'about.md', content: '---\nTitle: About\n---\n\nHello' });
    const resp = await handleCreatePage('test', req);

    expect(resp.status).toBe(201);
    const body = await jsonBody(resp) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.path).toBe('about.md');
    expect(existsSync(join(contentDir, 'about.md'))).toBe(true);
  });

  it('creates nested directories automatically', async () => {
    const req = makeRequest({ path: 'blog/my-post.md', content: '---\nTitle: Post\n---\n\nContent' });
    const resp = await handleCreatePage('test', req);

    expect(resp.status).toBe(201);
    expect(existsSync(join(contentDir, 'blog', 'my-post.md'))).toBe(true);
  });

  it('returns 409 if the file already exists', async () => {
    writeFileSync(join(contentDir, 'index.md'), '---\nTitle: Home\n---\n');
    const req = makeRequest({ path: 'index.md', content: '# duplicate' });
    const resp = await handleCreatePage('test', req);

    expect(resp.status).toBe(409);
    const body = await jsonBody(resp) as Record<string, string>;
    expect(body.error).toContain('already exists');
  });

  it('returns 400 if path is missing', async () => {
    const req = makeRequest({ content: '# no path' });
    const resp = await handleCreatePage('test', req);
    expect(resp.status).toBe(400);
  });

  it('returns 400 if content is missing', async () => {
    const req = makeRequest({ path: 'x.md' });
    const resp = await handleCreatePage('test', req);
    expect(resp.status).toBe(400);
  });

  it('returns 404 for unknown site id', async () => {
    const req = makeRequest({ path: 'x.md', content: '# x' });
    const resp = await handleCreatePage('unknown-site', req);
    expect(resp.status).toBe(404);
  });

  it('strips path traversal segments and writes to contentDir', async () => {
    const req = makeRequest({ path: '../../evil.md', content: 'bad' });
    const resp = await handleCreatePage('test', req);

    // Must succeed but with the sanitised path (../ stripped)
    expect(resp.status).toBe(201);
    const body = await jsonBody(resp) as Record<string, unknown>;
    expect(body.path).toBe('evil.md');
    // File must be inside contentDir, NOT outside it
    expect(existsSync(join(contentDir, 'evil.md'))).toBe(true);
    expect(existsSync(join(tempDir, 'evil.md'))).toBe(false);
  });
});

// ---- handleGetPage ----------------------------------------------------------

describe('handleGetPage', () => {
  it('returns raw markdown content', async () => {
    const raw = '---\nTitle: Hello\n---\n\nBody text';
    writeFileSync(join(contentDir, 'hello.md'), raw);
    const resp = handleGetPage('test', 'hello.md');

    expect(resp.status).toBe(200);
    const body = await jsonBody(resp) as Record<string, unknown>;
    expect(body.content).toBe(raw);
    expect(body.path).toBe('hello.md');
  });

  it('returns 404 for missing file', () => {
    const resp = handleGetPage('test', 'nonexistent.md');
    expect(resp.status).toBe(404);
  });
});

// ---- handleGetPageParsed ----------------------------------------------------

describe('handleGetPageParsed', () => {
  it('returns parsed frontmatter and body', async () => {
    writeFileSync(join(contentDir, 'page.md'), '---\nTitle: My Page\nOrder: 3\n---\n\nHello world');
    const resp = handleGetPageParsed('test', 'page.md');

    expect(resp.status).toBe(200);
    const body = await jsonBody(resp) as Record<string, unknown>;
    expect((body.frontmatter as Record<string, unknown>)['Title']).toBe('My Page');
    expect((body.frontmatter as Record<string, unknown>)['Order']).toBe(3);
    expect((body.body as string).trim()).toBe('Hello world');
  });

  it('returns 404 for missing file', () => {
    const resp = handleGetPageParsed('test', 'missing.md');
    expect(resp.status).toBe(404);
  });
});

// ---- handleUpdatePage -------------------------------------------------------

describe('handleUpdatePage', () => {
  it('overwrites raw file content', async () => {
    writeFileSync(join(contentDir, 'edit.md'), '---\nTitle: Old\n---\n\nOld body');
    const req = makeRequest({ content: '---\nTitle: New\n---\n\nNew body' }, 'PUT');
    const resp = await handleUpdatePage('test', 'edit.md', req);

    expect(resp.status).toBe(200);
    const saved = readFileSync(join(contentDir, 'edit.md'), 'utf-8');
    expect(saved).toContain('New body');
    expect(saved).toContain('Title: New');
  });

  it('returns 400 if content is missing from body', async () => {
    writeFileSync(join(contentDir, 'edit.md'), '# existing');
    const req = makeRequest({ nope: true }, 'PUT');
    const resp = await handleUpdatePage('test', 'edit.md', req);
    expect(resp.status).toBe(400);
  });
});

// ---- handleUpdatePageParsed -------------------------------------------------

describe('handleUpdatePageParsed', () => {
  it('rebuilds the file from frontmatter + body using gray-matter', async () => {
    writeFileSync(join(contentDir, 'post.md'), '---\nTitle: Draft\n---\n\nDraft content');
    const req = makeRequest({
      frontmatter: { Title: 'Final', Order: 5, Labels: ['news', 'update'] },
      body: 'Finished content.',
    }, 'PUT');
    const resp = await handleUpdatePageParsed('test', 'post.md', req);

    expect(resp.status).toBe(200);
    const content = readFileSync(join(contentDir, 'post.md'), 'utf-8');
    expect(content).toContain('Title: Final');
    expect(content).toContain('Order: 5');
    expect(content).toContain('Finished content.');
  });

  it('accepts an empty body string', async () => {
    writeFileSync(join(contentDir, 'empty.md'), '---\nTitle: Empty\n---\n');
    const req = makeRequest({ frontmatter: { Title: 'Empty' }, body: '' }, 'PUT');
    const resp = await handleUpdatePageParsed('test', 'empty.md', req);
    expect(resp.status).toBe(200);
  });
});

// ---- handleDeletePage -------------------------------------------------------

describe('handleDeletePage', () => {
  it('deletes an existing file', () => {
    writeFileSync(join(contentDir, 'gone.md'), '# bye');
    const resp = handleDeletePage('test', 'gone.md');

    expect(resp.status).toBe(200);
    expect(existsSync(join(contentDir, 'gone.md'))).toBe(false);
  });

  it('returns 404 for non-existent file', () => {
    const resp = handleDeletePage('test', 'no-such-file.md');
    expect(resp.status).toBe(404);
  });

  it('returns 404 for unknown site', () => {
    const resp = handleDeletePage('other', 'index.md');
    expect(resp.status).toBe(404);
  });
});

// ---- handleReorderPages -----------------------------------------------------

describe('handleReorderPages', () => {
  it('writes Order field to all listed pages', async () => {
    writeFileSync(join(contentDir, 'a.md'), '---\nTitle: A\nOrder: 1\n---\n\nA');
    writeFileSync(join(contentDir, 'b.md'), '---\nTitle: B\nOrder: 2\n---\n\nB');

    const req = makeRequest({
      items: [
        { path: 'b.md', order: 1 },
        { path: 'a.md', order: 2 },
      ],
    }, 'PATCH');
    const resp = await handleReorderPages('test', req);

    expect(resp.status).toBe(200);

    const aContent = readFileSync(join(contentDir, 'a.md'), 'utf-8');
    const bContent = readFileSync(join(contentDir, 'b.md'), 'utf-8');
    // Order should be swapped
    expect(aContent).toContain('Order: 2');
    expect(bContent).toContain('Order: 1');
  });

  it('silently skips missing paths', async () => {
    writeFileSync(join(contentDir, 'real.md'), '---\nTitle: Real\n---\n\nReal');
    const req = makeRequest({
      items: [
        { path: 'real.md', order: 5 },
        { path: 'ghost.md', order: 99 },
      ],
    }, 'PATCH');
    const resp = await handleReorderPages('test', req);
    expect(resp.status).toBe(200);
    expect(readFileSync(join(contentDir, 'real.md'), 'utf-8')).toContain('Order: 5');
  });

  it('returns 400 if items is not an array', async () => {
    const req = makeRequest({ items: 'bad' }, 'PATCH');
    const resp = await handleReorderPages('test', req);
    expect(resp.status).toBe(400);
  });

  it('returns 404 for unknown site', async () => {
    const req = makeRequest({ items: [] }, 'PATCH');
    const resp = await handleReorderPages('unknown', req);
    expect(resp.status).toBe(404);
  });
});
