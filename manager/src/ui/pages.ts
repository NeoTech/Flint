/**
 * UI: Pages — content tree sidebar + structured Markdown editor.
 *
 * Features:
 *   - File tree with drag-and-drop reordering (SortableJS)
 *   - Structured frontmatter form for standard fields
 *   - Collapsible "Advanced" YAML block for unknown fields
 *   - Body textarea with Edit / Preview tab toggle (marked.js)
 */
import { shell, escHtml } from './shell.js';
import { getSite, resolveSitePath } from '../registry.js';
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, extname, relative } from 'path';
import matter from 'gray-matter';
import { getComponentDefs, getTemplateTags, type ComponentDef } from '../lib/component-scanner.js';

const STANDARD_FIELDS = [
  'Title', 'Short-URI', 'Template', 'Type', 'Category', 'Parent',
  'Order', 'Description', 'Author', 'Date', 'Keywords', 'Labels', 'Image',
];

const TEMPLATES_DEFAULT = ['default', 'blank', 'landing', 'blog-post', 'product-detail', 'shop'];
interface TemplateOption { name: string; theme: string; }

function templateSelectHtml(options: TemplateOption[], currentValue: string, selectId: string, onChange?: string): string {
  // Group by theme
  const groups = new Map<string, string[]>();
  for (const { name, theme } of options) {
    if (!groups.has(theme)) groups.set(theme, []);
    groups.get(theme)!.push(name);
  }
  const changeAttr = onChange ? ` onchange="${onChange}"` : '';
  let opts = '';
  for (const [theme, names] of groups) {
    if (groups.size > 1) opts += `<optgroup label="${escHtml(theme)}">\n`;
    for (const n of names) {
      opts += `<option value="${escHtml(n)}" ${currentValue === n ? 'selected' : ''}>${escHtml(n)}</option>\n`;
    }
    if (groups.size > 1) opts += `</optgroup>\n`;
  }
  return `<select id="${selectId}"${changeAttr} class="${INPUT_CLASS}">${opts}</select>`;
}
const TYPES = ['page', 'post', 'product', 'index'];
const INPUT_CLASS = 'w-full bg-gray-950 border border-gray-700 text-white rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500';

interface PageNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: PageNode[];
}

function fmField(label: string, type: string, value: string, placeholder: string): string {
  return `
<div>
  <label class="block text-xs font-medium text-gray-400 mb-1">${escHtml(label)}</label>
  <input type="${type}" id="fm-${escHtml(label)}" value="${value}" placeholder="${escHtml(placeholder)}"
         autocomplete="off" class="${INPUT_CLASS}" />
</div>`;
}

interface ParentOption { slug: string; title: string; }

function getParentOptions(sitePath: string, excludeRelPath?: string): ParentOption[] {
  const contentDir = join(sitePath, 'content');
  if (!existsSync(contentDir)) return [];
  const options: ParentOption[] = [];
  function scan(dir: string) {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }
    for (const entry of entries) {
      const abs = join(dir, entry);
      let s;
      try { s = statSync(abs); } catch { continue; }
      if (s.isDirectory()) { scan(abs); continue; }
      if (extname(entry) !== '.md') continue;
      const rel = relative(contentDir, abs).replace(/\\/g, '/');
      if (excludeRelPath && rel === excludeRelPath) continue;
      try {
        const { data } = matter(readFileSync(abs, 'utf-8'));
        const slug = String(data['Short-URI'] ?? data['short-uri'] ?? '').trim();
        const title = String(data['Title'] ?? data['title'] ?? entry.replace(/\.md$/, '')).trim();
        if (slug) options.push({ slug, title });
      } catch { /* skip unreadable */ }
    }
  }
  scan(contentDir);
  return options.sort((a, b) => a.title.localeCompare(b.title));
}

function fmParentSelect(currentValue: string, options: ParentOption[]): string {
  const cur = currentValue || 'root';
  const opts = [
    `<option value="root" ${cur === 'root' ? 'selected' : ''}>root — top level</option>`,
    ...options.map(o =>
      `<option value="${escHtml(o.slug)}" ${cur === o.slug ? 'selected' : ''}>${escHtml(o.title)} (${escHtml(o.slug)})</option>`
    ),
  ].join('');
  return `<div>
  <label class="block text-xs font-medium text-gray-400 mb-1">Parent</label>
  <select id="fm-Parent" class="${INPUT_CLASS}">${opts}</select>
</div>`;
}

function fmMediaField(siteId: string, items: string[]): string {
  const rows = items.map((src, i) => `
<div class="flex gap-1.5 items-center" id="fm-image-row-${i}">
  <input type="text" id="fm-image-${i}" value="${escHtml(src)}"
         placeholder="/static/images/photo.jpg"
         class="flex-1 min-w-0 fm-image-input ${INPUT_CLASS}"
         oninput="refreshImagePreview(${i}, this.value)" />
  <button type="button" onclick="openPageMediaPicker('${escHtml(siteId)}', ${i})"
    class="shrink-0 text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded-md transition-colors">
    Pick
  </button>
  <button type="button" onclick="removeImageRow(${i})"
    class="shrink-0 text-xs text-red-500 hover:text-red-300 px-1 transition-colors">✕</button>
</div>
<div id="fm-image-preview-${i}" class="${src ? '' : 'hidden'} pl-0 mt-0.5 mb-1">
  ${src ? `<img src="${escHtml(src)}" class="max-h-14 rounded border border-gray-700 object-contain" onerror="this.parentElement.classList.add('hidden')" />` : ''}
</div>`).join('');

  return `
<div>
  <div class="flex items-center justify-between mb-1">
    <label class="text-xs font-medium text-gray-400">Images</label>
    <button type="button" onclick="addImageRow('${escHtml(siteId)}')"
      class="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">+ Add</button>
  </div>
  <div id="fm-image-list" class="flex flex-col gap-1">
    ${rows || '<p class="text-xs text-gray-600 italic">No images — click + Add</p>'}
  </div>
  <input type="hidden" id="fm-image-count" value="${items.length}" />
</div>`;
}

// Optional fields that can be shown/hidden by the user
const OPTIONAL_FM = ['Category','Parent','Order','Author','Date','Keywords','Labels','Description','Image'] as const;

function fmOptField(name: string, inner: string, active: boolean): string {
  return `<div id="fm-opt-${name}" data-fm-opt="${name}"${active ? '' : ' class="hidden"'}>
  <div class="flex items-start gap-1">
    <div class="flex-1 min-w-0">${inner}</div>
    <button type="button" onclick="hideFmField('${name}')" title="Remove field"
      class="mt-5 text-gray-600 hover:text-red-400 text-xs leading-none shrink-0 transition-colors px-0.5">✕</button>
  </div>
</div>`;
}

function getAvailableTemplates(sitePath: string): TemplateOption[] {
  let activeTheme = 'default';
  const envPath = join(sitePath, '.env');
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const l of lines) {
      if (l.trim().startsWith('THEME=')) { activeTheme = l.trim().slice(6).trim() || 'default'; break; }
    }
  }

  const seen = new Set<string>();
  const result: TemplateOption[] = [];
  const addFromDir = (dir: string, theme: string) => {
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir).filter(f => extname(f) === '.html').sort()) {
      const name = f.replace('.html', '');
      if (!seen.has(name)) { seen.add(name); result.push({ name, theme }); }
    }
  };

  addFromDir(join(sitePath, 'themes', activeTheme, 'templates'), activeTheme);
  const themesDir = join(sitePath, 'themes');
  if (existsSync(themesDir)) {
    for (const theme of readdirSync(themesDir).sort()) {
      if (theme !== activeTheme) addFromDir(join(themesDir, theme, 'templates'), theme);
    }
  }
  addFromDir(join(sitePath, 'templates'), 'templates');

  return result.length ? result : TEMPLATES_DEFAULT.map(name => ({ name, theme: 'default' }));
}

export function renderPages(siteId: string, openPath?: string, htmx = false): string {
  const site = getSite(siteId);
  if (!site) return shell({ title: 'Not Found', body: `<p class="text-red-400">Site not found: ${escHtml(siteId)}</p>` });

  const contentDir = join(resolveSitePath(site), 'content');
  const tree = existsSync(contentDir) ? buildTree(contentDir, contentDir) : [];

  const editorHtml = openPath
    ? renderEditorPane(siteId, openPath)
    : `<div class="flex flex-col items-center justify-center h-full text-gray-500 gap-3 rounded-xl border border-gray-800 bg-gray-900">
         <span class="text-5xl">📄</span>
         <p class="text-base">Select a page from the tree to edit it</p>
         <p class="text-xs">Drag files within a folder to change their Order</p>
       </div>`;

  const body = `
<div class="flex gap-4" style="height:calc(100vh - 7rem)">
  <!-- Tree sidebar -->
  <div class="w-60 shrink-0 flex flex-col bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
    <div class="flex items-center justify-between px-3 py-2.5 border-b border-gray-800">
      <span class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Content</span>
      <button onclick="showNewPage('${escHtml(siteId)}')"
        class="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded-md transition-colors">+ New</button>
    </div>
    <div class="flex-1 overflow-y-auto py-1" id="page-tree">
      ${renderTree(tree, siteId, openPath)}
    </div>
  </div>
  <!-- Editor pane -->
  <div class="flex-1 min-w-0 overflow-hidden" id="editor-pane">
    ${editorHtml}
  </div>
</div>

<script>
function showNewPage(siteId) {
  // Pre-populate path with the folder of the currently active page
  const activePath = document.querySelector('[data-page-link].bg-indigo-800')?.getAttribute('data-page-link') ?? '';
  const folder = activePath.includes('/') ? activePath.split('/').slice(0, -1).join('/') + '/' : '';
  fetch('/sites/' + siteId + '/pages/new', { headers: { 'HX-Request': 'true' } })
    .then(r => r.text()).then(html => {
      setEditorPane(html);
      if (folder) {
        const pathInput = document.getElementById('new-path');
        if (pathInput && !pathInput.value) pathInput.value = folder;
      }
    });
}
function loadPage(e, siteId, path) {
  e.preventDefault();
  fetch('/sites/' + siteId + '/pages/' + path, { headers: { 'HX-Request': 'true' } })
    .then(r => r.text()).then(html => {
      setEditorPane(html);
      document.querySelectorAll('[data-page-link]').forEach(el => {
        const active = el.getAttribute('data-page-link') === path;
        el.classList.toggle('bg-indigo-800', active);
        el.classList.toggle('text-white', active);
        el.classList.toggle('text-gray-300', !active);
      });
    });
}
function initTreeSortable() {
  document.querySelectorAll('[data-sortable]').forEach(container => {
    if (container._sortable) { container._sortable.destroy(); }
    container._sortable = Sortable.create(container, {
      handle: '[data-drag-handle]',
      animation: 150,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      onEnd() {
        const sid = container.getAttribute('data-site');
        const items = [...container.querySelectorAll('[data-path]')].map((el, i) => ({
          path: el.getAttribute('data-path'), order: i + 1,
        }));
        fetch('/sites/' + sid + '/pages/reorder', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        });
      },
    });
  });
}
initTreeSortable();
</script>`;

  return htmx ? body : shell({ title: 'Pages — Flint Manager', siteId, activeSection: 'pages', body });
}

// ---- Component-aware editor helpers -----------------------------------------

/** Return component defs that are relevant to this page's template. */
function getCompDefsForPage(sitePath: string, frontmatter: Record<string, unknown>): ComponentDef[] {
  const templateVal = Object.entries(frontmatter).find(([k]) => k.toLowerCase() === 'template')?.[1];
  const templateName = typeof templateVal === 'string' ? templateVal : 'default';
  try {
    const tags = getTemplateTags(sitePath, templateName);
    if (!tags.length) return [];
    const defs = getComponentDefs(sitePath);
    return defs.filter(d => tags.includes(d.tag));
  } catch {
    return [];
  }
}

const MC = 'w-full bg-gray-900 border border-gray-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-500';

function cmInput(id: string, label: string, val: string, placeholder = ''): string {
  return `<div><label class="block text-xs text-gray-400 mb-0.5">${escHtml(label)}</label>
<input id="${id}" class="${MC}" value="${escHtml(val)}" placeholder="${escHtml(placeholder)}" /></div>`;
}
function cmTA(id: string, label: string, val: string, rows = 2): string {
  return `<div><label class="block text-xs text-gray-400 mb-0.5">${escHtml(label)}</label>
<textarea id="${id}" rows="${rows}" class="${MC} resize-y">${escHtml(val)}</textarea></div>`;
}
function cmSelect(id: string, label: string, opts: string[], cur: string): string {
  const options = opts.map(o => `<option value="${escHtml(o)}" ${cur === o ? 'selected' : ''}>${escHtml(o)}</option>`).join('');
  return `<div><label class="block text-xs text-gray-400 mb-0.5">${escHtml(label)}</label>
<select id="${id}" class="${MC}">${options}</select></div>`;
}

function modalShell(id: string, title: string, icon: string, body: string, tag: string): string {
  return `
<div id="${id}" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/70">
  <div class="bg-gray-850 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
       style="background:#1a1f2e">
    <div class="flex items-center justify-between px-5 py-3.5 border-b border-gray-700 shrink-0">
      <span class="font-semibold text-white text-sm">${icon} ${escHtml(title)}</span>
      <div class="flex gap-2">
        <button onclick="clearComp('${tag}')"
          class="text-xs text-gray-400 hover:text-red-400 px-2 py-1 rounded hover:bg-gray-800 transition-colors">Clear</button>
        <button onclick="closeCompModal('${id}')"
          class="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors">Cancel</button>
        <button onclick="saveCompModal('${id}','${tag}')"
          class="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded font-medium transition-colors">Save</button>
      </div>
    </div>
    <div class="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-3">
      ${body}
    </div>
  </div>
</div>`;
}

const CTA_VARIANTS = ['primary', 'secondary', 'minimal', 'dark', 'light'];

function renderCtaModalHtml(tag: string, data: Record<string, unknown>): string {
  const d = data as Record<string, string | Record<string, string>>;
  const pc = (d.primaryCta ?? {}) as Record<string, string>;
  const sc = (d.secondaryCta ?? {}) as Record<string, string>;
  const body = [
    cmSelect(`cm-${tag}-variant`, 'Variant', CTA_VARIANTS, (d.variant as string) ?? 'primary'),
    cmInput(`cm-${tag}-tagline`, 'Tagline (small text above heading)', (d.tagline as string) ?? ''),
    cmInput(`cm-${tag}-heading`, 'Heading *', (d.heading as string) ?? ''),
    cmTA(`cm-${tag}-subtitle`, 'Subtitle', (d.subtitle as string) ?? ''),
    `<div class="border-t border-gray-700 pt-2"><p class="text-xs font-medium text-gray-400 mb-2">Primary CTA</p>
      <div class="grid grid-cols-2 gap-2">
        ${cmInput(`cm-${tag}-pc-label`, 'Label', pc.label ?? '')}
        ${cmInput(`cm-${tag}-pc-href`, 'URL', pc.href ?? '')}
      </div></div>`,
    `<div><p class="text-xs font-medium text-gray-400 mb-2">Secondary CTA (optional)</p>
      <div class="grid grid-cols-2 gap-2">
        ${cmInput(`cm-${tag}-sc-label`, 'Label', sc.label ?? '')}
        ${cmInput(`cm-${tag}-sc-href`, 'URL', sc.href ?? '')}
      </div></div>`,
  ].join('');
  return modalShell(`modal-${tag}`, tag === 'hero' ? 'Hero Section' : 'Call to Action', '🎯', body, tag);
}

function renderCardGridModalHtml(tag: string, data: Record<string, unknown>): string {
  const d = data as Record<string, unknown>;
  const itemsJson = JSON.stringify((d.items ?? []) as unknown[]);
  const body = `
${cmInput(`cm-${tag}-heading`, 'Heading *', (d.heading as string) ?? '')}
${cmTA(`cm-${tag}-subtitle`, 'Subtitle', (d.subtitle as string) ?? '')}
<div class="border-t border-gray-700 pt-2">
  <div class="flex items-center justify-between mb-2">
    <p class="text-xs font-medium text-gray-400">Cards</p>
    <button onclick="addGridItem('${tag}')"
      class="text-xs bg-indigo-700 hover:bg-indigo-600 text-white px-2 py-0.5 rounded">+ Add Card</button>
  </div>
  <div id="cg-items-${tag}" class="flex flex-col gap-2"></div>
</div>
<script>
(function(){
  const tag='${tag}';
  window.__cgItems=window.__cgItems||{};
  window.__cgItems[tag]=${itemsJson};
  setTimeout(() => { if (window.renderGridItems) window.renderGridItems(tag); }, 0);
})();
</script>`;
  return modalShell(`modal-${tag}`, tag === 'feature-grid' ? 'Feature Grid' : 'Showcase Grid', '🃏', body, tag);
}

function renderStatsBarModalHtml(tag: string, data: Record<string, unknown>): string {
  const statsJson = JSON.stringify((data.stats ?? []) as unknown[]);
  const body = `
<div class="flex items-center justify-between mb-2">
  <p class="text-xs font-medium text-gray-400">Stats</p>
  <button onclick="addStatItem()"
    class="text-xs bg-indigo-700 hover:bg-indigo-600 text-white px-2 py-0.5 rounded">+ Add Stat</button>
</div>
<div id="stat-items" class="flex flex-col gap-2"></div>
<script>
window.__statItems=${statsJson};
setTimeout(() => { if (window.renderStatItems) window.renderStatItems(); }, 0);
</script>`;
  return modalShell(`modal-${tag}`, 'Stats Bar', '📊', body, tag);
}

function renderSkillCardsModalHtml(tag: string, data: unknown): string {
  const skillsJson = JSON.stringify(Array.isArray(data) ? data : []);
  const body = `
<div class="flex items-center justify-between mb-2">
  <p class="text-xs font-medium text-gray-400">Skills / Cards</p>
  <button onclick="addSkillItem()"
    class="text-xs bg-indigo-700 hover:bg-indigo-600 text-white px-2 py-0.5 rounded">+ Add Card</button>
</div>
<div id="skill-items" class="flex flex-col gap-2"></div>
<script>
window.__skillItems=${skillsJson};
setTimeout(() => { if (window.renderSkillItems) window.renderSkillItems(); }, 0);
</script>`;
  return modalShell(`modal-${tag}`, 'Skill Cards', '🧩', body, tag);
}

function renderYamlModalHtml(def: ComponentDef, rawYaml: string): string {
  const body = `
<p class="text-xs text-gray-400">Edit the raw YAML for this component. Key: <code class="text-indigo-400">${escHtml(def.frontmatterKey)}</code></p>
<textarea id="cm-${def.tag}-yaml" rows="12" spellcheck="false"
  class="${MC} font-mono text-xs resize-y">${escHtml(rawYaml)}</textarea>`;
  return modalShell(`modal-${def.tag}`, def.label, def.icon, body, def.tag);
}

function compSummaryText(def: ComponentDef, data: unknown): string {
  if (!data) return '<span class="text-gray-600 italic">Not configured</span>';
  try {
    if (def.editorType === 'cta') {
      const d = data as Record<string, unknown>;
      return escHtml((d.heading as string) ?? '(no heading)');
    }
    if (def.editorType === 'card-grid') {
      const d = data as Record<string, unknown>;
      const items = Array.isArray(d.items) ? d.items.length : 0;
      return `${escHtml((d.heading as string) ?? '')} <span class="text-gray-500">${items} card${items !== 1 ? 's' : ''}</span>`;
    }
    if (def.editorType === 'stats-bar') {
      const d = data as Record<string, unknown>;
      const count = Array.isArray(d.stats) ? d.stats.length : 0;
      return `${count} stat${count !== 1 ? 's' : ''}`;
    }
    if (def.editorType === 'skill-cards') {
      const count = Array.isArray(data) ? data.length : 0;
      return `${count} card${count !== 1 ? 's' : ''}`;
    }
  } catch { /* ignore */ }
  return '<span class="text-gray-400">Configured</span>';
}

function renderCompSection(defs: ComponentDef[], compData: Record<string, unknown>): string {
  if (!defs.length) return '';
  const cards = defs.map(def => {
    const data = compData[def.frontmatterKey];
    const summary = compSummaryText(def, data);
    const configured = data != null;
    return `
<div class="flex items-start justify-between gap-2 bg-gray-800/50 rounded-lg px-2.5 py-2 border ${configured ? 'border-indigo-800/60' : 'border-gray-700/60'}">
  <div class="min-w-0 flex-1">
    <div class="flex items-center gap-1.5 mb-0.5">
      <span class="text-sm">${def.icon}</span>
      <span class="text-xs font-medium text-gray-200 truncate">${escHtml(def.label)}</span>
      ${configured ? '<span class="text-xs text-indigo-400">●</span>' : ''}
    </div>
    <p class="text-xs text-gray-500 truncate">${summary}</p>
  </div>
  <button onclick="openCompModal('modal-${def.tag}')"
    class="shrink-0 text-xs bg-indigo-700/60 hover:bg-indigo-600 text-white px-2 py-0.5 rounded transition-colors">Edit →</button>
</div>`;
  }).join('');
  return `
<div class="border-t border-gray-800 pt-2 mt-1">
  <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Components</p>
  <div class="flex flex-col gap-1.5">${cards}</div>
</div>`;
}

function renderCompModals(defs: ComponentDef[], compData: Record<string, unknown>): string {
  return defs.map(def => {
    const raw = compData[def.frontmatterKey];
    const data = (raw != null ? raw : {}) as Record<string, unknown>;
    switch (def.editorType) {
      case 'cta': return renderCtaModalHtml(def.tag, data);
      case 'card-grid': return renderCardGridModalHtml(def.tag, data);
      case 'stats-bar': return renderStatsBarModalHtml(def.tag, data);
      case 'skill-cards': return renderSkillCardsModalHtml(def.tag, raw);
      default: {
        const yaml = Object.entries(data).map(([k, v]) =>
          typeof v === 'object' ? `${k}:\n${JSON.stringify(v, null, 2).split('\n').map(l => '  ' + l).join('\n')}` : `${k}: ${v}`
        ).join('\n');
        return renderYamlModalHtml(def, yaml);
      }
    }
  }).join('');
}

export function renderEditorPane(siteId: string, pagePath: string, basePath?: string): string {
  const site = getSite(siteId);
  if (!site && !basePath) return '<p class="text-red-400">Site not found</p>';
  const sitePath = basePath ?? resolveSitePath(site!);

  const safe = pagePath.replace(/\.\./g, '').replace(/^\/+/, '');
  const abs = join(sitePath, 'content', safe);
  const isNew = !existsSync(abs);

  let frontmatter: Record<string, unknown> = {};
  let bodyContent = '';

  if (!isNew) {
    const raw = readFileSync(abs, 'utf-8');
    const parsed = matter(raw);
    frontmatter = parsed.data as Record<string, unknown>;
    bodyContent = parsed.content.replace(/^\n/, '');
  }

  // Discover component defs for this page's template
  const compDefs = getCompDefsForPage(sitePath, frontmatter);
  const compKeys = new Set(compDefs.map(d => d.frontmatterKey.toLowerCase()));

  // Split frontmatter: standard, component, residual
  const stdLower = STANDARD_FIELDS.map(f => f.toLowerCase());
  const compData: Record<string, unknown> = {};
  const residual: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(frontmatter)) {
    if (compKeys.has(k.toLowerCase())) {
      // find the def to get the canonical key
      const def = compDefs.find(d => d.frontmatterKey.toLowerCase() === k.toLowerCase());
      compData[def ? def.frontmatterKey : k] = v;
    } else if (!stdLower.includes(k.toLowerCase())) {
      residual[k] = v;
    }
  }

  // Also backfill compData keys so modals open even for unconfigured components
  for (const def of compDefs) {
    if (!(def.frontmatterKey in compData)) compData[def.frontmatterKey] = null as unknown;
  }

  const residualYaml = Object.entries(residual).map(([k, v]) =>
    typeof v === 'object' ? `${k}:\n${JSON.stringify(v, null, 2).split('\n').map(l => '  ' + l).join('\n')}` : `${k}: ${v}`
  ).join('\n');

  const templates = getAvailableTemplates(sitePath);
  const parentOptions = getParentOptions(sitePath, safe);

  const fval = (key: string): string => {
    const found = Object.entries(frontmatter).find(([k]) => k.toLowerCase() === key.toLowerCase());
    return found ? escHtml(String(found[1] ?? '')) : '';
  };
  const fvalDate = (key: string): string => {
    const found = Object.entries(frontmatter).find(([k]) => k.toLowerCase() === key.toLowerCase());
    if (!found) return '';
    const v = found[1];
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const s = String(v ?? '').trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  };
  const labelsVal = (() => {
    const found = Object.entries(frontmatter).find(([k]) => k.toLowerCase() === 'labels');
    if (!found) return '';
    const v = found[1];
    return escHtml(Array.isArray(v) ? (v as string[]).join(', ') : String(v ?? ''));
  })();

  // Normalise Image frontmatter → string[]
  const imageItems = (() => {
    const found = Object.entries(frontmatter).find(([k]) => k.toLowerCase() === 'image');
    if (!found) return [];
    const v = found[1];
    if (typeof v === 'string') return v ? [v] : [];
    if (Array.isArray(v)) return (v as unknown[]).map(i =>
      typeof i === 'string' ? i : (typeof i === 'object' && i !== null && typeof (i as Record<string,unknown>).src === 'string' ? (i as Record<string,unknown>).src as string : '')
    ).filter(Boolean);
    if (typeof v === 'object' && v !== null && typeof (v as Record<string,unknown>).src === 'string') return [(v as Record<string,unknown>).src as string];
    return [];
  })();

  // Which optional fields have value → shown by default
  const activeOptionals = new Set(
    OPTIONAL_FM.filter(f => {
      const found = Object.entries(frontmatter).find(([k]) => k.toLowerCase() === f.toLowerCase());
      if (!found) return false;
      const v = found[1];
      if (Array.isArray(v)) return v.length > 0;
      return v != null && String(v).trim() !== '';
    })
  );

  // Template tags for the content toolbar — removed (tags are template-level, not content-level)
  // const templateTags = ...

  // Serialize compData + compDefs for JS init
  const compDataJson = JSON.stringify(compData);
  const compDefsJson = JSON.stringify(
    compDefs.map(d => ({ tag: d.tag, label: d.label, icon: d.icon, frontmatterKey: d.frontmatterKey }))
  );

  return `
<div class="flex flex-col h-full bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">

  <!-- Tab bar + actions -->
  <div class="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 shrink-0">
    <div class="flex items-center gap-1">
      <button id="tab-edit" onclick="switchTab('edit')"
        class="px-3 py-1 text-xs rounded-md bg-indigo-600 text-white font-medium">Edit</button>
      <button id="tab-preview" onclick="switchTab('preview')"
        class="px-3 py-1 text-xs rounded-md text-gray-400 hover:bg-gray-700 font-medium">Preview</button>
    </div>
    <span class="flex-1 px-4 text-xs text-gray-500 truncate">📄 ${escHtml(safe)}</span>
    <div class="flex gap-2 shrink-0">
      ${!isNew ? `<button onclick="deletePage('${escHtml(siteId)}','${escHtml(safe)}')"
        class="text-xs bg-gray-700 hover:bg-red-700 text-gray-300 hover:text-white px-3 py-1.5 rounded-md transition-colors">Delete</button>` : ''}
      <button onclick="savePage('${escHtml(siteId)}','${escHtml(safe)}',${isNew})"
        class="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-md font-medium transition-colors">Save</button>
    </div>
  </div>

  <!-- Edit tab -->
  <div id="pane-edit" class="flex flex-1 min-h-0 overflow-hidden">

    <!-- Frontmatter sidebar (resizable) -->
    <div id="fm-sidebar" class="shrink-0 border-r border-gray-800 overflow-y-auto"
         style="width:288px;min-width:180px;max-width:560px">
      <div class="p-3 flex flex-col gap-2.5">

        <!-- Header -->
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Frontmatter</p>
          <div class="relative">
            <button type="button" onclick="toggleAddField(event)"
              class="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">+ Add field</button>
            <div id="add-field-menu"
              class="hidden absolute right-0 top-6 z-30 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-1 min-w-max">
            </div>
          </div>
        </div>

        <!-- Core fields (always visible) -->
        ${fmField('Title', 'text', fval('title'), 'Page Title')}
        ${fmField('Short-URI', 'text', fval('short-uri'), 'my-slug')}
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1">Template</label>
          ${templateSelectHtml(templates, fval('template'), 'fm-Template', `templateChanged(this.value,'${escHtml(siteId)}','${escHtml(safe)}')`)}
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-400 mb-1">Type</label>
          <select id="fm-Type" class="${INPUT_CLASS}">
            ${TYPES.map(t => `<option value="${escHtml(t)}" ${fval('type') === t ? 'selected' : ''}>${escHtml(t)}</option>`).join('')}
          </select>
        </div>

        <!-- Optional fields -->
        ${fmOptField('Category', fmField('Category', 'text', fval('category'), 'Blog'), activeOptionals.has('Category'))}
        ${fmOptField('Parent', fmParentSelect(fval('parent'), parentOptions), activeOptionals.has('Parent'))}
        ${fmOptField('Order', fmField('Order', 'number', fval('order') || '999', '1'), activeOptionals.has('Order'))}
        ${fmOptField('Author', fmField('Author', 'text', fval('author'), ''), activeOptionals.has('Author'))}
        ${fmOptField('Date', fmField('Date', 'date', fvalDate('date'), ''), activeOptionals.has('Date'))}
        ${fmOptField('Keywords', fmField('Keywords', 'text', fval('keywords'), 'tag1, tag2'), activeOptionals.has('Keywords'))}
        ${fmOptField('Labels',
          `<div>
            <label class="block text-xs font-medium text-gray-400 mb-1">Labels</label>
            <input type="text" id="fm-Labels" value="${labelsVal}" placeholder="tag1, tag2" class="${INPUT_CLASS}" />
            <p class="text-xs text-gray-600 mt-0.5">Comma-separated</p>
          </div>`,
          activeOptionals.has('Labels'))}
        ${fmOptField('Description',
          `<div>
            <label class="block text-xs font-medium text-gray-400 mb-1">Description</label>
            <textarea id="fm-Description" rows="2" class="${INPUT_CLASS} resize-none">${fval('description')}</textarea>
          </div>`,
          activeOptionals.has('Description'))}
        ${fmOptField('Image', fmMediaField(siteId, imageItems), activeOptionals.has('Image'))}

        ${renderCompSection(compDefs, compData)}
        ${Object.keys(residual).length ? `
        <details open>
          <summary class="text-xs text-gray-500 cursor-pointer hover:text-gray-300 select-none">
            Extra fields (${Object.keys(residual).length})
          </summary>
          <div class="mt-1.5">
            <p class="text-xs text-gray-600 mb-1">Raw YAML for unknown fields</p>
            <textarea id="fm-advanced" rows="5" spellcheck="false"
              class="${INPUT_CLASS} font-mono text-xs resize-y">${escHtml(residualYaml)}</textarea>
          </div>
        </details>` : '<textarea id="fm-advanced" class="hidden"></textarea>'}
      </div>
    </div>

    <!-- Resize handle -->
    <div id="fm-resize-handle"
      class="w-1.5 shrink-0 cursor-col-resize bg-gray-800 hover:bg-indigo-600 active:bg-indigo-500 transition-colors"
      title="Drag to resize"></div>

    <!-- Body editor -->
    <div class="body-editor-wrap flex-1 flex flex-col min-w-0 overflow-hidden">

      <!-- Content toolbar -->
      <div class="flex items-center flex-wrap gap-1 px-3 pt-2 pb-2 border-b border-gray-800 shrink-0">
        <span class="text-xs text-gray-600 shrink-0">Flint:</span>
        <button type="button" onclick="insertBodySnippet(':::html\\n\\n:::')" title="HTML block"
          class="text-xs font-mono bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded px-1.5 py-0.5 transition-colors">:::html</button>
        <button type="button" onclick="insertBodyTag(':::children')" title="Children list"
          class="text-xs font-mono bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded px-1.5 py-0.5 transition-colors">:::children</button>
      </div>

      <textarea id="body-editor" spellcheck="true"
        class="hidden"
      >${escHtml(bodyContent)}</textarea>
    </div>
  </div>

  <!-- Preview tab -->
  <div id="pane-preview" class="hidden flex-1 overflow-y-auto p-6">
    <div id="preview-content" class="prose max-w-3xl mx-auto text-gray-200"></div>
  </div>

  <!-- Status bar -->
  <div class="px-4 py-1.5 border-t border-gray-800 flex items-center justify-between shrink-0">
    <span id="save-status" class="text-xs text-gray-600 h-4"></span>
    <span class="text-xs text-gray-700">Ctrl+S to save</span>
  </div>
</div>

// Component modals -->
${renderCompModals(compDefs, compData)}

<!-- Inline media picker modal for pages editor -->
<div id="page-media-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/70">
  <div class="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col" style="max-height:80vh">
    <div class="flex items-center justify-between px-5 py-3.5 border-b border-gray-700 shrink-0">
      <span class="font-semibold text-white text-sm">🖼️ Pick a file</span>
      <div class="flex gap-2">
        <a href="/sites/${escHtml(siteId)}/media" hx-get="/sites/${escHtml(siteId)}/media" hx-target="#content" hx-push-url="true"
           class="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded hover:bg-gray-800">
          Open Media Library ↗
        </a>
        <button onclick="document.getElementById('page-media-modal').classList.add('hidden')"
          class="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800">Cancel</button>
      </div>
    </div>
    <div class="p-3 border-b border-gray-700 shrink-0 flex gap-2">
      <input id="picker-search" type="text" placeholder="Search…"
        class="flex-1 bg-gray-800 border border-gray-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-500" />
      <label class="cursor-pointer bg-indigo-700 hover:bg-indigo-600 text-white text-xs px-3 py-1 rounded transition-colors">
        ⬆ Upload
        <input id="picker-file-input" type="file" multiple class="hidden" accept="image/*,.pdf,.zip,.mp4,.webm,.mp3" />
      </label>
    </div>
    <div class="p-4 overflow-y-auto flex-1">
      <div id="picker-grid" class="grid gap-2" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">
        <div class="text-xs text-gray-600 col-span-full text-center py-8">Loading…</div>
      </div>
    </div>
  </div>
</div>

<script>
// ---- Component data store ---------------------------------------------------
window.__compData = ${compDataJson};

// ---- Tab switching ----------------------------------------------------------
window.switchTab = function(tab) {
  const editPane = document.getElementById('pane-edit');
  const previewPane = document.getElementById('pane-preview');
  const editBtn = document.getElementById('tab-edit');
  const previewBtn = document.getElementById('tab-preview');
  if (tab === 'preview') {
    const md = window.__bodyEditor ? window.__bodyEditor.value() : (document.getElementById('body-editor')?.value ?? '');
    document.getElementById('preview-content').innerHTML = marked.parse(md);
    previewPane.classList.remove('hidden'); previewPane.classList.add('flex');
    editPane.classList.add('hidden');
    previewBtn.className = 'px-3 py-1 text-xs rounded-md bg-indigo-600 text-white font-medium';
    editBtn.className = 'px-3 py-1 text-xs rounded-md text-gray-400 hover:bg-gray-700 font-medium';
  } else {
    previewPane.classList.add('hidden'); previewPane.classList.remove('flex');
    editPane.classList.remove('hidden');
    editBtn.className = 'px-3 py-1 text-xs rounded-md bg-indigo-600 text-white font-medium';
    previewBtn.className = 'px-3 py-1 text-xs rounded-md text-gray-400 hover:bg-gray-700 font-medium';
    if (window.__bodyEditor) window.__bodyEditor.codemirror.refresh();
  }
};

// ---- EasyMDE body editor init ---------------------------------------------
(function() {
  // Destroy any previous EasyMDE instance (HTMX re-injection safety)
  if (window.__bodyEditor) {
    try { window.__bodyEditor.toTextArea(); } catch(e) {}
    window.__bodyEditor = null;
  }
  var ta = document.getElementById('body-editor');
  if (!ta || typeof EasyMDE === 'undefined') return;
  window.__bodyEditor = new EasyMDE({
    element: ta,
    autosave: { enabled: false },
    spellChecker: false,
    autoDownloadFontAwesome: true,
    lineWrapping: true,
    indentWithTabs: false,
    tabSize: 2,
    sideBySideFullscreen: false,
    minHeight: '300px',
    toolbar: [
      'bold', 'italic', 'heading', '|',
      'quote', 'unordered-list', 'ordered-list', '|',
      'link', 'image', 'table', 'code', '|',
      'preview', 'side-by-side', 'fullscreen', '|', 'guide'
    ],
    previewRender: function(plainText) {
      return (window.marked && window.marked.parse)
        ? window.marked.parse(plainText)
        : '<pre>' + plainText + '</pre>';
    },
  });
  // Ctrl+S shortcut
  var cmInstance = window.__bodyEditor.codemirror;
  cmInstance.setOption('extraKeys', {
    'Ctrl-S': function() {
      var btn = document.querySelector('[onclick*="savePage"]');
      if (btn) btn.click();
    },
    'Cmd-S': function() {
      var btn = document.querySelector('[onclick*="savePage"]');
      if (btn) btn.click();
    }
  });
})();

// ---- Resizable sidebar ------------------------------------------------------
(function() {
  const handle = document.getElementById('fm-resize-handle');
  const sidebar = document.getElementById('fm-sidebar');
  if (!handle || !sidebar) return;
  const saved = localStorage.getItem('fm-sidebar-width');
  if (saved) sidebar.style.width = saved + 'px';
  let dragging = false, startX = 0, startW = 0;
  handle.addEventListener('mousedown', e => {
    dragging = true; startX = e.clientX; startW = sidebar.offsetWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const w = Math.max(180, Math.min(560, startW + (e.clientX - startX)));
    sidebar.style.width = w + 'px';
  });
  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    localStorage.setItem('fm-sidebar-width', String(sidebar.offsetWidth));
  });
})();

// ---- Optional frontmatter field management ----------------------------------
window.showFmField = function(name) {
  const wrapper = document.getElementById('fm-opt-' + name);
  if (wrapper) {
    wrapper.classList.remove('hidden');
    wrapper.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    wrapper.querySelector('input,textarea,select')?.focus();
  }
  document.getElementById('add-field-menu')?.classList.add('hidden');
};

window.hideFmField = function(name) {
  const wrapper = document.getElementById('fm-opt-' + name);
  if (!wrapper) return;
  // Don't clear values — collectFrontmatter already skips hidden fields,
  // so if the user shows the field again its prior value is still there.
  wrapper.classList.add('hidden');
};

window.toggleAddField = function(e) {
  e?.stopPropagation();
  const menu = document.getElementById('add-field-menu');
  if (!menu) return;

  const allOpts = ['Category','Parent','Order','Author','Date','Keywords','Labels','Description','Image'];
  const hiddenFields = allOpts.filter(f => {
    const el = document.getElementById('fm-opt-' + f);
    return !el || el.classList.contains('hidden');
  });

  // Components in the current template that have a frontmatterKey
  const compItems = (window.__compDefs || []).filter(d => d.frontmatterKey);

  let html = '';

  if (hiddenFields.length) {
    html += '<p class="text-xs text-gray-600 px-3 pt-2 pb-1 font-semibold uppercase tracking-wide">Metadata</p>';
    html += hiddenFields.map(f =>
      \`<button type="button" onclick="showFmField('\${f}')"
        class="block w-full text-left text-xs text-gray-300 hover:text-white hover:bg-gray-700 px-3 py-1.5 rounded transition-colors">\${f}</button>\`
    ).join('');
  }

  if (compItems.length) {
    html += '<p class="text-xs text-gray-600 px-3 pt-2 pb-1 font-semibold uppercase tracking-wide">Components</p>';
    html += compItems.map(d =>
      \`<button type="button"
          onclick="openCompModal('modal-\${d.tag}');document.getElementById('add-field-menu').classList.add('hidden')"
          class="flex items-center gap-2 w-full text-left text-xs text-gray-300 hover:text-white hover:bg-gray-700 px-3 py-1.5 rounded transition-colors">
          <span>\${d.icon}</span><span>\${d.label}</span>
        </button>\`
    ).join('');
  }

  if (!html) {
    html = '<p class="text-xs text-gray-500 px-3 py-2 whitespace-nowrap">Nothing more to add.</p>';
  }
  menu.innerHTML = html;
  menu.classList.toggle('hidden');
};

document.addEventListener('click', e => {
  if (!e.target.closest('#add-field-menu') && !e.target.closest('[onclick^="toggleAddField"]')) {
    document.getElementById('add-field-menu')?.classList.add('hidden');
  }
});

// ---- Content toolbar helpers ------------------------------------------------
window.insertTag = function(text) {
  if (window.__bodyEditor) {
    window.__bodyEditor.codemirror.replaceSelection(text);
    window.__bodyEditor.codemirror.focus();
    return;
  }
  const ta = document.getElementById('body-editor');
  if (!ta) return;
  const s = ta.selectionStart ?? 0, end = ta.selectionEnd ?? 0;
  ta.value = ta.value.slice(0, s) + text + ta.value.slice(end);
  ta.selectionStart = ta.selectionEnd = s + text.length;
  ta.focus();
};

window.wrapBody = function(before, after) {
  if (window.__bodyEditor) {
    const cm = window.__bodyEditor.codemirror;
    const sel = cm.getSelection() || 'text';
    cm.replaceSelection(before + sel + after);
    cm.focus();
    return;
  }
  const ta = document.getElementById('body-editor');
  if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd;
  const sel = ta.value.slice(s, e) || 'text';
  const rep = before + sel + after;
  ta.value = ta.value.slice(0, s) + rep + ta.value.slice(e);
  ta.selectionStart = s + before.length;
  ta.selectionEnd = s + before.length + sel.length;
  ta.focus();
};

window.insertBodyLine = function(prefix) {
  if (window.__bodyEditor) {
    const cm = window.__bodyEditor.codemirror;
    const cur = cm.getCursor();
    cm.replaceRange(prefix, { line: cur.line, ch: 0 });
    cm.focus();
    return;
  }
  const ta = document.getElementById('body-editor');
  if (!ta) return;
  const s = ta.selectionStart;
  const lineStart = ta.value.lastIndexOf('\\n', s - 1) + 1;
  ta.value = ta.value.slice(0, lineStart) + prefix + ta.value.slice(lineStart);
  ta.selectionStart = ta.selectionEnd = s + prefix.length;
  ta.focus();
};

window.insertBodySnippet = function(snippet) {
  if (window.__bodyEditor) {
    const cm = window.__bodyEditor.codemirror;
    const cur = cm.getCursor();
    const lineContent = cm.getLine(cur.line) || '';
    const pre = (cur.ch > 0 || lineContent.trim()) ? '\\n' : '';
    cm.replaceSelection(pre + snippet + '\\n');
    cm.focus();
    return;
  }
  const ta = document.getElementById('body-editor');
  if (!ta) return;
  const s = ta.selectionStart;
  const prefix = s > 0 && ta.value[s - 1] !== '\\n' ? '\\n' : '';
  const full = prefix + snippet + '\\n';
  ta.value = ta.value.slice(0, s) + full + ta.value.slice(s);
  ta.selectionStart = ta.selectionEnd = s + prefix.length + snippet.indexOf('\\n') + 1;
  ta.focus();
};

window.insertBodyTag = function(text) {
  if (window.__bodyEditor) {
    const cm = window.__bodyEditor.codemirror;
    const cur = cm.getCursor();
    const lineContent = cm.getLine(cur.line) || '';
    const pre = (cur.ch > 0 || lineContent.trim()) ? '\\n' : '';
    cm.replaceSelection(pre + text + '\\n');
    cm.focus();
    return;
  }
  const ta = document.getElementById('body-editor');
  if (!ta) return;
  const s = ta.selectionStart ?? 0;
  const prefix = s > 0 && ta.value[s - 1] !== '\\n' ? '\\n' : '';
  const full = prefix + text + '\\n';
  ta.value = ta.value.slice(0, s) + full + ta.value.slice(s);
  ta.selectionStart = ta.selectionEnd = s + full.length;
  ta.focus();
};

// ---- Frontmatter collection -------------------------------------------------
window.collectFrontmatter = function collectFrontmatter() {
  const fm = {};
  const isHidden = name => document.getElementById('fm-opt-' + name)?.classList.contains('hidden') ?? false;
  for (const f of ['Title','Short-URI','Template','Type','Category','Parent','Order','Author','Date','Keywords','Description']) {
    const el = document.getElementById('fm-' + f);
    if (!el || el.value === '') continue;
    if (isHidden(f)) continue;  // skip hidden optional fields
    fm[f] = f === 'Order' ? parseInt(el.value, 10) : el.value;
  }
  // Collect Image only if section is visible
  if (!isHidden('Image')) {
    const images = Array.from(document.querySelectorAll('.fm-image-input'))
      .map(el => el.value.trim()).filter(Boolean);
    if (images.length > 0) fm['Image'] = images;
  }
  const labelsEl = document.getElementById('fm-Labels');
  if (labelsEl?.value.trim() && !isHidden('Labels')) fm['Labels'] = labelsEl.value.split(',').map(s => s.trim()).filter(Boolean);

  // Merge component data
  const cd = window.__compData || {};
  for (const [key, val] of Object.entries(cd)) {
    if (val !== null && val !== undefined) fm[key] = val;
  }

  // Merge residual advanced YAML
  const advEl = document.getElementById('fm-advanced');
  if (advEl?.value?.trim()) {
    try { const adv = jsyaml.load(advEl.value); if (adv && typeof adv === 'object') Object.assign(fm, adv); } catch(e) {}
  }
  return fm;
};

// ---- Page actions -----------------------------------------------------------
window.savePage = async function(siteId, path, isNew) {
  const frontmatter = collectFrontmatter();
  const body = window.__bodyEditor ? window.__bodyEditor.value() : (document.getElementById('body-editor')?.value ?? '');
  const status = document.getElementById('save-status');
  try {
    const url = isNew ? '/sites/' + siteId + '/pages' : '/sites/' + siteId + '/pages/' + path + '/parsed';
    const method = isNew ? 'POST' : 'PUT';
    const payload = isNew
      ? JSON.stringify({ path, content: '---\\n' + Object.entries(frontmatter).map(([k,v]) => k + ': ' + (Array.isArray(v) ? '[' + v.join(', ') + ']' : v)).join('\\n') + '\\n---\\n\\n' + body })
      : JSON.stringify({ frontmatter, body });
    const resp = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: payload });
    if (resp.ok) {
      status.textContent = 'Saved ✓'; status.className = 'text-xs text-green-400 h-4';
    } else {
      const err = await resp.json();
      status.textContent = 'Error: ' + (err.error ?? resp.status); status.className = 'text-xs text-red-400 h-4';
    }
  } catch(e) {
    status.textContent = 'Network error'; status.className = 'text-xs text-red-400 h-4';
  }
  setTimeout(() => { if (status) status.textContent = ''; }, 3000);
};

window.deletePage = async function(siteId, path) {
  if (!confirm('Delete ' + path + '?')) return;
  const resp = await fetch('/sites/' + siteId + '/pages/' + path, { method: 'DELETE' });
  if (resp.ok) {
    setEditorPane('<div class="flex items-center justify-center h-full text-gray-500 rounded-xl border border-gray-800"><p>Page deleted.</p></div>');
  }
};

window.templateChanged = function(newTemplate, siteId, pagePath) {
  // Reload editor pane so component defs refresh for new template
  fetch('/sites/' + siteId + '/pages/' + pagePath, { headers: { 'HX-Request': 'true' } })
    .then(r => r.text()).then(html => {
      setEditorPane(html);
      // Restore the template selection the user just picked
      const sel = document.getElementById('fm-Template');
      if (sel) sel.value = newTemplate;
    });
};

// ---- Inline media picker ---------------------------------------------------
window.__pickerFiles = window.__pickerFiles || [];
window.__pickerTargetIndex = window.__pickerTargetIndex ?? -1;

window.openPageMediaPicker = async function(siteId, index) {
  window.__pickerTargetIndex = typeof index === 'number' ? index : -1;
  document.getElementById('page-media-modal')?.classList.remove('hidden');
  if (window.__pickerFiles.length === 0) {
    try {
      const r = await fetch('/sites/' + siteId + '/media/list');
      window.__pickerFiles = await r.json();
    } catch { window.__pickerFiles = []; }
  }
  renderPickerGrid('');
  const searchEl = document.getElementById('picker-search');
  if (searchEl) searchEl.oninput = e => renderPickerGrid(e.target.value);
  const pickerFileEl = document.getElementById('picker-file-input');
  if (pickerFileEl) pickerFileEl.onchange = async function() {
    if (!this.files?.length) return;
    const form = new FormData();
    for (const f of this.files) form.append('files[]', f);
    await fetch('/sites/' + siteId + '/media/upload', { method: 'POST', body: form });
    const r = await fetch('/sites/' + siteId + '/media/list');
    window.__pickerFiles = await r.json();
    renderPickerGrid('');
    this.value = '';
  };
};

// Refresh inline preview for a specific image row
window.refreshImagePreview = function(index, url) {
  const prev = document.getElementById('fm-image-preview-' + index);
  if (!prev) return;
  if (url) {
    prev.innerHTML = \`<img src="\${url}" class="max-h-14 rounded border border-gray-700 object-contain" onerror="this.parentElement.classList.add('hidden')" />\`;
    prev.classList.remove('hidden');
  } else { prev.innerHTML = ''; prev.classList.add('hidden'); }
};

// Remove an image row physically from the DOM
window.removeImageRow = function(index) {
  ['fm-image-row-' + index, 'fm-image-preview-' + index].forEach(id => {
    document.getElementById(id)?.remove();
  });
};

// Add a new empty image row at the bottom of the list
window.addImageRow = function(siteId) {
  const list = document.getElementById('fm-image-list');
  if (!list) return;
  // Remove the "no images" placeholder if present
  const placeholder = list.querySelector('p.italic');
  if (placeholder) placeholder.remove();
  const count = parseInt(document.getElementById('fm-image-count')?.value ?? '0', 10);
  const i = count;
  document.getElementById('fm-image-count').value = String(count + 1);
  const rowEl = document.createElement('div');
  rowEl.id = 'fm-image-row-' + i;
  rowEl.className = 'flex flex-col gap-0.5';
  rowEl.innerHTML = \`
<div class="flex gap-1.5 items-center">
  <input type="text" id="fm-image-\${i}" placeholder="/static/images/photo.jpg"
         class="flex-1 min-w-0 bg-gray-950 border border-gray-700 text-white rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500 fm-image-input"
         oninput="refreshImagePreview(\${i}, this.value)" />
  <button type="button" onclick="openPageMediaPicker('\${siteId}', \${i})"
    class="shrink-0 text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded-md transition-colors">Pick</button>
  <button type="button" onclick="removeImageRow(\${i})"
    class="shrink-0 text-xs text-red-500 hover:text-red-300 px-1 transition-colors">✕</button>
</div>
<div id="fm-image-preview-\${i}" class="hidden pl-0 mt-0.5 mb-1"></div>\`;
  list.appendChild(rowEl);
};

function renderPickerGrid(search) {
  const grid = document.getElementById('picker-grid');
  if (!grid) return;
  const q = (search || '').toLowerCase();
  const filtered = window.__pickerFiles.filter(f => !q || f.path.toLowerCase().includes(q));
  if (!filtered.length) {
    grid.innerHTML = '<div class="col-span-full text-xs text-gray-500 text-center py-8">No files found. Upload some in the Media Library.</div>';
    return;
  }
  grid.innerHTML = filtered.map(f => {
    const thumb = f.type === 'image'
      ? \`<img src="/sites/${escHtml(siteId)}/media/file/\${encodeURIComponent(f.path)}" class="w-full h-full object-cover" loading="lazy" />\`
      : \`<div class="w-full h-full flex items-center justify-center text-2xl">\${({image:'🖼️',pdf:'📄',video:'🎬',audio:'🎵',other:'📎'})[f.type]||'📎'}</div>\`;
    return \`<button data-pick-url="\${f.url}"
      class="group bg-gray-800 border border-gray-700 rounded-lg overflow-hidden hover:border-indigo-500 transition-colors text-left w-full">
      <div class="w-full bg-gray-900" style="height:90px">\${thumb}</div>
      <div class="p-1.5">
        <p class="text-xs text-gray-300 truncate" title="\${f.url}">\${f.name}</p>
      </div>
    </button>\`;
  }).join('');
  grid.onclick = e => {
    const btn = e.target.closest('[data-pick-url]');
    if (!btn) return;
    const url = btn.getAttribute('data-pick-url');
    if (window.__pickerTargetIndex >= 0) {
      const input = document.getElementById('fm-image-' + window.__pickerTargetIndex);
      if (input) { input.value = url; window.refreshImagePreview(window.__pickerTargetIndex, url); }
    }
    document.getElementById('page-media-modal')?.classList.add('hidden');
  };
}

// ---- Init compTagToKey map --------------------------------------------------
window.__compTagToKey = ${JSON.stringify(Object.fromEntries(compDefs.map(d => [d.tag, d.frontmatterKey])))};
window.__compDefs = ${compDefsJson};

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    document.querySelector('[onclick*="savePage"]')?.click();
  }
});
</script>`;
}

export function renderNewPagePane(siteId: string): string {
  const site = getSite(siteId);
  const templates = site ? getAvailableTemplates(resolveSitePath(site)) : TEMPLATES_DEFAULT.map(name => ({ name, theme: 'default' }));
  const parentOptions = site ? getParentOptions(resolveSitePath(site)) : [];

  return `
<div class="flex flex-col h-full bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
  <div class="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
    <span class="text-sm font-medium text-white">New Page</span>
    <button onclick="createPage('${escHtml(siteId)}')"
      class="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-md font-medium">Create</button>
  </div>
  <div class="flex flex-1 min-h-0 overflow-hidden">
    <div class="w-72 shrink-0 border-r border-gray-800 overflow-y-auto p-3 flex flex-col gap-2.5">

      <!-- Header with Add field -->
      <div class="flex items-center justify-between">
        <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fields</p>
        <div class="relative">
          <button type="button" onclick="npToggleAdd(event)"
            class="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">+ Add field</button>
          <div id="np-add-menu"
            class="hidden absolute right-0 top-6 z-30 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-1 min-w-max">
          </div>
        </div>
      </div>

      <!-- Core always-visible -->
      <div>
        <label class="block text-xs font-medium text-gray-400 mb-1">Path <span class="text-red-400">*</span></label>
        <input type="text" id="new-path" placeholder="blog/my-post.md" class="${INPUT_CLASS}" />
        <p class="text-xs text-gray-600 mt-0.5">Relative to content/</p>
      </div>
      ${fmField('Title', 'text', '', 'My New Page')}
      <div>
        <label class="block text-xs font-medium text-gray-400 mb-1">Template</label>
        ${templateSelectHtml(templates, '', 'fm-Template', `npOnTemplateChange(this.value,'${escHtml(siteId)}')`)}
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-400 mb-1">Type</label>
        <select id="fm-Type" class="${INPUT_CLASS}">
          ${TYPES.map(t => `<option value="${escHtml(t)}">${escHtml(t)}</option>`).join('')}
        </select>
      </div>

      <!-- Optional fields (all shown by default, can be hidden) -->
      ${fmOptField('Category', fmField('Category', 'text', '', ''), true)}
      ${fmOptField('Parent',   fmParentSelect('root', parentOptions), true)}
      ${fmOptField('Order',    fmField('Order',    'number', '999', '1'), true)}
      ${fmOptField('Author',   fmField('Author',   'text', '', ''), false)}
      ${fmOptField('Date',     fmField('Date',     'date', '', ''), false)}
      ${fmOptField('Keywords', fmField('Keywords', 'text', '', 'tag1, tag2'), false)}
      ${fmOptField('Description', `<div>
        <label class="block text-xs font-medium text-gray-400 mb-1">Description</label>
        <textarea id="fm-Description" rows="2" class="${INPUT_CLASS} resize-none"></textarea>
      </div>`, false)}

      <!-- Components for selected template (populated by npOnTemplateChange) -->
      <div id="np-comp-section"></div>
    </div>
    <div class="flex-1 p-3 flex flex-col">
      <p class="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Content</p>
      <textarea id="body-editor" spellcheck="true"
        class="flex-1 w-full bg-gray-950 border border-gray-700 text-gray-100 font-mono text-sm rounded-lg p-4 resize-none focus:outline-none focus:border-indigo-500"
      ></textarea>
    </div>
  </div>
  <div class="px-4 py-1.5 border-t border-gray-800">
    <span id="save-status" class="text-xs text-gray-600"></span>
  </div>
</div>

<!-- Component modals injected dynamically by npOnTemplateChange -->
<div id="np-comp-modals"></div>

<script>
(function() {
  const NP_OPTS = ['Category','Parent','Order','Author','Date','Keywords','Description'];

  window.npToggleAdd = function(e) {
    e?.stopPropagation();
    const menu = document.getElementById('np-add-menu');
    if (!menu) return;
    const hidden = NP_OPTS.filter(f => {
      const el = document.getElementById('fm-opt-' + f);
      return !el || el.classList.contains('hidden');
    });
    menu.innerHTML = hidden.length
      ? hidden.map(f => \`<button type="button" onclick="showFmField('\${f}')"
          class="block w-full text-left text-xs text-gray-300 hover:text-white hover:bg-gray-700 px-3 py-1.5 rounded transition-colors">\${f}</button>\`).join('')
      : '<p class="text-xs text-gray-500 px-3 py-2 whitespace-nowrap">All fields visible.</p>';
    menu.classList.toggle('hidden');
  };

  document.addEventListener('click', e => {
    if (!e.target.closest('#np-add-menu') && !e.target.closest('[onclick^="npToggleAdd"]')) {
      document.getElementById('np-add-menu')?.classList.add('hidden');
    }
  });

  const isHidden = name => document.getElementById('fm-opt-' + name)?.classList.contains('hidden') ?? false;

  // Ensure show/hide helpers exist (they may not be if no editor pane was loaded first)
  window.showFmField = function(name) {
    const wrapper = document.getElementById('fm-opt-' + name);
    if (wrapper) {
      wrapper.classList.remove('hidden');
      wrapper.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      wrapper.querySelector('input,textarea,select')?.focus();
    }
    document.getElementById('add-field-menu')?.classList.add('hidden');
    document.getElementById('np-add-menu')?.classList.add('hidden');
  };
  window.hideFmField = function(name) {
    document.getElementById('fm-opt-' + name)?.classList.add('hidden');
  };

  window.npOnTemplateChange = async function(template, siteId) {
    if (!template || !siteId) return;
    try {
      const r = await fetch('/sites/' + siteId + '/themes/components?template=' + encodeURIComponent(template));
      if (!r.ok) { document.getElementById('np-comp-section').innerHTML = ''; return; }
      const { defs, tagToKey } = await r.json();
      window.__compData = {};
      window.__compTagToKey = tagToKey;
      window.__compDefs = defs;
      const section = document.getElementById('np-comp-section');
      if (section) {
        if (defs.length) {
          section.innerHTML =
            '<div class="border-t border-gray-800 pt-2 mt-1">' +
            '<p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Components</p>' +
            '<div class="flex flex-col gap-1.5">' +
            defs.map(d =>
              '<div class="flex items-start justify-between gap-2 bg-gray-800/50 rounded-lg px-2.5 py-2 border border-gray-700/60">' +
              '<div class="min-w-0 flex-1">' +
              '<div class="flex items-center gap-1.5 mb-0.5">' +
              '<span class="text-sm">' + d.icon + '</span>' +
              '<span class="text-xs font-medium text-gray-200 truncate">' + d.label + '</span>' +
              '</div>' +
              '<p class="text-xs text-gray-500 truncate">Click Edit to configure</p>' +
              '</div>' +
              '<button data-modal="modal-' + d.tag + '" onclick="openCompModal(this.dataset.modal)" ' +
              'class="shrink-0 text-xs bg-indigo-700/60 hover:bg-indigo-600 text-white px-2 py-0.5 rounded transition-colors">Edit \u2192</button>' +
              '</div>'
            ).join('') +
            '</div></div>';
        } else {
          section.innerHTML = '';
        }
      }
      const mr = await fetch('/sites/' + siteId + '/pages/new-comp-modals?template=' + encodeURIComponent(template));
      if (mr.ok) {
        const mhtml = await mr.text();
        const modalsEl = document.getElementById('np-comp-modals');
        if (modalsEl) modalsEl.innerHTML = mhtml;
      }
    } catch(e) { console.error('Failed to load template components:', e); }
  };

  window.createPage = async function(siteId) {
    const path = document.getElementById('new-path')?.value.trim();
    if (!path) { alert('Path is required'); return; }
    const fm = {};
    for (const f of ['Title','Template','Type','Category','Parent','Order','Author','Date','Keywords','Description']) {
      if (isHidden(f)) continue;
      const el = document.getElementById('fm-' + f);
      if (el?.value) fm[f] = f === 'Order' ? parseInt(el.value, 10) : el.value;
    }
    // Merge component data from modals
    const cd = window.__compData || {};
    for (const [key, val] of Object.entries(cd)) {
      if (val !== null && val !== undefined) fm[key] = val;
    }
    const body = document.getElementById('body-editor')?.value ?? '';
    const fmLines = Object.entries(fm).map(([k,v]) => k + ': ' + v).join('\\n');
    const content = '---\\n' + fmLines + '\\n---\\n\\n' + body;
    const resp = await fetch('/sites/' + siteId + '/pages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
    });
    const status = document.getElementById('save-status');
    if (resp.ok) {
      status.textContent = 'Created ✓'; status.className = 'text-xs text-green-400';
      setTimeout(() => {
        fetch('/sites/' + siteId + '/pages/' + path, { headers: { 'HX-Request': 'true' } })
          .then(r => r.text()).then(html => { setEditorPane(html); });
      }, 500);
    } else {
      const err = await resp.json();
      status.textContent = 'Error: ' + (err.error ?? resp.status); status.className = 'text-xs text-red-400';
    }
  };
})();
</script>`;
}

/**
 * Returns just the modal HTML for a template's components, with empty data.
 * Injected by the New Page pane client-side when the template changes.
 *
 * GET /sites/:id/pages/new-comp-modals?template=xxx
 */
export function renderNewPageCompModals(siteId: string, templateName: string): string {
  const site = getSite(siteId);
  if (!site) return '';
  const sitePath = resolveSitePath(site!);
  const defs = getCompDefsForPage(sitePath, { Template: templateName });
  return renderCompModals(defs, {});
}

// ---- Tree rendering ---------------------------------------------------------

function renderTree(nodes: PageNode[], siteId: string, openPath?: string, depth = 0): string {
  return nodes.map(node => {
    const indent = depth * 14;
    if (node.isDir) {
      const dirId = `dir-${node.path.replace(/\//g, '-')}`;
      return `
<div>
  <div style="padding-left:${indent + 4}px" class="flex items-center gap-1 py-1 text-gray-500 select-none">
    <span class="text-xs">▸</span>
    <span class="text-xs font-medium">${escHtml(node.name)}</span>
  </div>
  <div id="${escHtml(dirId)}" data-sortable data-site="${escHtml(siteId)}" class="flex flex-col">
    ${renderTree(node.children ?? [], siteId, openPath, depth + 1)}
  </div>
</div>`;
    }
    const isActive = node.path === openPath;
    const cls = isActive ? 'bg-indigo-800 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white';
    return `
<div data-path="${escHtml(node.path)}" data-page-link="${escHtml(node.path)}"
     style="padding-left:${indent + 4}px"
     class="flex items-center gap-1.5 py-1 px-2 rounded-md group ${cls}">
  <span data-drag-handle
    class="text-gray-600 group-hover:text-gray-400 text-sm leading-none select-none shrink-0 cursor-grab"
    title="Drag to reorder">⠿</span>
  <a href="/sites/${escHtml(siteId)}/pages/${escHtml(node.path)}"
     onclick="loadPage(event,'${escHtml(siteId)}','${escHtml(node.path)}')"
     class="flex-1 text-xs truncate">
    ${escHtml(node.name.replace(/\.md$/, ''))}
  </a>
</div>`;
  }).join('');
}

// ---- Helpers ----------------------------------------------------------------

function buildTree(dir: string, root: string): PageNode[] {
  const entries = readdirSync(dir);
  const nodes: PageNode[] = [];
  for (const entry of entries) {
    const abs = join(dir, entry);
    const rel = relative(root, abs).replace(/\\/g, '/');
    const s = statSync(abs);
    if (s.isDirectory()) nodes.push({ name: entry, path: rel, isDir: true, children: buildTree(abs, root) });
    else if (extname(entry) === '.md') nodes.push({ name: entry, path: rel, isDir: false });
  }
  return nodes;
}
