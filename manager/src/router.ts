/**
 * Router — dispatches incoming requests to API handlers or UI views.
 *
 * URL patterns use a simple prefix-match approach; no external router
 * dependency keeps the manager dependency-light.
 *
 * Auth is enforced here for all routes except GET /login and POST /login.
 */
import { isAuthenticated, redirectToLogin, unauthorizedJson, buildSessionCookie, clearSessionCookie, checkUrlToken, recordActivity, getLastActive } from './auth.js';

// API handlers
import { handleListSites, handleAddSite, handleRemoveSite } from './api/sites.js';
import { handleCreatePage, handleUpdatePage, handleDeletePage, handleGetPageParsed, handleUpdatePageParsed, handleReorderPages } from './api/pages.js';
import { handleGetProducts, handleSaveProducts, handleGenerateProducts, handleSyncProducts, handleGetProductsParsed, handleSaveProductsParsed } from './api/products.js';
import { handleBuild, handleGetDeployTargets, handleDeploy, handleDownloadDist, handleTest } from './api/build.js';
import { handleSaveEnv } from './api/env.js';
import { handleGetActiveTheme, handleSetActiveTheme, handleListTemplates, handleGetTemplateComponents } from './api/themes.js';
import { handleListMedia, handleServeMediaFile, handleUploadMedia, handleDeleteMedia } from './api/media.js';

// UI views
import { renderDashboard, renderAddSiteForm } from './ui/dashboard.js';
import { renderPages, renderEditorPane, renderNewPagePane, renderNewPageCompModals } from './ui/pages.js';
import { renderProducts } from './ui/products.js';
import { renderBuild } from './ui/build.js';
import { renderEnv } from './ui/env.js';
import { renderThemes, renderTemplateBrowser } from './ui/themes.js';
import { renderMedia } from './ui/media.js';
import { renderComponents, renderComponentDetail } from './ui/components.js';

const isHtmx = (req: Request) => req.headers.has('HX-Request');

export async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const { pathname, method } = { pathname: url.pathname, method: req.method };

  // ---- Health (unauthenticated — for container orchestrator) ----------------
  if (pathname === '/_health' && method === 'GET') {
    return new Response(
      JSON.stringify({
        status: 'ok',
        last_active: getLastActive().toISOString(),
        idle_seconds: Math.floor((Date.now() - getLastActive().getTime()) / 1000),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ---- Public routes -------------------------------------------------------
  if (pathname === '/login') {
    if (method === 'GET') return html(renderLoginPage(url.searchParams.get('next') ?? ''));
    if (method === 'POST') return handleLogin(req, url);
  }

  // ---- Auth gate -----------------------------------------------------------
  // 1. URL token (?token=xxx) — set cookie and redirect clean URL
  const urlTokenTarget = checkUrlToken(req);
  if (urlTokenTarget !== null) {
    const isSecure = new URL(req.url).protocol === 'https:';
    return new Response(null, {
      status: 302,
      headers: {
        Location: urlTokenTarget,
        'Set-Cookie': buildSessionCookie(isSecure),
      },
    });
  }

  // 2. Normal auth check
  if (!isAuthenticated(req)) {
    if (isHtmx(req) || pathname.startsWith('/api/')) return unauthorizedJson();
    return redirectToLogin(pathname !== '/' ? pathname : undefined);
  }

  // Record activity on every authenticated request
  recordActivity();

  // ---- Logout --------------------------------------------------------------
  if (pathname === '/logout' && method === 'GET') {
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/login',
        'Set-Cookie': clearSessionCookie(),
      },
    });
  }

  // ---- Sites API -----------------------------------------------------------
  if (pathname === '/api/sites' && method === 'GET') return handleListSites();
  if (pathname === '/api/sites' && method === 'POST') return handleAddSite(req);
  const siteApiMatch = pathname.match(/^\/api\/sites\/([^/]+)$/);
  if (siteApiMatch && method === 'DELETE') return handleRemoveSite(siteApiMatch[1]);

  // ---- Dashboard -----------------------------------------------------------
  if (pathname === '/' && method === 'GET') return html(renderDashboard(isHtmx(req)));
  if (pathname === '/sites/new' && method === 'GET') return html(renderAddSiteForm(isHtmx(req)));

  // ---- POST /api/sites (add from form) -------------------------------------
  if (pathname === '/api/sites' && method === 'POST') return handleAddSite(req);

  // ---- Per-site routes: /sites/:id/* ---------------------------------------
  const siteBase = pathname.match(/^\/sites\/([^/]+)(\/?.*)$/);
  if (!siteBase) return notFound();

  const siteId = siteBase[1];
  const subpath = siteBase[2] ?? '';

  // Pages
  if (subpath === '' || subpath === '/') return html(renderPages(siteId, undefined, isHtmx(req)));
  if (subpath === '/pages' && method === 'GET') return html(renderPages(siteId, undefined, isHtmx(req)));
  if (subpath === '/pages/new' && method === 'GET') return html(renderNewPagePane(siteId));
  if (subpath === '/pages' && method === 'POST') return handleCreatePage(siteId, req);
  if (subpath === '/pages/reorder' && method === 'PATCH') return handleReorderPages(siteId, req);

  // New-page comp modals fragment (template change in New Page pane)
  if (subpath === '/pages/new-comp-modals' && method === 'GET') {
    const tmpl = new URL(req.url).searchParams.get('template') ?? 'default';
    return html(renderNewPageCompModals(siteId, tmpl));
  }

  const pageMatch = subpath.match(/^\/pages\/(.+)$/);
  if (pageMatch) {
    const pagePath = pageMatch[1];
    if (pagePath.endsWith('/parsed')) {
      const base = pagePath.slice(0, -7);
      if (method === 'GET') return handleGetPageParsed(siteId, base);
      if (method === 'PUT') return handleUpdatePageParsed(siteId, base, req);
    }
    if (method === 'GET') {
      return isHtmx(req)
        ? html(renderEditorPane(siteId, pagePath))
        : html(renderPages(siteId, pagePath));
    }
    if (method === 'PUT') return handleUpdatePage(siteId, pagePath, req);
    if (method === 'DELETE') return handleDeletePage(siteId, pagePath);
  }

  // Products
  if (subpath === '/products' && method === 'GET') return html(renderProducts(siteId, isHtmx(req)));
  if (subpath === '/products' && method === 'PUT') return handleSaveProducts(siteId, req);
  if (subpath === '/products/raw' && method === 'GET') return handleGetProducts(siteId);
  if (subpath === '/products/parsed' && method === 'GET') return handleGetProductsParsed(siteId);
  if (subpath === '/products/parsed' && method === 'PUT') return handleSaveProductsParsed(siteId, req);
  if (subpath === '/products/generate' && method === 'POST') return handleGenerateProducts(siteId);
  if (subpath === '/products/sync' && method === 'POST') return handleSyncProducts(siteId);
  if (subpath === '/products/sync/force' && method === 'POST') return handleSyncProducts(siteId, true);

  // Components
  if (subpath === '/components' && method === 'GET') return html(renderComponents(siteId, isHtmx(req)));
  const compTagMatch = subpath.match(/^\/components\/(.+)$/);
  if (compTagMatch && method === 'GET') return html(renderComponentDetail(siteId, compTagMatch[1]));

  // Build
  if (subpath === '/build' && method === 'GET') return html(renderBuild(siteId, isHtmx(req)));
  if (subpath === '/build' && method === 'POST') return handleBuild(siteId);
  if (subpath === '/build/targets' && method === 'GET') return handleGetDeployTargets(siteId);
  if (subpath === '/build/download' && method === 'GET') return handleDownloadDist(siteId);
  if (subpath === '/build/test' && method === 'POST') return handleTest(siteId);
  if (subpath.startsWith('/deploy/') && method === 'POST') return handleDeploy(siteId, subpath.slice('/deploy/'.length));

  // Env
  if (subpath === '/env' && method === 'GET') return html(renderEnv(siteId, isHtmx(req)));
  if (subpath === '/env' && method === 'PUT') return handleSaveEnv(siteId, req);

  // Media
  if (subpath === '/media' && method === 'GET') return html(renderMedia(siteId, isHtmx(req)));
  if (subpath === '/media/list' && method === 'GET') return handleListMedia(siteId);
  if (subpath === '/media/upload' && method === 'POST') return handleUploadMedia(siteId, req);
  const mediaFileMatch = subpath.match(/^\/media\/file\/(.+)$/);
  if (mediaFileMatch && method === 'GET') return handleServeMediaFile(siteId, decodeURIComponent(mediaFileMatch[1]));
  const mediaDeleteMatch = subpath.match(/^\/media\/([^/].*)$/);
  if (mediaDeleteMatch && !mediaDeleteMatch[1].startsWith('list') && !mediaDeleteMatch[1].startsWith('upload') && !mediaDeleteMatch[1].startsWith('file') && method === 'DELETE') {
    return handleDeleteMedia(siteId, decodeURIComponent(mediaDeleteMatch[1]));
  }

  // Themes
  if (subpath === '/themes' && method === 'GET') return html(renderThemes(siteId, isHtmx(req)));
  if (subpath === '/themes/active' && method === 'GET') return handleGetActiveTheme(siteId);
  if (subpath === '/themes/active' && method === 'PUT') return handleSetActiveTheme(siteId, req);
  if (subpath === '/themes/components' && method === 'GET') {
    const tmpl = new URL(req.url).searchParams.get('template') ?? 'default';
    return handleGetTemplateComponents(siteId, tmpl);
  }

  const themeTemplates = subpath.match(/^\/themes\/([^/]+)\/templates$/);
  if (themeTemplates && method === 'GET') {
    return isHtmx(req)
      ? html(renderTemplateBrowser(siteId, themeTemplates[1]))
      : handleListTemplates(siteId, themeTemplates[1]);
  }

  return notFound();
}

// ---- Login ------------------------------------------------------------------

async function handleLogin(req: Request, url: URL): Promise<Response> {
  let token = '';
  let next = '/';
  try {
    const form = await req.formData();
    token = (form.get('token') ?? '').toString();
    next = (form.get('next') ?? '/').toString();
  } catch {
    const body = await req.text();
    const params = new URLSearchParams(body);
    token = params.get('token') ?? '';
    next = params.get('next') ?? '/';
  }

  // Sanitise next — only allow relative paths
  if (!next.startsWith('/') || next.startsWith('//')) next = '/';

  const { isAuthenticated: checkAuth } = await import('./auth.js');
  const fakeReq = new Request(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!checkAuth(fakeReq)) {
    return html(renderLoginPage(next, 'Invalid token. Please try again.'), 401);
  }

  const isSecure = url.protocol === 'https:';
  return new Response(null, {
    status: 302,
    headers: {
      Location: next,
      'Set-Cookie': buildSessionCookie(isSecure),
    },
  });
}

function renderLoginPage(next = '/', error?: string): string {
  const nextEsc = next.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sign in — Flint Manager</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-950 text-gray-100 min-h-screen flex flex-col items-center justify-center px-4">

  <!-- Background glow -->
  <div class="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
    <div class="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-900/30 rounded-full blur-3xl"></div>
  </div>

  <div class="relative w-full max-w-sm">
    <!-- Logo -->
    <div class="text-center mb-8 select-none">
      <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-900/50 mb-4">
        <span class="text-3xl leading-none">⚡</span>
      </div>
      <h1 class="text-2xl font-bold text-white tracking-tight">Flint Manager</h1>
      <p class="text-sm text-gray-500 mt-1">Sign in to manage your sites</p>
    </div>

    <!-- Card -->
    <div class="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-6">
      ${error ? `
      <div class="flex items-center gap-2 bg-red-950/60 border border-red-800/60 text-red-300 text-sm rounded-lg px-3 py-2.5 mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5h2v2H9v-2zm0-8h2v6H9V5z" clip-rule="evenodd"/>
        </svg>
        ${error}
      </div>` : ''}

      <form method="POST" action="/login" class="flex flex-col gap-4">
        <input type="hidden" name="next" value="${nextEsc}" />
        <div>
          <label for="token" class="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
            Access Token
          </label>
          <input
            id="token"
            type="password"
            name="token"
            autofocus
            required
            autocomplete="current-password"
            placeholder="Enter your MANAGER_API_KEY"
            class="w-full bg-gray-950 border border-gray-700 text-white rounded-lg px-3 py-2.5 text-sm
                   focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30
                   placeholder:text-gray-600 transition-colors" />
        </div>
        <button
          type="submit"
          class="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg
                 py-2.5 text-sm font-semibold tracking-wide transition-colors shadow-md shadow-indigo-900/40">
          Sign in →
        </button>
      </form>
    </div>

    <p class="text-center text-xs text-gray-700 mt-6">
      Flint Manager · Protected instance
    </p>
  </div>

</body>
</html>`;
}

// ---- helpers ----------------------------------------------------------------

function html(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function notFound(): Response {
  return new Response('Not Found', { status: 404 });
}
