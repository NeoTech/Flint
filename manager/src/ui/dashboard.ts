/**
 * UI: Dashboard — landing page showing all registered sites.
 *
 * Full page:   GET /
 * Site detail: GET /sites/:id
 */
import { loadRegistry, getSite, resolveSitePath } from '../registry.js';
import { shell, escHtml } from './shell.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export function renderDashboard(htmx = false): string {
  const sites = loadRegistry();

  const cards = sites.length
    ? sites.map(site => {
        const active = readActiveTheme(site.id) ?? 'default';
        const hasDist = existsSync(join(resolveSitePath(site), 'dist'));
        return `
<div class="bg-gray-800 rounded-xl p-6 flex flex-col gap-3 border border-gray-700 hover:border-indigo-500 transition-colors">
  <div class="flex items-start justify-between">
    <div>
      <h2 class="text-lg font-semibold text-white">${escHtml(site.name)}</h2>
      ${site.description ? `<p class="text-sm text-gray-400">${escHtml(site.description)}</p>` : ''}
    </div>
    <span class="text-xs bg-indigo-900 text-indigo-300 px-2 py-0.5 rounded-full">${escHtml(active)}</span>
  </div>
  <p class="text-xs text-gray-500 font-mono truncate">${escHtml(site.path)}</p>
  <div class="flex items-center gap-2 text-xs">
    <span class="${hasDist ? 'text-green-400' : 'text-yellow-400'}">
      ${hasDist ? '● Built' : '○ No dist/'}
    </span>
  </div>
  <div class="flex gap-2 mt-auto pt-2">
    <a href="/sites/${escHtml(site.id)}/pages"
       hx-get="/sites/${escHtml(site.id)}/pages"
       hx-target="#content" hx-push-url="true"
       class="flex-1 text-center text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-1.5">
      Open
    </a>
    <button
      hx-post="/sites/${escHtml(site.id)}/build"
      hx-target="#build-log-${escHtml(site.id)}"
      hx-swap="innerHTML"
      class="text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-3 py-1.5">
      Build
    </button>
    <button
      hx-delete="/api/sites/${escHtml(site.id)}"
      hx-confirm="Remove '${escHtml(site.name)}' from the manager? (The site files will not be deleted.)"
      hx-on::after-request="if(event.detail.successful){htmx.ajax('GET','/',{target:'#content',swap:'innerHTML'})}"
      class="text-xs bg-gray-700 hover:bg-red-700 text-gray-400 hover:text-white rounded-lg px-3 py-1.5 transition-colors" title="Remove site">
      ✕
    </button>
  </div>
  <div id="build-log-${escHtml(site.id)}" class="text-xs font-mono text-gray-400 hidden"></div>
</div>`;
      }).join('')
    : `<div class="col-span-3 text-center text-gray-500 py-20">
         <p class="text-4xl mb-3">⚡</p>
         <p class="text-lg font-medium">No sites registered yet</p>
         <p class="text-sm mt-1">Add your first Flint site to get started.</p>
         <a href="/sites/new" hx-get="/sites/new" hx-target="#content" hx-push-url="true"
            class="inline-block mt-4 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
           + Add Site
         </a>
       </div>`;

  const body = `
<div class="max-w-5xl mx-auto">
  <div class="flex items-center justify-between mb-8">
    <h1 class="text-2xl font-bold text-white">Sites</h1>
    <a href="/sites/new" hx-get="/sites/new" hx-target="#content" hx-push-url="true"
       class="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg">
      + Add Site
    </a>
  </div>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    ${cards}
  </div>
</div>`;

  return htmx ? body : shell({ title: 'Flint Manager', body });
}

export function renderAddSiteForm(htmx = false): string {
  const body = `
<div class="max-w-lg mx-auto">
  <h1 class="text-2xl font-bold text-white mb-6">Add Site</h1>
  <form hx-post="/api/sites" hx-target="#content" hx-swap="innerHTML"
        class="flex flex-col gap-4 bg-gray-800 rounded-xl p-6 border border-gray-700">
    ${formField('id', 'Site ID', 'text', 'my-site', 'Lowercase letters, numbers and hyphens')}
    ${formField('name', 'Display Name', 'text', 'My Site')}
    ${formField('path', 'Path', 'text', '../', 'Relative to manager/ or absolute path to Flint workspace')}
    ${formField('description', 'Description', 'text', '', 'Optional', false)}
    <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2 text-sm font-medium">
      Register Site
    </button>
  </form>
</div>`;
  return htmx ? body : shell({ title: 'Add Site — Flint Manager', body });
}

// ---- helpers ----------------------------------------------------------------

function readActiveTheme(siteId: string): string | null {
  const site = getSite(siteId);
  if (!site) return null;
  const envPath = join(resolveSitePath(site), '.env');
  if (!existsSync(envPath)) return null;
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const l of lines) {
    if (l.trim().startsWith('THEME=')) return l.trim().slice(6).trim() || null;
  }
  return null;
}

function formField(
  name: string,
  label: string,
  type: string,
  placeholder: string,
  hint?: string,
  required = true,
): string {
  return `
<div>
  <label class="block text-sm font-medium text-gray-300 mb-1">${escHtml(label)}${required ? ' <span class="text-red-400">*</span>' : ''}</label>
  <input type="${type}" name="${name}" placeholder="${escHtml(placeholder)}"
         ${required ? 'required' : ''}
         class="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
  ${hint ? `<p class="text-xs text-gray-500 mt-1">${escHtml(hint)}</p>` : ''}
</div>`;
}
