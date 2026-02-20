/**
 * Tests for router.ts — auth gate, route dispatching, 404 handling.
 *
 * Strategy: mock only auth, registry, runner, and UI renderers.
 * The real API handlers run, so assertions check status codes and
 * content-type headers rather than stub return values.  This avoids
 * pre-caching the api/?.js modules as stubs (which would break the
 * dedicated api test files that expect to import the real modules).
 */
import { describe, it, expect, mock, afterAll } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// ---- setup temp site dir ----------------------------------------------------

let siteDir: string;

// Declared at module scope so mock factories can close over it
siteDir = mkdtempSync(join(tmpdir(), 'manager-router-test-'));
mkdirSync(join(siteDir, 'content'), { recursive: true });
mkdirSync(join(siteDir, 'themes', 'default', 'templates'), { recursive: true });

afterAll(() => {
  rmSync(siteDir, { recursive: true, force: true });
});

// ---- module mocks -----------------------------------------------------------
// IMPORTANT: do NOT mock './api/*.js' — those real modules must stay in their
// un-cached state so that the dedicated api test files can import the real
// implementations.  Pre-caching stubs here would contaminate those test files
// (Bun 1.x shares the module cache across test files in the same worker).

let isAuthedValue = true;
let urlTokenTarget: string | null = null;

mock.module('./auth.js', () => ({
  isAuthenticated: (_req: Request) => isAuthedValue,
  checkUrlToken: (_req: Request) => urlTokenTarget,
  redirectToLogin: (returnTo?: string) => new Response(null, {
    status: 302,
    headers: { Location: returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : '/login' },
  }),
  unauthorizedJson: () =>
    new Response('{"error":"unauthorized"}', { status: 401, headers: { 'Content-Type': 'application/json' } }),
  buildSessionCookie: () => 'X-Manager-Token=tok; HttpOnly; Path=/; Max-Age=604800',
  clearSessionCookie: () => 'X-Manager-Token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
  recordActivity: () => {},
  getLastActive: () => new Date('2026-01-01T12:00:00.000Z'),
}));

// Complete registry mock — includes all exports so that whichever test file
// runs first doesn't leave a partial export list in the shared cache.
mock.module('./registry.js', () => ({
  loadRegistry: () => [{ id: 'my-site', name: 'Test Site', path: siteDir }],
  saveRegistry: (_sites: unknown[]) => {},
  getSite: (id: string) =>
    id === 'my-site' ? { id: 'my-site', name: 'Test Site', path: siteDir } : null,
  upsertSite: () => {},
  removeSite: () => {},
  resolveSitePath: (site: { path: string }) => site.path,
}));

// Runner — returns a minimal SSE stream (needed by build + products/sync/generate)
mock.module('./runner.js', () => ({
  spawnAsStream: () =>
    new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode('data: done\n\n'));
        c.close();
      },
    }),
  spawnChained: () =>
    new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode('event: done\ndata: 0\n\n'));
        c.close();
      },
    }),
}));

// UI renderers — return identifiable snippet strings so we can assert dispatch
mock.module('./ui/dashboard.js', () => ({
  renderDashboard: () => '<div id="dashboard"></div>',
  renderAddSiteForm: () => '<div id="add-site-form"></div>',
}));
mock.module('./ui/pages.js', () => ({
  renderPages: () => '<div id="pages"></div>',
  renderEditorPane: () => '<div id="editor-pane"></div>',
  renderNewPagePane: () => '<div id="new-page-pane"></div>',
  renderNewPageCompModals: () => '',
}));
// Note: ui/products.js is NOT mocked — renderProducts only calls getSite (no
// filesystem access in the new fetch-on-load design), so the real function is
// safe.  Mocking it here would contaminate src/ui/products.test.ts via the
// shared Bun 1.x module cache.
mock.module('./ui/build.js', () => ({
  renderBuild: () => '<div id="build"></div>',
}));
mock.module('./ui/env.js', () => ({
  renderEnv: () => '<div id="env"></div>',
}));
mock.module('./ui/themes.js', () => ({
  renderThemes: () => '<div id="themes"></div>',
  renderTemplateBrowser: () => '<div id="template-browser"></div>',
}));
mock.module('./ui/components.js', () => ({
  renderComponents: () => '<div id="components"></div>',
  renderComponentDetail: () => '<div id="component-detail"></div>',
}));

// ---- import router AFTER all mocks are in place ----------------------------

const { handleRequest } = await import('./router.js');

// ---- helpers ---------------------------------------------------------------

function makeReq(
  method: string,
  path: string,
  opts: { htmx?: boolean; body?: string } = {},
): Request {
  const headers: Record<string, string> = {};
  if (opts.htmx) headers['HX-Request'] = 'true';
  if (opts.body) headers['Content-Type'] = 'application/json';
  return new Request(`http://localhost${path}`, {
    method,
    headers,
    body: opts.body ?? undefined,
  });
}

function isHtml(resp: Response): boolean {
  return (resp.headers.get('Content-Type') ?? '').includes('text/html');
}

function isJson(resp: Response): boolean {
  return (resp.headers.get('Content-Type') ?? '').includes('application/json');
}

// ---- Auth gate --------------------------------------------------------------

describe('auth gate', () => {
  it('GET / redirects to /login when not authenticated', async () => {
    isAuthedValue = false;
    const resp = await handleRequest(makeReq('GET', '/'));
    isAuthedValue = true;
    expect(resp.status).toBe(302);
    expect(resp.headers.get('Location')).toBe('/login');
  });

  it('HTMX request without auth returns 401', async () => {
    isAuthedValue = false;
    const resp = await handleRequest(makeReq('GET', '/', { htmx: true }));
    isAuthedValue = true;
    expect(resp.status).toBe(401);
  });

  it('/api/* without auth returns 401', async () => {
    isAuthedValue = false;
    const resp = await handleRequest(makeReq('GET', '/api/sites'));
    isAuthedValue = true;
    expect(resp.status).toBe(401);
  });

  it('authenticated GET / returns 200 HTML', async () => {
    const resp = await handleRequest(makeReq('GET', '/'));
    expect(resp.status).toBe(200);
    expect(isHtml(resp)).toBe(true);
  });
});

// ---- Public /login routes ---------------------------------------------------

describe('/login routes', () => {
  it('GET /login returns 200 HTML regardless of auth state', async () => {
    isAuthedValue = false;
    const resp = await handleRequest(makeReq('GET', '/login'));
    isAuthedValue = true;
    expect(resp.status).toBe(200);
    const text = await resp.text();
    expect(text).toContain('Flint Manager');
  });

  it('POST /login with valid form token returns redirect', async () => {
    const req = new Request('http://localhost/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: 'test-token' }).toString(),
    });
    const resp = await handleRequest(req);
    // Auth mocked to true, so login is accepted → 302 to /
    expect(resp.status).toBe(302);
    expect(resp.headers.get('Location')).toBe('/');
  });
});

// ---- Health endpoint --------------------------------------------------------

describe('/_health endpoint', () => {
  it('returns 200 JSON regardless of auth state', async () => {
    isAuthedValue = false;
    const resp = await handleRequest(makeReq('GET', '/_health'));
    isAuthedValue = true;
    expect(resp.status).toBe(200);
    expect(isJson(resp)).toBe(true);
  });

  it('response contains status ok', async () => {
    const resp = await handleRequest(makeReq('GET', '/_health'));
    const body = await resp.json() as Record<string, unknown>;
    expect(body.status).toBe('ok');
  });

  it('response contains last_active ISO string', async () => {
    const resp = await handleRequest(makeReq('GET', '/_health'));
    const body = await resp.json() as Record<string, unknown>;
    expect(typeof body.last_active).toBe('string');
    expect(body.last_active).toBe('2026-01-01T12:00:00.000Z');
  });

  it('response contains idle_seconds number', async () => {
    const resp = await handleRequest(makeReq('GET', '/_health'));
    const body = await resp.json() as Record<string, unknown>;
    expect(typeof body.idle_seconds).toBe('number');
  });
});

// ---- Logout -----------------------------------------------------------------

describe('logout route', () => {
  it('GET /logout redirects to /login', async () => {
    const resp = await handleRequest(makeReq('GET', '/logout'));
    expect(resp.status).toBe(302);
    expect(resp.headers.get('Location')).toBe('/login');
  });

  it('GET /logout clears the session cookie (Max-Age=0)', async () => {
    const resp = await handleRequest(makeReq('GET', '/logout'));
    expect(resp.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });
});

// ---- URL token auth ---------------------------------------------------------

describe('URL token auth', () => {
  it('valid ?token in URL redirects to clean path with Set-Cookie', async () => {
    urlTokenTarget = '/sites/my-site';
    const resp = await handleRequest(makeReq('GET', '/?token=tok'));
    urlTokenTarget = null;
    expect(resp.status).toBe(302);
    expect(resp.headers.get('Location')).toBe('/sites/my-site');
    expect(resp.headers.get('Set-Cookie')).toContain('X-Manager-Token=tok');
  });

  it('URL token works even when cookie auth fails', async () => {
    isAuthedValue = false;
    urlTokenTarget = '/';
    const resp = await handleRequest(makeReq('GET', '/?token=tok'));
    isAuthedValue = true;
    urlTokenTarget = null;
    expect(resp.status).toBe(302);
    expect(resp.headers.get('Set-Cookie')).not.toBeNull();
  });
});

// ---- Login ?next= redirect --------------------------------------------------

describe('login ?next= redirect', () => {
  it('unauthenticated request to /sites/foo redirects with next param', async () => {
    isAuthedValue = false;
    const resp = await handleRequest(makeReq('GET', '/sites/my-site'));
    isAuthedValue = true;
    expect(resp.status).toBe(302);
    const loc = resp.headers.get('Location') ?? '';
    expect(loc).toContain('/login');
    expect(loc).toContain('next=');
  });
});

// ---- Sites API --------------------------------------------------------------

describe('sites API routes', () => {
  it('GET /api/sites → 200 JSON array', async () => {
    const resp = await handleRequest(makeReq('GET', '/api/sites'));
    expect(resp.status).toBe(200);
    expect(isJson(resp)).toBe(true);
    const body = await resp.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
  });

  it('POST /api/sites with no body → 400 JSON', async () => {
    const resp = await handleRequest(makeReq('POST', '/api/sites'));
    expect(resp.status).toBe(400);
    expect(isJson(resp)).toBe(true);
  });

  it('DELETE /api/sites/my-site → removes site from registry → 200 JSON', async () => {
    const resp = await handleRequest(makeReq('DELETE', '/api/sites/my-site'));
    expect(resp.status).toBe(200);
  });

  it('DELETE /api/sites/unknown → 404 JSON', async () => {
    const resp = await handleRequest(makeReq('DELETE', '/api/sites/unknown'));
    expect(resp.status).toBe(404);
  });
});

// ---- Dashboard UI -----------------------------------------------------------

describe('dashboard routes', () => {
  it('GET / returns 200 HTML with dashboard content', async () => {
    const resp = await handleRequest(makeReq('GET', '/'));
    expect(resp.status).toBe(200);
    expect(isHtml(resp)).toBe(true);
    expect(await resp.text()).toContain('dashboard');
  });

  it('GET /sites/new returns 200 HTML with add-site-form', async () => {
    const resp = await handleRequest(makeReq('GET', '/sites/new'));
    expect(resp.status).toBe(200);
    expect(await resp.text()).toContain('add-site-form');
  });
});

// ---- Pages routes -----------------------------------------------------------

describe('pages routes', () => {
  it('GET /sites/my-site/pages → 200 HTML', async () => {
    const resp = await handleRequest(makeReq('GET', '/sites/my-site/pages'));
    expect(resp.status).toBe(200);
    expect(isHtml(resp)).toBe(true);
    expect(await resp.text()).toContain('pages');
  });

  it('POST /sites/my-site/pages with no body → 400 JSON', async () => {
    const resp = await handleRequest(makeReq('POST', '/sites/my-site/pages'));
    expect([400, 500]).toContain(resp.status);
  });

  it('POST /sites/my-site/pages with valid body → 201 JSON', async () => {
    const resp = await handleRequest(
      makeReq('POST', '/sites/my-site/pages', {
        body: JSON.stringify({ path: 'test-router-page', title: 'Test', content: '# Test' }),
      }),
    );
    expect(resp.status).toBe(201);
    expect(isJson(resp)).toBe(true);
  });

  it('PATCH /sites/my-site/pages/reorder with no body → 400 JSON', async () => {
    const resp = await handleRequest(makeReq('PATCH', '/sites/my-site/pages/reorder'));
    expect(resp.status).toBe(400);
  });

  it('GET /sites/my-site/pages/new → 200 HTML with new-page-pane', async () => {
    const resp = await handleRequest(makeReq('GET', '/sites/my-site/pages/new'));
    expect(resp.status).toBe(200);
    expect(await resp.text()).toContain('new-page-pane');
  });

  it('GET /sites/my-site/pages/blog/post (HTMX) → 200 HTML with editor-pane', async () => {
    const resp = await handleRequest(makeReq('GET', '/sites/my-site/pages/blog/post', { htmx: true }));
    expect(resp.status).toBe(200);
    expect(await resp.text()).toContain('editor-pane');
  });

  it('PUT /sites/my-site/pages/blog/post with no body → 400 JSON', async () => {
    const resp = await handleRequest(makeReq('PUT', '/sites/my-site/pages/blog/post'));
    expect(resp.status).toBe(400);
  });

  it('DELETE /sites/my-site/pages/nonexistent → 404 JSON', async () => {
    const resp = await handleRequest(makeReq('DELETE', '/sites/my-site/pages/nonexistent'));
    expect(resp.status).toBe(404);
    expect(isJson(resp)).toBe(true);
  });

  it('GET /sites/my-site/pages/blog/post/parsed (nonexistent) → 404 JSON', async () => {
    const resp = await handleRequest(makeReq('GET', '/sites/my-site/pages/blog/post/parsed'));
    expect(resp.status).toBe(404);
  });
});

// ---- Products routes --------------------------------------------------------

describe('products routes', () => {
  it('GET /sites/my-site/products → 200 HTML', async () => {
    const resp = await handleRequest(makeReq('GET', '/sites/my-site/products'));
    expect(resp.status).toBe(200);
    expect(isHtml(resp)).toBe(true);
    expect(await resp.text()).toContain('products');
  });

  it('GET /sites/my-site/products/parsed → 200 JSON {products: []}', async () => {
    const resp = await handleRequest(makeReq('GET', '/sites/my-site/products/parsed'));
    expect(resp.status).toBe(200);
    expect(isJson(resp)).toBe(true);
    const body = await resp.json() as Record<string, unknown>;
    expect(Array.isArray(body.products)).toBe(true);
  });

  it('PUT /sites/my-site/products with no body → 400 JSON', async () => {
    const resp = await handleRequest(makeReq('PUT', '/sites/my-site/products'));
    expect(resp.status).toBe(400);
  });

  it('PUT /sites/my-site/products/parsed with no body → 400 JSON', async () => {
    const resp = await handleRequest(makeReq('PUT', '/sites/my-site/products/parsed'));
    expect(resp.status).toBe(400);
  });

  it('POST /sites/my-site/products/generate → 200 SSE stream', async () => {
    const resp = await handleRequest(makeReq('POST', '/sites/my-site/products/generate'));
    expect(resp.status).toBe(200);
    expect(resp.headers.get('Content-Type')).toContain('text/event-stream');
  });

  it('POST /sites/my-site/products/sync → 200 SSE stream', async () => {
    const resp = await handleRequest(makeReq('POST', '/sites/my-site/products/sync'));
    expect(resp.status).toBe(200);
    expect(resp.headers.get('Content-Type')).toContain('text/event-stream');
  });

  it('POST /sites/my-site/products/sync/force → 200 SSE stream', async () => {
    const resp = await handleRequest(makeReq('POST', '/sites/my-site/products/sync/force'));
    expect(resp.status).toBe(200);
    expect(resp.headers.get('Content-Type')).toContain('text/event-stream');
  });
});

// ---- Build / Env / Themes routes -------------------------------------------

describe('build, env, themes routes', () => {
  it('GET /sites/my-site/build → 200 HTML', async () => {
    const resp = await handleRequest(makeReq('GET', '/sites/my-site/build'));
    expect(resp.status).toBe(200);
    expect(isHtml(resp)).toBe(true);
    expect(await resp.text()).toContain('build');
  });

  it('POST /sites/my-site/build → 200 SSE stream', async () => {
    const resp = await handleRequest(makeReq('POST', '/sites/my-site/build'));
    expect(resp.status).toBe(200);
    expect(resp.headers.get('Content-Type')).toContain('text/event-stream');
  });

  it('GET /sites/my-site/build/targets → 200 JSON array', async () => {
    const resp = await handleRequest(makeReq('GET', '/sites/my-site/build/targets'));
    expect(resp.status).toBe(200);
    const body = await resp.json() as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });
  it('GET /sites/my-site/build/download with no dist → 404', async () => {
    const resp = await handleRequest(makeReq('GET', '/sites/my-site/build/download'));
    expect(resp.status).toBe(404);
  });
  it('POST /sites/my-site/build/test \u2192 200 SSE stream', async () => {
    const resp = await handleRequest(makeReq('POST', '/sites/my-site/build/test'));
    expect(resp.status).toBe(200);
    expect(resp.headers.get('Content-Type')).toContain('text/event-stream');
  });  it('GET /sites/my-site/build/targets includes known platforms', async () => {
    const resp = await handleRequest(makeReq('GET', '/sites/my-site/build/targets'));
    const body = await resp.json() as Array<{ id: string; available: boolean; missing: string[] }>;
    const ids = body.map(t => t.id);
    expect(ids).toContain('cloudflare');
    expect(ids).toContain('vercel');
    expect(ids).toContain('netlify');
    expect(ids).toContain('ghpages');
  });

  it('POST /sites/my-site/deploy/cloudflare → 200 SSE stream', async () => {
    const resp = await handleRequest(makeReq('POST', '/sites/my-site/deploy/cloudflare'));
    expect(resp.status).toBe(200);
    expect(resp.headers.get('Content-Type')).toContain('text/event-stream');
  });

  it('POST /sites/my-site/deploy/unknown → 400', async () => {
    const resp = await handleRequest(makeReq('POST', '/sites/my-site/deploy/unknown-platform'));
    expect(resp.status).toBe(400);
  });

  it('GET /sites/my-site/env → 200 HTML', async () => {
    const resp = await handleRequest(makeReq('GET', '/sites/my-site/env'));
    expect(resp.status).toBe(200);
    expect(isHtml(resp)).toBe(true);
    expect(await resp.text()).toContain('env');
  });

  it('PUT /sites/my-site/env with no body → 400 JSON', async () => {
    const resp = await handleRequest(makeReq('PUT', '/sites/my-site/env'));
    expect(resp.status).toBe(400);
  });

  it('PUT /sites/my-site/env with empty array body → 200 JSON', async () => {
    const resp = await handleRequest(
      makeReq('PUT', '/sites/my-site/env', { body: JSON.stringify([]) }),
    );
    expect(resp.status).toBe(200);
  });

  it('GET /sites/my-site/themes → 200 HTML', async () => {
    const resp = await handleRequest(makeReq('GET', '/sites/my-site/themes'));
    expect(resp.status).toBe(200);
    expect(isHtml(resp)).toBe(true);
    expect(await resp.text()).toContain('themes');
  });

  it('GET /sites/my-site/themes/active → 200 JSON with theme field', async () => {
    const resp = await handleRequest(makeReq('GET', '/sites/my-site/themes/active'));
    expect(resp.status).toBe(200);
    expect(isJson(resp)).toBe(true);
    const body = await resp.json() as Record<string, string>;
    expect(typeof body.theme).toBe('string');
  });

  it('PUT /sites/my-site/themes/active with no body → 400 JSON', async () => {
    const resp = await handleRequest(makeReq('PUT', '/sites/my-site/themes/active'));
    expect(resp.status).toBe(400);
  });
});

// ---- Components routes ------------------------------------------------------

describe('components routes', () => {
  it('GET /sites/my-site/components → 200 HTML', async () => {
    const resp = await handleRequest(makeReq('GET', '/sites/my-site/components'));
    expect(resp.status).toBe(200);
    expect(isHtml(resp)).toBe(true);
    expect(await resp.text()).toContain('components');
  });

  it('GET /sites/my-site/components/hero → 200 HTML', async () => {
    const resp = await handleRequest(makeReq('GET', '/sites/my-site/components/hero'));
    expect(resp.status).toBe(200);
    expect(isHtml(resp)).toBe(true);
  });
});

// ---- 404 fallback -----------------------------------------------------------

describe('404 fallback', () => {
  it('completely unknown path returns 404', async () => {
    const resp = await handleRequest(makeReq('GET', '/this/does/not/exist'));
    expect(resp.status).toBe(404);
  });

  it('unknown method on known path returns 404', async () => {
    // PATCH on /api/sites has no handler
    const resp = await handleRequest(makeReq('PATCH', '/api/sites'));
    expect(resp.status).toBe(404);
  });
});

