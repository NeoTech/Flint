/**
 * UI: Themes — theme switcher + template browser.
 *
 * GET /sites/:id/themes
 */
import { shell, escHtml } from './shell.js';
import { getSite, resolveSitePath } from '../registry.js';
import { readdirSync, statSync, existsSync, readFileSync } from 'fs';
import { join, extname } from 'path';

export function renderThemes(siteId: string, htmx = false): string {
  const site = getSite(siteId);
  if (!site) {
    return shell({ title: 'Themes', body: `<p class="text-red-400">Site not found: ${escHtml(siteId)}</p>` });
  }

  const sitePath = resolveSitePath(site);
  const themesDir = join(sitePath, 'themes');
  const themes = existsSync(themesDir)
    ? readdirSync(themesDir).filter(e => statSync(join(themesDir, e)).isDirectory())
    : [];

  const activeTheme = readThemeFromEnv(sitePath) ?? 'default';

  const themeCards = themes.map(name => {
    const isActive = name === activeTheme;
    const templatesDir = join(themesDir, name, 'templates');
    const templateCount = existsSync(templatesDir)
      ? readdirSync(templatesDir).filter(f => extname(f) === '.html').length
      : 0;

    return `
<div class="bg-gray-800 rounded-xl border ${isActive ? 'border-indigo-500' : 'border-gray-700'} p-5 flex flex-col gap-3">
  <div class="flex items-start justify-between">
    <div>
      <h3 class="font-semibold text-white">${escHtml(name)}</h3>
      <p class="text-xs text-gray-500 mt-0.5">${templateCount} template${templateCount !== 1 ? 's' : ''}</p>
    </div>
    ${isActive ? '<span class="text-xs bg-indigo-700 text-indigo-200 px-2 py-0.5 rounded-full">Active</span>' : ''}
  </div>

  <button
    hx-get="/sites/${escHtml(siteId)}/themes/${escHtml(name)}/templates"
    hx-target="#template-browser"
    hx-swap="innerHTML"
    class="text-xs text-indigo-400 hover:text-indigo-300 text-left">
    Browse templates →
  </button>

  ${!isActive ? `
  <button
    onclick="setTheme('${escHtml(siteId)}', '${escHtml(name)}')"
    class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-1.5">
    Activate
  </button>` : '<p class="text-xs text-green-400">Currently active</p>'}
</div>`;
  }).join('');

  const body = `
<div class="max-w-5xl flex flex-col gap-8">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold text-white">Themes</h1>
    <p class="text-sm text-gray-400">Active: <span class="text-indigo-300 font-medium">${escHtml(activeTheme)}</span></p>
  </div>

  <div id="theme-status" class="text-sm h-6"></div>

  <!-- Theme cards -->
  <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
    ${themeCards || '<p class="text-gray-500 col-span-4">No themes found in themes/</p>'}
  </div>

  <!-- Template browser -->
  <div id="template-browser">
    <p class="text-sm text-gray-600">Click "Browse templates →" to preview a theme's templates.</p>
  </div>
</div>

<script>
async function setTheme(siteId, theme) {
  const resp = await fetch('/sites/' + siteId + '/themes/active', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme }),
  });
  const status = document.getElementById('theme-status');
  if (resp.ok) {
    status.textContent = 'Theme set to "' + theme + '". Reload to see changes.';
    status.className = 'text-sm text-green-400 h-6';
    setTimeout(() => location.reload(), 1500);
  } else {
    const err = await resp.json();
    status.textContent = 'Error: ' + (err.error ?? resp.status);
    status.className = 'text-sm text-red-400 h-6';
  }
}
</script>`;

  return htmx ? body : shell({ title: 'Themes — Flint Manager', siteId, activeSection: 'themes', body });
}

export function renderTemplateBrowser(siteId: string, themeName: string): string {
  const site = getSite(siteId);
  if (!site) return `<p class="text-red-400">Site not found</p>`;

  const templatesDir = join(resolveSitePath(site), 'themes', themeName, 'templates');
  if (!existsSync(templatesDir)) return `<p class="text-gray-500">No templates/ directory in theme "${escHtml(themeName)}".</p>`;

  const files = readdirSync(templatesDir).filter(f => extname(f) === '.html');
  if (!files.length) return `<p class="text-gray-500">No HTML templates found.</p>`;

  const tabs = files.map((f, i) => `
<button onclick="showTemplate(${i})"
  id="tab-${i}"
  class="text-xs px-3 py-1.5 rounded-t-lg ${i === 0 ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}">
  ${escHtml(f)}
</button>`).join('');

  const panes = files.map((f, i) => {
    const content = readFileSync(join(templatesDir, f), 'utf-8');
    return `<pre id="pane-${i}" class="text-xs font-mono text-gray-300 whitespace-pre-wrap ${i === 0 ? '' : 'hidden'}">${escHtml(content)}</pre>`;
  }).join('');

  return `
<div class="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
  <div class="flex gap-1 px-3 pt-3 border-b border-gray-700">
    ${tabs}
  </div>
  <div class="p-4 max-h-96 overflow-y-auto">
    ${panes}
  </div>
</div>

<script>
function showTemplate(idx) {
  document.querySelectorAll('[id^="pane-"]').forEach((el, i) => {
    el.classList.toggle('hidden', i !== idx);
  });
  document.querySelectorAll('[id^="tab-"]').forEach((el, i) => {
    el.className = el.className.replace(i === idx ? 'text-gray-400 hover:text-white' : 'bg-gray-800 text-white', '');
    el.classList.add(...(i === idx ? ['bg-gray-800', 'text-white'] : ['text-gray-400', 'hover:text-white']));
  });
}
</script>`;
}

// ---- helpers ----------------------------------------------------------------

function readThemeFromEnv(sitePath: string): string | null {
  const envPath = join(sitePath, '.env');
  if (!existsSync(envPath)) return null;
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const l of lines) {
    if (l.trim().startsWith('THEME=')) return l.trim().slice(6).trim() || null;
  }
  return null;
}
