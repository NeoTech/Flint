/**
 * UI: Themes -- theme switcher + template browser.
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
<div data-theme-card="${escHtml(name)}" class="bg-gray-800 rounded-xl border ${isActive ? 'border-indigo-500' : 'border-gray-700'} p-5 flex flex-col gap-3 transition-all duration-200">
  <div class="flex items-start justify-between gap-2">
    <div class="flex-1 min-w-0">
      <h3 class="font-semibold text-white truncate cursor-pointer hover:text-indigo-300 transition-colors"
          title="Double-click to rename"
          ondblclick="window.themeRenameInline(this, '${escHtml(name)}', '${escHtml(siteId)}')"
          >${escHtml(name)}</h3>
      <p class="text-xs text-gray-500 mt-0.5">${templateCount} template${templateCount !== 1 ? 's' : ''}</p>
    </div>
    <div class="flex items-center gap-1 shrink-0">
      ${isActive ? '<span class="text-xs bg-indigo-700 text-indigo-200 px-2 py-0.5 rounded-full">Active</span>' : ''}
      <button title="Rename theme"
        onclick="window.themeRenameInline(this.closest('[data-theme-card]').querySelector('h3'), '${escHtml(name)}', '${escHtml(siteId)}')"
        class="text-gray-500 hover:text-yellow-400 transition-colors p-1 rounded hover:bg-gray-700">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zm-2.207 2.207L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
        </svg>
      </button>
      <button title="${isActive ? 'Cannot delete active theme' : 'Delete theme'}"
        ${isActive ? 'disabled' : `onclick="window.themeDelete('${escHtml(siteId)}', '${escHtml(name)}')"`}
        class="transition-colors p-1 rounded ${isActive ? 'text-gray-700 cursor-not-allowed' : 'text-gray-500 hover:text-red-400 hover:bg-gray-700'}">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
        </svg>
      </button>
    </div>
  </div>

  <button
    data-theme="${escHtml(name)}"
    hx-get="/sites/${escHtml(siteId)}/themes/${escHtml(name)}/templates"
    hx-target="#template-browser"
    hx-swap="innerHTML"
    hx-on:htmx:after-request="window.collapseOtherCards(this.dataset.theme)"
    class="theme-card-browse text-xs text-indigo-400 hover:text-indigo-300 text-left">
    Browse templates &#x2192;
  </button>

  <div class="theme-card-actions">
    ${!isActive ? `
  <button
    onclick="window.setTheme('${escHtml(siteId)}', this.dataset.theme)"
    data-theme="${escHtml(name)}"
    class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-1.5 w-full">
    Activate
  </button>` : '<p class="text-xs text-green-400">Currently active</p>'}
  </div>
</div>`;
  }).join('');

  const compactPills = themes.map(name => {
    const isActive = name === activeTheme;
    return `<button
  data-pill="${escHtml(name)}"
  data-theme="${escHtml(name)}"
  hx-get="/sites/${escHtml(siteId)}/themes/${escHtml(name)}/templates"
  hx-target="#template-browser"
  hx-swap="innerHTML"
  hx-on:htmx:after-request="window.collapseOtherCards(this.dataset.theme)"
  class="px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${isActive ? 'bg-indigo-700 text-indigo-200' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}">
  ${escHtml(name)}${isActive ? ' &#x25cf;' : ''}
</button>`;
  }).join('');

  const body = `
<div style="height:calc(100vh - 112px)" class="flex flex-col">

  <!-- Expanded header (shown by default) -->
  <div id="themes-header" class="shrink-0 flex flex-col gap-4 pb-5">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-white">Themes</h1>
      <div class="flex items-center gap-3">
        <p class="text-sm text-gray-400">Active: <span class="text-indigo-300 font-medium">${escHtml(activeTheme)}</span></p>
        <button onclick="window.themeShowCreate()"
          class="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors">
          + New Theme
        </button>
      </div>
    </div>
    <div id="theme-status" class="text-sm h-5"></div>
    <!-- Inline new-theme form (hidden by default) -->
    <div id="theme-create-wrap" class="hidden flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3">
      <span class="text-xs text-gray-400 shrink-0">Theme name:</span>
      <input id="theme-create-input" type="text" placeholder="my-theme" autocomplete="off"
        class="flex-1 bg-transparent text-sm text-white outline-none placeholder-gray-600 font-mono"
        onkeydown="window.themeCreateKeydown(event, '${escHtml(siteId)}')" />
      <button onclick="window.themeCreateCommit('${escHtml(siteId)}')"
        class="text-xs px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors shrink-0">Create</button>
      <button onclick="window.themeCreateCancel()"
        class="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors shrink-0">Cancel</button>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      ${themeCards || '<p class="text-gray-500 col-span-4">No themes found in themes/</p>'}
    </div>
  </div>

  <!-- Compact strip (hidden by default) -->
  <div id="themes-compact" class="hidden shrink-0 flex items-center gap-3 border-b border-gray-700 pb-2 mb-2">
    <button onclick="window.expandThemeCards()" class="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1" title="Expand theme cards">
      <span class="text-base leading-none">&#x25be;</span> Themes
    </button>
    <div class="flex gap-1.5 flex-wrap flex-1">
      ${compactPills}
    </div>
    <div id="theme-status-compact" class="text-xs text-gray-500"></div>
  </div>

  <!-- Template browser -- fills remaining space -->
  <div id="template-browser" class="flex-1 min-h-0">
    <p class="text-sm text-gray-600">Click \u201cBrowse templates \u2192\u201d to view and edit a theme\u2019s templates.</p>
  </div>

</div>

<script>(function() {
  window.setTheme = function(siteId, theme) {
    fetch('/sites/' + siteId + '/themes/active', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme }),
    }).then(function(resp) {
      var status = document.getElementById('theme-status');
      if (resp.ok) {
        status.textContent = 'Theme set to "' + theme + '". Reloading\u2026';
        status.className = 'text-sm text-green-400 h-5';
        setTimeout(function() { location.reload(); }, 1500);
      } else {
        resp.json().then(function(err) {
          status.textContent = 'Error: ' + (err.error ?? resp.status);
          status.className = 'text-sm text-red-400 h-5';
        });
      }
    });
  };

  window.collapseOtherCards = function(browsedTheme) {
    // Swap header -> compact strip
    document.getElementById('themes-header').classList.add('hidden');
    var compact = document.getElementById('themes-compact');
    compact.classList.remove('hidden');
    compact.classList.add('flex');
    // Highlight the browsed theme pill
    compact.querySelectorAll('[data-pill]').forEach(function(pill) {
      var mine = pill.dataset.pill === browsedTheme;
      pill.classList.toggle('bg-indigo-700', mine);
      pill.classList.toggle('text-indigo-200', mine);
      pill.classList.toggle('bg-gray-800', !mine);
      pill.classList.toggle('text-gray-400', !mine);
    });
  };

  window.expandThemeCards = function() {
    document.getElementById('themes-header').classList.remove('hidden');
    var compact = document.getElementById('themes-compact');
    compact.classList.add('hidden');
    compact.classList.remove('flex');
    // Clear template browser back to placeholder
    document.getElementById('template-browser').innerHTML =
      '<p class="text-sm text-gray-600">Click \u201cBrowse templates \u2192\u201d to view and edit a theme\u2019s templates.</p>';
  };

  // ---- New theme -----------------------------------------------------------
  window.themeShowCreate = function() {
    var wrap = document.getElementById('theme-create-wrap');
    wrap.classList.remove('hidden');
    wrap.classList.add('flex');
    document.getElementById('theme-create-input').focus();
  };
  window.themeCreateCancel = function() {
    var wrap = document.getElementById('theme-create-wrap');
    wrap.classList.add('hidden');
    wrap.classList.remove('flex');
    document.getElementById('theme-create-input').value = '';
    document.getElementById('theme-status').textContent = '';
    document.getElementById('theme-status').className = 'text-sm h-5';
  };
  window.themeCreateKeydown = function(e, siteId) {
    if (e.key === 'Enter') { e.preventDefault(); window.themeCreateCommit(siteId); }
    if (e.key === 'Escape') window.themeCreateCancel();
  };
  window.themeCreateCommit = function(siteId) {
    var name = document.getElementById('theme-create-input').value.trim();
    if (!name) return;
    var status = document.getElementById('theme-status');
    status.textContent = 'Creating\u2026';
    status.className = 'text-sm text-gray-400 h-5';
    fetch('/sites/' + siteId + '/themes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d }; }); })
    .then(function(res) {
      if (res.ok) {
        status.textContent = 'Created "' + name + '". Reloading\u2026';
        status.className = 'text-sm text-green-400 h-5';
        setTimeout(function() { location.reload(); }, 800);
      } else {
        status.textContent = 'Error: ' + (res.d.error ?? 'unknown');
        status.className = 'text-sm text-red-400 h-5';
      }
    }).catch(function(e) {
      status.textContent = 'Network error: ' + e.message;
      status.className = 'text-sm text-red-400 h-5';
    });
  };

  // ---- Rename theme (inline on the h3) ------------------------------------
  window.themeRenameInline = function(h3El, oldName, siteId) {
    if (h3El.tagName !== 'H3') return;
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.value = oldName;
    inp.className = 'font-semibold text-white bg-gray-700 border border-indigo-500 rounded px-1 outline-none w-full font-mono text-sm';
    h3El.replaceWith(inp);
    inp.focus();
    inp.select();
    var done = false;
    function commit() {
      if (done) return;
      done = true;
      var newName = inp.value.trim();
      if (!newName || newName === oldName) { inp.replaceWith(h3El); return; }
      var status = document.getElementById('theme-status');
      status.textContent = 'Renaming\u2026';
      status.className = 'text-sm text-gray-400 h-5';
      fetch('/sites/' + siteId + '/themes/' + encodeURIComponent(oldName), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName }),
      }).then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d }; }); })
      .then(function(res) {
        if (res.ok) {
          status.textContent = 'Renamed to "' + newName + '". Reloading\u2026';
          status.className = 'text-sm text-green-400 h-5';
          setTimeout(function() { location.reload(); }, 800);
        } else {
          inp.replaceWith(h3El);
          status.textContent = 'Error: ' + (res.d.error ?? 'unknown');
          status.className = 'text-sm text-red-400 h-5';
        }
      }).catch(function(e) {
        inp.replaceWith(h3El);
        status.textContent = 'Network error: ' + e.message;
        status.className = 'text-sm text-red-400 h-5';
      });
    }
    inp.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { done = true; inp.replaceWith(h3El); }
    });
    inp.addEventListener('blur', commit);
  };

  // ---- Delete theme --------------------------------------------------------
  window.themeDelete = function(siteId, name) {
    if (!confirm('Delete theme "' + name + '" and ALL its files? This cannot be undone.')) return;
    var status = document.getElementById('theme-status');
    status.textContent = 'Deleting\u2026';
    status.className = 'text-sm text-gray-400 h-5';
    fetch('/sites/' + siteId + '/themes/' + encodeURIComponent(name), { method: 'DELETE' })
    .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d }; }); })
    .then(function(res) {
      if (res.ok) {
        status.textContent = 'Deleted "' + name + '". Reloading\u2026';
        status.className = 'text-sm text-green-400 h-5';
        setTimeout(function() { location.reload(); }, 800);
      } else {
        status.textContent = 'Error: ' + (res.d.error ?? 'unknown');
        status.className = 'text-sm text-red-400 h-5';
      }
    }).catch(function(e) {
      status.textContent = 'Network error: ' + e.message;
      status.className = 'text-sm text-red-400 h-5';
    });
  };
})();</script>`;

  return htmx ? body : shell({ title: 'Themes \u2014 Flint Manager', siteId, activeSection: 'themes', body });
}

export function renderTemplateBrowser(siteId: string, themeName: string): string {
  const site = getSite(siteId);
  if (!site) return `<p class="text-red-400">Site not found</p>`;

  const themeDir = join(resolveSitePath(site), 'themes', themeName);
  if (!existsSync(themeDir))
    return `<p class="text-gray-500">Theme directory not found: "${escHtml(themeName)}".</p>`;

  const EDITABLE = new Set(['.html', '.css', '.js']);
  const files = collectThemeFiles(themeDir, themeDir, EDITABLE);
  if (!files.length) return `<p class="text-gray-500">No editable files found in theme "${escHtml(themeName)}".</p>`;

  // Group by directory
  const groups = new Map<string, Array<{ name: string; relativePath: string; idx: number }>>();
  files.forEach((f, i) => {
    const slash = f.relativePath.indexOf('/');
    const dir = slash >= 0 ? f.relativePath.slice(0, slash) : '';
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir)!.push({ name: f.name, relativePath: f.relativePath, idx: i });
  });

  let sidebarRows = '';
  for (const [dir, dirFiles] of groups) {
    sidebarRows += `<div data-tmpl-group="${escHtml(dir || '__root__')}">\n`;
    if (dir) {
      sidebarRows += `<div class="px-3 pt-3 pb-0.5 text-xs font-semibold text-gray-500 uppercase tracking-wider select-none">${escHtml(dir)}/</div>\n`;
    }
    for (const f of dirFiles) {
      sidebarRows += `<button
  data-tmpl-tab="${f.idx}"
  data-file="${escHtml(f.relativePath)}"
  onclick="window.tmplSwitchTo(parseInt(this.dataset.tmplTab,10))"
  ondblclick="window.tmplStartRename(parseInt(this.dataset.tmplTab,10), this)"
  title="Double-click to rename"
  class="tmpl-tab w-full text-left px-3 py-1.5 text-xs font-mono truncate transition-colors ${f.idx === 0 ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}">
  ${escHtml(f.name)}
</button>\n`;
    }
    sidebarRows += `</div>\n`;
  }

  return `
<div
  id="tmpl-browser-root"
  data-site-id="${escHtml(siteId)}"
  data-theme-name="${escHtml(themeName)}"
  class="bg-gray-900 rounded-xl border border-gray-700 flex flex-row overflow-hidden"
  style="height:100%">

  <!-- Left sidebar: file list -->
  <div class="flex flex-col border-r border-gray-700 shrink-0" style="width:180px">
    <div class="flex items-center justify-between px-3 py-2 border-b border-gray-700 shrink-0">
      <span class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Files</span>
      <!-- New file dropdown -->
      <div id="tmpl-new-btn-wrap" class="relative">
        <button onclick="window.tmplToggleNewDropdown()" title="New file"
          class="text-gray-400 hover:text-white transition-colors px-1 text-sm leading-none">+</button>
        <div id="tmpl-new-menu" class="hidden absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded shadow-xl z-20" style="width:148px">
          <button onclick="window.tmplAddNewInline('.html', 'templates')"
            class="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-white">
            HTML template
          </button>
          <button onclick="window.tmplAddNewInline('.css', 'styles')"
            class="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 hover:text-white">
            CSS file
          </button>
        </div>
      </div>
    </div>
    <div id="tmpl-file-list" class="flex flex-col overflow-y-auto flex-1 py-1">
      ${sidebarRows}
    </div>
  </div>

  <!-- Right: toolbar + editor + status -->
  <div class="flex flex-col flex-1 min-w-0">
    <div class="flex items-center gap-2 px-3 py-2 border-b border-gray-700 shrink-0">
      <span class="text-xs text-gray-500">Theme: <span class="text-indigo-300 font-semibold">${escHtml(themeName)}</span></span>
      <span class="text-xs text-gray-600 font-mono" id="tmpl-active-file"></span>
      <div class="flex-1"></div>
      <button onclick="window.tmplToggleRelLines()" title="Toggle relative line numbers"
        class="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border border-gray-700 font-mono transition-colors"
        id="tmpl-rellines-btn">abs#</button>
      <button onclick="window.tmplDelete()"
        id="tmpl-delete-btn"
        class="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-red-900 text-gray-400 hover:text-red-300 border border-gray-700 transition-colors">Delete</button>
      <button onclick="window.tmplSave()"
        class="text-xs px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors">Save</button>
    </div>
    <div id="tmpl-cm-wrap" class="flex-1 overflow-auto min-h-0"></div>
    <div id="tmpl-status" class="px-3 py-1 text-xs text-gray-500 border-t border-gray-700 shrink-0 font-mono">Loading\u2026</div>
  </div>
</div>

<script type="module">(async function() {
  if (window.__tmplEditor) {
    try { window.__tmplEditor.destroy(); } catch(e) {}
    window.__tmplEditor = null;
  }
  // Remove previous click-outside handler
  if (window.__tmplOutsideHandler) {
    document.removeEventListener('click', window.__tmplOutsideHandler, true);
    window.__tmplOutsideHandler = null;
  }
  window.__tmplFiles    = [];
  window.__tmplIdx      = 0;
  window.__tmplRelLines = false;

  const root      = document.getElementById('tmpl-browser-root');
  const siteId    = root.dataset.siteId;
  const themeName = root.dataset.themeName;
  const status    = document.getElementById('tmpl-status');
  const wrap      = document.getElementById('tmpl-cm-wrap');
  const fileLabel = document.getElementById('tmpl-active-file');
  const deleteBtn = document.getElementById('tmpl-delete-btn');

  // ---- CodeMirror 6 imports ------------------------------------------------
  const [cmView, cmState, cmCommands, cmLanguage, cmHtml, cmCss, cmDark, cmAuto] = await Promise.all([
    import('https://esm.sh/@codemirror/view@6.39.15'),
    import('https://esm.sh/@codemirror/state@6.5.4'),
    import('https://esm.sh/@codemirror/commands@6.10.2'),
    import('https://esm.sh/@codemirror/language@6.12.1'),
    import('https://esm.sh/@codemirror/lang-html@6.4.11'),
    import('https://esm.sh/@codemirror/lang-css@6.3.1'),
    import('https://esm.sh/@codemirror/theme-one-dark@6.1.3'),
    import('https://esm.sh/@codemirror/autocomplete@6'),
  ]);
  const { EditorView, lineNumbers, highlightActiveLine, keymap, drawSelection, highlightActiveLineGutter } = cmView;
  const { EditorState, Compartment } = cmState;
  const { defaultKeymap, historyKeymap, history, indentWithTab } = cmCommands;
  const { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, codeFolding, foldKeymap } = cmLanguage;
  const { html: htmlLang } = cmHtml;
  const { css: cssLang } = cmCss;
  const { oneDark } = cmDark;
  const { autocompletion, completionKeymap } = cmAuto;

  const lineNumComp = new Compartment();
  const langComp    = new Compartment();

  function extOf(p) { var d = p.lastIndexOf('.'); return d >= 0 ? p.slice(d) : ''; }
  function langFor(p) { return extOf(p) === '.css' ? cssLang() : htmlLang({ autoCloseTags: true }); }

  function makeLineNumbers() {
    if (window.__tmplRelLines) {
      return lineNumbers({ formatNumber(n, state) {
        var cur = state.doc.lineAt(state.selection.main.head).number;
        return n === cur ? String(n) : String(Math.abs(n - cur));
      }});
    }
    return lineNumbers();
  }

  function buildExtensions(relPath) {
    return [
      oneDark, langComp.of(langFor(relPath)), lineNumComp.of(makeLineNumbers()),
      highlightActiveLine(), highlightActiveLineGutter(), drawSelection(),
      bracketMatching(), foldGutter(), codeFolding(), history(), autocompletion(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      keymap.of([...defaultKeymap, ...historyKeymap, ...completionKeymap, ...foldKeymap,
        indentWithTab, { key: 'Mod-s', run() { window.tmplSave(); return true; } }]),
      EditorView.theme({
        '&': { height: '100%', fontSize: '13px' },
        '.cm-scroller': { overflow: 'auto', fontFamily: 'ui-monospace,monospace' },
      }),
    ];
  }

  // ---- Fetch all files ------------------------------------------------------
  var resp;
  try { resp = await fetch('/sites/' + siteId + '/themes/' + themeName + '/files'); }
  catch(e) { status.textContent = 'Network error: ' + e.message; return; }
  if (!resp.ok) { status.textContent = 'Failed (' + resp.status + ')'; return; }
  window.__tmplFiles = await resp.json();
  if (!window.__tmplFiles.length) { status.textContent = 'No files.'; return; }

  // ---- Init editor ----------------------------------------------------------
  var first = window.__tmplFiles[0];
  window.__tmplEditor = new EditorView({
    state: EditorState.create({ doc: first.content, extensions: buildExtensions(first.relativePath) }),
    parent: wrap,
  });

  // ---- Sidebar sync ---------------------------------------------------------
  function syncSidebar(idx) {
    document.querySelectorAll('.tmpl-tab').forEach(function(btn) {
      var tabIdx = parseInt(btn.dataset.tmplTab, 10);
      btn.classList.toggle('bg-gray-700', tabIdx === idx);
      btn.classList.toggle('text-white', tabIdx === idx);
      btn.classList.toggle('text-gray-400', tabIdx !== idx);
    });
    var f = window.__tmplFiles[idx];
    if (fileLabel && f) fileLabel.textContent = '\u2014 ' + f.relativePath;
    if (deleteBtn) {
      var rel = f ? f.relativePath : '';
      var del = rel.startsWith('templates/') && rel.endsWith('.html')
             || (rel.startsWith('styles/') && rel !== 'styles/main.css');
      deleteBtn.disabled = !del;
      deleteBtn.classList.toggle('opacity-40', !del);
      deleteBtn.classList.toggle('cursor-not-allowed', !del);
    }
  }
  syncSidebar(0);

  // ---- Helper: make a sidebar button element --------------------------------
  function makeSidebarBtn(idx, f) {
    var btn = document.createElement('button');
    btn.dataset.tmplTab = String(idx);
    btn.dataset.file = f.relativePath;
    btn.className = 'tmpl-tab w-full text-left px-3 py-1.5 text-xs font-mono truncate transition-colors text-gray-400 hover:text-white hover:bg-gray-800';
    btn.title = 'Double-click to rename';
    btn.textContent = f.name;
    btn.onclick = function() { window.tmplSwitchTo(parseInt(btn.dataset.tmplTab, 10)); };
    btn.ondblclick = function() { window.tmplStartRename(parseInt(btn.dataset.tmplTab, 10), btn); };
    return btn;
  }

  // ---- Helper: inline input style ------------------------------------------
  function makeInlineInput(value, placeholder) {
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.value = value || '';
    inp.placeholder = placeholder || '';
    inp.className = 'w-full px-3 py-1.5 text-xs font-mono bg-gray-700 text-white border-y border-indigo-500 outline-none placeholder-gray-500';
    return inp;
  }

  // ---- Helper: find/create a group container --------------------------------
  function getOrCreateGroup(dir) {
    var key = dir || '__root__';
    var group = document.querySelector('[data-tmpl-group="' + key + '"]');
    if (group) return group;
    group = document.createElement('div');
    group.dataset.tmplGroup = key;
    if (dir) {
      var hdr = document.createElement('div');
      hdr.className = 'px-3 pt-3 pb-0.5 text-xs font-semibold text-gray-500 uppercase tracking-wider select-none';
      hdr.textContent = dir + '/';
      group.appendChild(hdr);
    }
    document.getElementById('tmpl-file-list').appendChild(group);
    return group;
  }

  // ---- Dropdown ---------------------------------------------------------------
  window.tmplToggleNewDropdown = function() {
    var menu = document.getElementById('tmpl-new-menu');
    if (menu) menu.classList.toggle('hidden');
  };
  window.__tmplOutsideHandler = function(e) {
    if (!e.target.closest('#tmpl-new-btn-wrap')) {
      var menu = document.getElementById('tmpl-new-menu');
      if (menu) menu.classList.add('hidden');
    }
  };
  document.addEventListener('click', window.__tmplOutsideHandler, true);

  // ---- Inline new file creation --------------------------------------------
  window.tmplAddNewInline = function(ext, dir) {
    var menu = document.getElementById('tmpl-new-menu');
    if (menu) menu.classList.add('hidden');

    var group = getOrCreateGroup(dir);
    var inp = makeInlineInput('', 'name' + ext);
    group.appendChild(inp);
    inp.focus();
    var done = false;

    function commit() {
      if (done) return;
      done = true;
      var raw = inp.value.trim();
      if (!raw) { inp.remove(); return; }
      var name = raw.endsWith(ext) ? raw : raw + ext;
      var relPath = dir + '/' + name;

      fetch('/sites/' + siteId + '/themes/' + themeName + '/files/' + relPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).then(function(r) {
        return r.json().then(function(data) { return { ok: r.ok, data }; });
      }).then(function(res) {
        if (res.ok) {
          var idx = window.__tmplFiles.length;
          var f = { name: name, relativePath: relPath, content: res.data.content };
          window.__tmplFiles.push(f);
          var btn = makeSidebarBtn(idx, f);
          inp.replaceWith(btn);
          window.tmplSwitchTo(idx);
          status.textContent = 'Created ' + relPath;
          setTimeout(function() { status.textContent = ''; }, 2000);
        } else {
          inp.remove();
          status.textContent = 'Error: ' + (res.data.error ?? 'unknown');
        }
      }).catch(function(e) {
        inp.remove();
        status.textContent = 'Network error: ' + e.message;
      });
    }

    inp.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { done = true; inp.remove(); }
    });
    inp.addEventListener('blur', commit);
  };

  // ---- Inline rename --------------------------------------------------------
  window.tmplStartRename = function(idx, btn) {
    var f = window.__tmplFiles[idx];
    if (!f) return;
    var oldName = f.name;
    var inp = makeInlineInput(oldName, oldName);
    btn.replaceWith(inp);
    inp.focus();
    inp.select();
    var done = false;

    function commit() {
      if (done) return;
      done = true;
      var newName = inp.value.trim();
      if (!newName || newName === oldName) { inp.replaceWith(btn); return; }

      fetch('/sites/' + siteId + '/themes/' + themeName + '/files/' + f.relativePath, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName }),
      }).then(function(r) {
        return r.json().then(function(data) { return { ok: r.ok, data }; });
      }).then(function(res) {
        if (res.ok) {
          f.name = newName;
          f.relativePath = res.data.newRelativePath;
          btn.textContent = newName;
          btn.dataset.file = f.relativePath;
          inp.replaceWith(btn);
          syncSidebar(idx);
          status.textContent = 'Renamed \u2014 ' + f.relativePath;
          setTimeout(function() { status.textContent = ''; }, 2000);
        } else {
          inp.replaceWith(btn);
          status.textContent = 'Error: ' + (res.data.error ?? 'unknown');
        }
      }).catch(function(e) {
        inp.replaceWith(btn);
        status.textContent = 'Network error: ' + e.message;
      });
    }

    inp.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { done = true; inp.replaceWith(btn); }
    });
    inp.addEventListener('blur', commit);
  };

  // ---- Switch file ----------------------------------------------------------
  window.tmplSwitchTo = function(idx) {
    if (!window.__tmplEditor) return;
    var f = window.__tmplFiles[idx];
    if (!f) return;
    window.__tmplIdx = idx;
    window.__tmplEditor.dispatch({
      changes: { from: 0, to: window.__tmplEditor.state.doc.length, insert: f.content },
      effects: langComp.reconfigure(langFor(f.relativePath)),
    });
    syncSidebar(idx);
  };

  // ---- Save -----------------------------------------------------------------
  window.tmplSave = async function() {
    if (!window.__tmplEditor) return;
    var f = window.__tmplFiles[window.__tmplIdx];
    if (!f) return;
    status.textContent = 'Saving\u2026';
    var content = window.__tmplEditor.state.doc.toString();
    try {
      var r = await fetch('/sites/' + siteId + '/themes/' + themeName + '/files/' + f.relativePath, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }),
      });
      if (r.ok) {
        f.content = content;
        status.textContent = 'Saved \u2014 ' + f.relativePath;
        setTimeout(function() { status.textContent = ''; }, 2000);
      } else {
        var err = await r.json();
        status.textContent = 'Error: ' + (err.error ?? r.status);
      }
    } catch(e) { status.textContent = 'Network error: ' + e.message; }
  };

  // ---- Delete file ---------------------------------------------------------
  window.tmplDelete = async function() {
    var deletedIdx = window.__tmplIdx;
    var f = window.__tmplFiles[deletedIdx];
    if (!f) return;
    var rel = f.relativePath;
    // Guard: only templates/*.html and styles/*.css (not main.css)
    var isTemplate = rel.startsWith('templates/') && rel.endsWith('.html');
    var isCss = rel.startsWith('styles/') && rel !== 'styles/main.css';
    if (!isTemplate && !isCss) return;
    if (!confirm('Delete ' + f.name + '? This cannot be undone.')) return;
    status.textContent = 'Deleting\u2026';
    try {
      var r = await fetch('/sites/' + siteId + '/themes/' + themeName + '/files/' + rel, {
        method: 'DELETE',
      });
      if (r.ok) {
        // Remove from data array
        window.__tmplFiles.splice(deletedIdx, 1);
        // Remove DOM button and decrement all higher data-tmpl-tab values
        document.querySelectorAll('.tmpl-tab').forEach(function(btn) {
          var tabIdx = parseInt(btn.dataset.tmplTab, 10);
          if (tabIdx === deletedIdx) { btn.remove(); }
          else if (tabIdx > deletedIdx) { btn.dataset.tmplTab = String(tabIdx - 1); }
        });
        window.__tmplIdx = Math.min(deletedIdx, window.__tmplFiles.length - 1);
        if (window.__tmplFiles.length) {
          window.tmplSwitchTo(window.__tmplIdx);
        } else {
          window.__tmplEditor.dispatch({ changes: { from: 0, to: window.__tmplEditor.state.doc.length, insert: '' } });
          status.textContent = 'No files remaining.';
        }
        status.textContent = 'Deleted ' + f.name;
        setTimeout(function() { status.textContent = ''; }, 2000);
      } else {
        var err = await r.json();
        status.textContent = 'Error: ' + (err.error ?? r.status);
      }
    } catch(e) { status.textContent = 'Network error: ' + e.message; }
  };

  // ---- Toggle line numbers -------------------------------------------------
  window.tmplToggleRelLines = function() {
    if (!window.__tmplEditor) return;
    window.__tmplRelLines = !window.__tmplRelLines;
    var btn = document.getElementById('tmpl-rellines-btn');
    if (btn) btn.textContent = window.__tmplRelLines ? 'rel#' : 'abs#';
    window.__tmplEditor.dispatch({ effects: lineNumComp.reconfigure(makeLineNumbers()) });
  };

  status.textContent = window.__tmplFiles.length + ' file' + (window.__tmplFiles.length !== 1 ? 's' : '') + ' loaded \u2014 Mod+S to save';
})();</script>`;
}
// ---- helpers ----------------------------------------------------------------

function collectThemeFiles(
  dir: string,
  themeRoot: string,
  editable: Set<string>,
): Array<{ name: string; relativePath: string }> {
  const results: Array<{ name: string; relativePath: string }> = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectThemeFiles(full, themeRoot, editable));
    } else if (editable.has(extname(entry))) {
      const relativePath = full.slice(themeRoot.length + 1).replace(/\\/g, '/');
      results.push({ name: entry, relativePath });
    }
  }
  return results;
}

function readThemeFromEnv(sitePath: string): string | null {
  const envPath = join(sitePath, '.env');
  if (!existsSync(envPath)) return null;
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const l of lines) {
    if (l.trim().startsWith('THEME=')) return l.trim().slice(6).trim() || null;
  }
  return null;
}
