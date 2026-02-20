/**
 * UI Shell — wraps every page in the full HTML document.
 *
 * Loads (all via CDN, no build step):
 *   - HTMX 2.x
 *   - HTMX SSE extension
 *   - Tailwind CSS play CDN
 *   - CodeMirror 6 (ESM, loaded per-page when needed)
 *
 * Layout:
 *   ┌────────────────────────────────────────────────────┐
 *   │ Top navbar: ⚡ Flint Manager   [Secrets] [Profile] │
 *   ├──────────┬─────────────────────────────────────────┤
 *   │ Sidebar  │  <main id="content">                    │
 *   │ site list│  (HTMX target — pages swap here)        │
 *   │ nav links│                                         │
 *   └──────────┴─────────────────────────────────────────┘
 */

import { loadRegistry } from '../registry.js';

export interface ShellOptions {
  title?: string;
  /** Active site id for sidebar highlight */
  siteId?: string;
  /** Active nav section for sidebar link highlight */
  activeSection?: 'pages' | 'products' | 'components' | 'build' | 'env' | 'themes' | 'media';
  /** Main body content */
  body: string;
  /** Extra <head> tags (e.g. inline scripts for CodeMirror) */
  head?: string;
}

export function shell(opts: ShellOptions): string {
  const sites = loadRegistry();
  const { title = 'Flint Manager', body, head = '' } = opts;

  // Render all sites; active state is managed client-side via updateNav()
  const siteLinks = sites.map(s => {
    const sectionLinks = navSections.map(section =>
      `<a href="/sites/${escHtml(s.id)}/${section.id}"
          data-nav-link
          hx-get="/sites/${escHtml(s.id)}/${section.id}"
          hx-target="#content"
          hx-push-url="true"
          class="flex items-center gap-2 pl-5 pr-2 py-1.5 rounded-md text-xs text-indigo-300 hover:bg-indigo-700 hover:text-white transition-colors">
        ${section.icon} ${section.label}
      </a>`
    ).join('');

    return `
<div data-site-group="${escHtml(s.id)}">
  <a href="/sites/${escHtml(s.id)}/pages"
     data-nav-link
     data-site-link="${escHtml(s.id)}"
     hx-get="/sites/${escHtml(s.id)}/pages"
     hx-target="#content"
     hx-push-url="true"
     class="block px-3 py-2 rounded-md text-sm font-medium text-indigo-200 hover:bg-indigo-700 hover:text-white transition-colors">
    ${escHtml(s.name)}
  </a>
  <div data-site-sections="${escHtml(s.id)}" class="hidden flex-col gap-0.5 mt-0.5">
    ${sectionLinks}
  </div>
</div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(title)}</title>
  <script src="https://unpkg.com/htmx.org@2/dist/htmx.min.js"></script>
  <script src="https://unpkg.com/htmx-ext-sse@2/sse.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/sortablejs@1/Sortable.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/js-yaml@4/dist/js-yaml.min.js"></script>
  <style>
    /* Prose styles for markdown preview */
    .prose { color: #e2e8f0; line-height: 1.7; }
    .prose h1,.prose h2,.prose h3,.prose h4 { color: #f1f5f9; font-weight: 700; margin: 1.25em 0 0.5em; line-height: 1.3; }
    .prose h1 { font-size: 1.875rem; } .prose h2 { font-size: 1.5rem; }
    .prose h3 { font-size: 1.25rem; } .prose h4 { font-size: 1.1rem; }
    .prose p { margin: 0.75em 0; }
    .prose a { color: #818cf8; text-decoration: underline; }
    .prose strong { color: #f1f5f9; font-weight: 600; }
    .prose em { font-style: italic; }
    .prose code { background: #1e1b4b; color: #a5b4fc; padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.875em; font-family: monospace; }
    .prose pre { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 1rem; overflow-x: auto; margin: 1em 0; }
    .prose pre code { background: none; padding: 0; color: #94a3b8; }
    .prose ul { list-style: disc; padding-left: 1.5em; margin: 0.75em 0; }
    .prose ol { list-style: decimal; padding-left: 1.5em; margin: 0.75em 0; }
    .prose li { margin: 0.25em 0; }
    .prose blockquote { border-left: 3px solid #4f46e5; padding-left: 1em; color: #94a3b8; margin: 1em 0; font-style: italic; }
    .prose hr { border-color: #334155; margin: 1.5em 0; }
    .prose table { width: 100%; border-collapse: collapse; margin: 1em 0; }
    .prose th,.prose td { border: 1px solid #334155; padding: 0.5em 0.75em; text-align: left; }
    .prose th { background: #1e293b; font-weight: 600; }
    /* Drag handle cursor */
    [data-drag-handle] { cursor: grab; user-select: none; }
    [data-drag-handle]:active { cursor: grabbing; }
    .sortable-ghost { opacity: 0.4; }
    .sortable-chosen { box-shadow: 0 0 0 2px #6366f1; border-radius: 6px; }
  </style>
  ${head}
</head>
<body class="bg-gray-950 text-gray-100 h-screen overflow-hidden flex flex-col">

  <!-- Top Navbar -->
  <header class="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-4 shrink-0 z-20">
    <!-- Branding -->
    <a href="/" hx-get="/" hx-target="#content" hx-push-url="true"
       class="flex items-center gap-2 hover:opacity-80 transition-opacity mr-auto">
      <span class="text-xl leading-none">⚡</span>
      <span class="font-bold text-white text-base tracking-tight">Flint Manager</span>
    </a>

    <!-- Right actions -->
    <div class="flex items-center gap-1">
      <!-- Secrets / API keys -->
      <a href="/settings/secrets"
         class="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
         title="Secrets &amp; API Keys">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h18v-1a6 6 0 00-6-6H9z" />
          <circle cx="18" cy="7" r="3" fill="currentColor" stroke="none" />
        </svg>
        Secrets
      </a>

      <!-- Profile dropdown -->
      <div class="relative">
        <button onclick="toggleProfileMenu()" id="profile-btn"
                class="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
          <span class="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold leading-none select-none">F</span>
          <span>Profile</span>
          <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clip-rule="evenodd"/>
          </svg>
        </button>
        <!-- Dropdown -->
        <div id="profile-menu"
             class="hidden absolute right-0 top-9 w-44 bg-gray-800 border border-gray-700 rounded-xl shadow-xl py-1 z-30">
          <div class="px-3 py-2 border-b border-gray-700 mb-1">
            <p class="text-xs font-semibold text-white">Flint Manager</p>
            <p class="text-xs text-gray-500 truncate">Admin</p>
          </div>
          <a href="/profile"
             class="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-gray-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5.121 17.804A7 7 0 0112 15a7 7 0 016.879 2.804M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            Account
          </a>
          <a href="/settings"
             class="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-gray-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            Settings
          </a>
          <div class="border-t border-gray-700 mt-1 pt-1">
            <a href="/logout"
               class="flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-gray-700 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
              Sign out
            </a>
          </div>
        </div>
      </div>
    </div>
  </header>

  <!-- Below navbar: sidebar + content -->
  <div class="flex flex-1 min-h-0">

  <!-- Sidebar -->
  <aside class="w-56 bg-indigo-900 flex flex-col py-4 px-3 gap-4 shrink-0 overflow-y-auto">

    <!-- Sites -->
    <div class="flex-1 overflow-y-auto">
      <div class="flex items-center justify-between px-2 mb-1">
        <p class="text-xs font-semibold text-indigo-400 uppercase">Sites</p>
        <a href="/" hx-get="/" hx-target="#content" hx-push-url="true"
           class="text-xs text-indigo-400 hover:text-white transition-colors" title="All Sites">
          ⊞
        </a>
      </div>
      <div class="flex flex-col gap-0.5" id="site-list">
        ${siteLinks || '<span class="text-xs text-indigo-400 px-2">No sites registered</span>'}
      </div>
    </div>

    <!-- Bottom actions -->
    <div class="flex flex-col gap-1.5">
      <a href="/" hx-get="/" hx-target="#content" hx-push-url="true"
         class="block text-center text-xs text-indigo-300 hover:text-white border border-indigo-700 rounded-md px-2 py-1.5 transition-colors">
        ⊞ Switch Site
      </a>
      <a href="/sites/new" hx-get="/sites/new" hx-target="#content" hx-push-url="true"
         class="block text-center text-xs text-indigo-300 hover:text-white border border-indigo-600 rounded-md px-2 py-1.5 transition-colors">
        + Add Site
      </a>
    </div>
  </aside>

  <!-- Main -->
  <main id="content" class="flex-1 p-8 overflow-y-auto">
    ${body}
  </main>

  </div><!-- end flex row -->

  <script>
    // ---- Profile dropdown ---------------------------------------------------
    function toggleProfileMenu() {
      const menu = document.getElementById('profile-menu');
      menu.classList.toggle('hidden');
    }
    // Close profile menu when clicking outside
    document.addEventListener('click', function(e) {
      const btn = document.getElementById('profile-btn');
      const menu = document.getElementById('profile-menu');
      if (menu && btn && !btn.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.add('hidden');
      }
    });

    /**
     * Set #editor-pane innerHTML AND re-execute any <script> tags inside it.
     * Plain innerHTML assignment silently drops scripts - this helper fixes that.
     */
    function setEditorPane(html) {
      const pane = document.getElementById('editor-pane');
      if (!pane) return;
      pane.innerHTML = html;
      pane.querySelectorAll('script').forEach(el => {
        const s = document.createElement('script');
        if (el.src) { s.src = el.src; s.async = false; }
        else s.textContent = el.textContent;
        el.replaceWith(s);
      });
    }

    // Update sidebar active states based on current URL.
    // Called on initial load and after every HTMX navigation.
    function updateNav() {
      const path = window.location.pathname;

      // Match /sites/:id or /sites/:id/section
      const siteMatch = path.match(/^\\/sites\\/([^\\/]+)/);
      const activeSiteId = siteMatch ? siteMatch[1] : null;
      const sectionMatch = path.match(/^\\/sites\\/[^\\/]+\\/([^\\/]+)/);
      const activeSection = sectionMatch ? sectionMatch[1] : null;

      // Update site link active states
      document.querySelectorAll('[data-site-link]').forEach(el => {
        const id = el.getAttribute('data-site-link');
        const isActive = id === activeSiteId;
        el.classList.toggle('bg-indigo-700', isActive);
        el.classList.toggle('text-white', isActive);
        el.classList.toggle('text-indigo-200', !isActive);
      });

      // Show/hide section sub-navs
      document.querySelectorAll('[data-site-sections]').forEach(el => {
        const id = el.getAttribute('data-site-sections');
        const show = id === activeSiteId;
        el.classList.toggle('hidden', !show);
        el.classList.toggle('flex', show);
      });

      // Update section link active states
      document.querySelectorAll('[data-nav-link]').forEach(el => {
        if (el.hasAttribute('data-site-link')) return; // handled above
        const href = el.getAttribute('href') ?? '';
        const sectionId = href.split('/').pop();
        const isActive = sectionId === activeSection && href.includes('/' + activeSiteId + '/');
        el.classList.toggle('bg-indigo-800', isActive);
        el.classList.toggle('text-white', isActive);
        el.classList.toggle('text-indigo-300', !isActive);
      });
    }

    // Run on load and after every HTMX push/replace
    updateNav();
    document.addEventListener('htmx:afterSettle', () => {
      updateNav();
      if (typeof initTreeSortable === 'function') initTreeSortable();
      if (typeof initProductsSortable === 'function') initProductsSortable();
    });
  </script>

  <script>
  // ---- Component modal management (persistent — available in any pane) ------
  window.openCompModal = function(modalId) {
    document.getElementById(modalId)?.classList.remove('hidden');
  };
  window.closeCompModal = function(modalId) {
    document.getElementById(modalId)?.classList.add('hidden');
  };

  window.clearComp = function(tag) {
    if (!confirm('Clear this component? Data will be removed on save.')) return;
    const map = window.__compTagToKey || {};
    const key = map[tag];
    if (key) { window.__compData = window.__compData || {}; window.__compData[key] = null; }
    window.closeCompModal('modal-' + tag);
  };

  window.saveCompModal = function(modalId, tag) {
    const map = window.__compTagToKey || {};
    const key = map[tag];
    if (!key) { window.closeCompModal(modalId); return; }
    let data = null;
    if (tag === 'hero' || tag === 'call-to-action') {
      const g = id => document.getElementById(id)?.value?.trim() ?? '';
      const variant = g('cm-' + tag + '-variant');
      const tagline = g('cm-' + tag + '-tagline');
      const heading = g('cm-' + tag + '-heading');
      const subtitle = g('cm-' + tag + '-subtitle');
      const pcLabel = g('cm-' + tag + '-pc-label');
      const pcHref = g('cm-' + tag + '-pc-href');
      const scLabel = g('cm-' + tag + '-sc-label');
      const scHref = g('cm-' + tag + '-sc-href');
      data = { variant };
      if (tagline) data.tagline = tagline;
      if (heading) data.heading = heading;
      if (subtitle) data.subtitle = subtitle;
      data.primaryCta = { label: pcLabel, href: pcHref };
      if (scLabel || scHref) data.secondaryCta = { label: scLabel, href: scHref };
    } else if (tag === 'feature-grid' || tag === 'showcase-grid') {
      const g = id => document.getElementById(id)?.value?.trim() ?? '';
      data = {
        heading: g('cm-' + tag + '-heading'),
        subtitle: g('cm-' + tag + '-subtitle') || undefined,
        items: (window.__cgItems?.[tag] ?? []),
      };
    } else if (tag === 'stats-bar') {
      data = { stats: window.__statItems ?? [] };
    } else if (tag === 'skill-cards') {
      data = window.__skillItems ?? [];
    } else {
      const yamlEl = document.getElementById('cm-' + tag + '-yaml');
      if (yamlEl?.value?.trim()) {
        try { data = jsyaml.load(yamlEl.value); } catch(e) { alert('Invalid YAML: ' + e.message); return; }
      }
    }
    window.__compData = window.__compData || {};
    window.__compData[key] = data;
    window.closeCompModal(modalId);
    const summaryEl = document.querySelector('[data-modal="modal-' + tag + '"]')?.closest('div')?.querySelector('p.text-xs.text-gray-500')
      || document.querySelector('[onclick="openCompModal(\\'modal-' + tag + '\\')"]')?.closest('div')?.querySelector('p.text-xs.text-gray-500');
    if (summaryEl) summaryEl.textContent = data ? '(updated — save to persist)' : 'Not configured';
  };

  // ---- Card Grid item editor ------------------------------------------------
  const CARD_COLORS = ['indigo','violet','sky','emerald','rose','amber','orange','pink'];
  function cgItemHTML(tag, item, idx) {
    return \`<div class="border border-gray-700 rounded-lg p-2 flex flex-col gap-1.5" data-idx="\${idx}">
  <div class="flex items-center gap-1">
    <span class="text-xs text-gray-500">#\${idx+1}</span>
    <button onclick="removeGridItem('\${tag}',\${idx})" class="ml-auto text-xs text-red-400 hover:text-red-300">✕</button>
  </div>
  <div class="grid grid-cols-2 gap-1.5">
    <input placeholder="Icon (emoji)" value="\${item.icon||''}" oninput="updateGridItem('\${tag}',\${idx},'icon',this.value)"
      class="bg-gray-900 border border-gray-700 text-white rounded px-1.5 py-1 text-xs" />
    <select oninput="updateGridItem('\${tag}',\${idx},'color',this.value)"
      class="bg-gray-900 border border-gray-700 text-white rounded px-1.5 py-1 text-xs">
      \${CARD_COLORS.map(c=>\`<option value="\${c}" \${item.color===c?'selected':''}>\${c}</option>\`).join('')}
    </select>
  </div>
  <input placeholder="Title" value="\${item.title||''}" oninput="updateGridItem('\${tag}',\${idx},'title',this.value)"
    class="bg-gray-900 border border-gray-700 text-white rounded px-1.5 py-1 text-xs w-full" />
  <textarea placeholder="Description" oninput="updateGridItem('\${tag}',\${idx},'description',this.value)"
    rows="2" class="bg-gray-900 border border-gray-700 text-white rounded px-1.5 py-1 text-xs w-full resize-none">\${item.description||''}</textarea>
  <input placeholder="Link URL (optional)" value="\${item.href||''}" oninput="updateGridItem('\${tag}',\${idx},'href',this.value)"
    class="bg-gray-900 border border-gray-700 text-white rounded px-1.5 py-1 text-xs w-full" />
</div>\`;
  }
  function renderGridItems(tag) {
    const container = document.getElementById('cg-items-' + tag);
    if (!container) return;
    container.innerHTML = (window.__cgItems?.[tag] ?? []).map((item, idx) => cgItemHTML(tag, item, idx)).join('');
  }
  window.renderGridItems = renderGridItems;
  window.addGridItem = function(tag) {
    window.__cgItems = window.__cgItems || {};
    window.__cgItems[tag] = window.__cgItems[tag] || [];
    window.__cgItems[tag].push({ icon: '⭐', title: 'New Card', description: '', color: 'indigo' });
    renderGridItems(tag);
  };
  window.removeGridItem = function(tag, idx) { window.__cgItems?.[tag]?.splice(idx, 1); renderGridItems(tag); };
  window.updateGridItem = function(tag, idx, field, value) {
    if (window.__cgItems?.[tag]?.[idx]) window.__cgItems[tag][idx][field] = value;
  };

  // ---- Stats Bar editor -----------------------------------------------------
  function statItemHTML(item, idx) {
    return \`<div class="border border-gray-700 rounded-lg p-2 flex gap-2 items-center">
  <input placeholder="Value" value="\${item.value||''}" oninput="updateStatItem(\${idx},'value',this.value)"
    class="bg-gray-900 border border-gray-700 text-white rounded px-1.5 py-1 text-xs w-20" />
  <input placeholder="Label" value="\${item.label||''}" oninput="updateStatItem(\${idx},'label',this.value)"
    class="bg-gray-900 border border-gray-700 text-white rounded px-1.5 py-1 text-xs flex-1" />
  <input placeholder="Color" value="\${item.color||''}" oninput="updateStatItem(\${idx},'color',this.value)"
    class="bg-gray-900 border border-gray-700 text-white rounded px-1.5 py-1 text-xs w-20" />
  <button onclick="removeStatItem(\${idx})" class="text-xs text-red-400 hover:text-red-300">✕</button>
</div>\`;
  }
  function renderStatItems() {
    const container = document.getElementById('stat-items');
    if (!container) return;
    container.innerHTML = (window.__statItems || []).map((item, idx) => statItemHTML(item, idx)).join('');
  }
  window.renderStatItems = renderStatItems;
  window.addStatItem = function() {
    window.__statItems = window.__statItems || [];
    window.__statItems.push({ value: '100+', label: 'New Stat', color: 'indigo' });
    renderStatItems();
  };
  window.removeStatItem = function(idx) { window.__statItems?.splice(idx, 1); renderStatItems(); };
  window.updateStatItem = function(idx, field, value) {
    if (window.__statItems?.[idx]) window.__statItems[idx][field] = value;
  };

  // ---- Skill Cards editor ---------------------------------------------------
  function skillItemHTML(item, idx) {
    return \`<div class="border border-gray-700 rounded-lg p-2 flex flex-col gap-1.5">
  <div class="flex items-center gap-1">
    <span class="text-xs text-gray-500">#\${idx+1}</span>
    <button onclick="removeSkillItem(\${idx})" class="ml-auto text-xs text-red-400">✕</button>
  </div>
  <div class="grid grid-cols-2 gap-1.5">
    <input placeholder="Icon (emoji)" value="\${item.icon||''}" oninput="updateSkillItem(\${idx},'icon',this.value)"
      class="bg-gray-900 border border-gray-700 text-white rounded px-1.5 py-1 text-xs" />
    <input placeholder="Color" value="\${item.color||''}" oninput="updateSkillItem(\${idx},'color',this.value)"
      class="bg-gray-900 border border-gray-700 text-white rounded px-1.5 py-1 text-xs" />
  </div>
  <input placeholder="Name" value="\${item.name||''}" oninput="updateSkillItem(\${idx},'name',this.value)"
    class="bg-gray-900 border border-gray-700 text-white rounded px-1.5 py-1 text-xs w-full" />
  <textarea placeholder="Description" oninput="updateSkillItem(\${idx},'description',this.value)"
    rows="2" class="bg-gray-900 border border-gray-700 text-white rounded px-1.5 py-1 text-xs w-full resize-none">\${item.description||''}</textarea>
  <input placeholder="Tags (comma-separated)" value="\${(item.tags||[]).join(', ')}"
    oninput="updateSkillItem(\${idx},'tags',this.value.split(',').map(s=>s.trim()).filter(Boolean))"
    class="bg-gray-900 border border-gray-700 text-white rounded px-1.5 py-1 text-xs w-full" />
</div>\`;
  }
  function renderSkillItems() {
    const container = document.getElementById('skill-items');
    if (!container) return;
    container.innerHTML = (window.__skillItems || []).map((item, idx) => skillItemHTML(item, idx)).join('');
  }
  window.renderSkillItems = renderSkillItems;
  window.addSkillItem = function() {
    window.__skillItems = window.__skillItems || [];
    window.__skillItems.push({ name: 'New Skill', icon: '✨', description: '', tags: [], color: 'indigo' });
    renderSkillItems();
  };
  window.removeSkillItem = function(idx) { window.__skillItems?.splice(idx, 1); renderSkillItems(); };
  window.updateSkillItem = function(idx, field, value) {
    if (window.__skillItems?.[idx]) window.__skillItems[idx][field] = value;
  };
  </script>

</body>
</html>`;
}

/** Partial shell used by HTMX swaps (no outer HTML/head/body). */
export function partial(body: string): string {
  return body;
}

// ---- private ----------------------------------------------------------------

const navSections = [
  { id: 'pages',      label: 'Pages',      icon: '📄' },
  { id: 'products',   label: 'Products',   icon: '🛍️' },
  { id: 'components', label: 'Components', icon: '🧩' },
  { id: 'media',      label: 'Media',      icon: '🖼️' },
  { id: 'build',      label: 'Build',      icon: '🔨' },
  { id: 'env',        label: 'Env',        icon: '🔑' },
  { id: 'themes',     label: 'Themes',     icon: '🎨' },
] as const;

export function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
