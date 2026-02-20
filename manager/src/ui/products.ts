/**
 * UI: Products — editor for products.yaml.
 *
 * Features:
 *   - Visual tab: card grid with all product fields as form inputs,
 *     drag-and-drop reorder, Add / Remove, price as decimal, Stripe badges
 *   - YAML tab: raw textarea for direct editing of products.yaml
 *   - Switching back to Visual reloads from server (re-parses saved YAML)
 *   - SSE build log for generate / sync / force-sync
 *
 * products.yaml is the single source of truth:
 *   Edit here → Run Generate (creates content/shop/*.md scaffold)
 *              → Sync Stripe  (creates Stripe products + Payment Links)
 */
import { shell, escHtml } from './shell.js';
import { getSite } from '../registry.js';

export function renderProducts(siteId: string, htmx = false): string {
  const site = getSite(siteId);
  if (!site) {
    return shell({ title: 'Products', body: `<p class="text-red-400">Site not found: ${escHtml(siteId)}</p>` });
  }

  const sid = escHtml(siteId);

  const body = `
<div class="flex flex-col gap-4 max-w-6xl">
  <!-- Toolbar -->
  <div class="flex items-center justify-between flex-wrap gap-2">
    <div class="flex items-center gap-3">
      <h1 class="text-xl font-bold text-white">Products</h1>
      <!-- Tab switcher -->
      <div class="flex rounded-lg overflow-hidden border border-gray-700 text-xs">
        <button id="tab-visual" onclick="switchTab('visual')"
          class="px-3 py-1.5 bg-indigo-600 text-white font-medium transition-colors">
          Visual
        </button>
        <button id="tab-yaml" onclick="switchTab('yaml')"
          class="px-3 py-1.5 bg-gray-800 text-gray-400 hover:text-white transition-colors">
          YAML
        </button>
      </div>
    </div>
    <div class="flex gap-2 flex-wrap items-center">
      <span id="visual-actions" class="flex gap-2">
        <button onclick="addProduct()"
          class="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg transition-colors">
          + Add Product
        </button>
      </span>
      <button onclick="runGenerate('${sid}')"
        class="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg transition-colors"
        title="Generate content/shop/*.md scaffold from products.yaml">
        Run Generate
      </button>
      <button onclick="runSync('${sid}', false)"
        class="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg transition-colors"
        title="Sync products.yaml → Stripe (create/update products + payment links)">
        Sync Stripe
      </button>
      <button onclick="runSync('${sid}', true)"
        class="text-xs bg-yellow-700 hover:bg-yellow-600 text-white px-3 py-1.5 rounded-lg transition-colors"
        title="Force-recreate all Stripe Payment Links">
        Force Sync
      </button>
      <button onclick="handleSave('${sid}')"
        class="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg font-medium transition-colors">
        Save
      </button>
    </div>
  </div>

  <div id="save-status" class="text-xs h-4"></div>

  <!-- Loading spinner -->
  <div id="products-loading" class="flex items-center gap-2 text-gray-500 text-sm py-6">
    <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
    </svg>
    Loading products…
  </div>

  <!-- Visual panel -->
  <div id="panel-visual" class="hidden flex flex-col gap-4">
    <div id="products-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"></div>
  </div>

  <!-- YAML panel -->
  <div id="panel-yaml" class="hidden flex flex-col gap-2">
    <p class="text-xs text-gray-500">
      Edit <code class="font-mono">products.yaml</code> directly.
      Each entry becomes a product card — save then switch to Visual to preview.
    </p>
    <textarea id="yaml-editor"
      class="w-full bg-gray-900 border border-gray-700 text-gray-200 font-mono text-xs rounded-xl p-4 focus:outline-none focus:border-indigo-500 resize-y min-h-80"
      spellcheck="false" placeholder="products:\n  - id: my-product\n    title: My Product\n    price_cents: 1200"></textarea>
  </div>

  <!-- Build log -->
  <div class="bg-gray-900 rounded-xl border border-gray-700 p-4 mt-2">
    <div class="flex items-center justify-between mb-2">
      <span class="text-xs font-semibold text-gray-400 uppercase">Build Log</span>
      <button onclick="document.getElementById('build-log').textContent=''"
        class="text-xs text-gray-600 hover:text-gray-400">Clear</button>
    </div>
    <pre id="build-log" class="text-xs font-mono text-gray-400 whitespace-pre-wrap max-h-48 overflow-y-auto min-h-8"></pre>
  </div>
</div>

<script>(function() {
const SITE_ID = '${sid}';
let products = [];
let activeTab = 'visual';

const CARD_CSS = 'bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-3 relative group hover:border-gray-600 transition-colors';
const INP = 'w-full bg-gray-900 border border-gray-700 text-white rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500';
const LBL = 'block text-xs font-medium text-gray-500 mb-1';

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function escField(v) {
  if (v == null) return '';
  return String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function updateImgPreview(idx, val) {
  const el = document.getElementById('img-preview-' + idx);
  if (!el) return;
  if (val && (val.startsWith('http') || val.startsWith('/'))) {
    el.innerHTML = '<img src="' + val + '" class="w-10 h-10 object-cover rounded" />';
  } else {
    el.textContent = val || '📦';
  }
}

function autoId(idx, title) {
  const card = document.querySelector('[data-idx="' + idx + '"]');
  const idEl = card?.querySelector('[data-field="id"]');
  if (idEl && idEl.dataset.autoId !== 'false') {
    idEl.value = slugify(title);
    idEl.dataset.autoId = 'true';
  }
}

function renderCard(p, idx) {
  const price = p.price_cents ? (p.price_cents / 100).toFixed(2) : '';
  const labels = Array.isArray(p.labels) ? p.labels.join(', ') : (p.labels || '');
  const hasStripe = !!p.stripe_price_id;
  const currs = ['usd','eur','gbp','aud','cad'];
  const currOpts = currs.map(c => '<option value="' + c + '" ' + ((p.currency||'usd')===c?'selected':'') + '>' + c.toUpperCase() + '</option>').join('');

  return '<div class="' + CARD_CSS + '" data-idx="' + idx + '">' +
    '<div class="absolute top-2 right-2 text-gray-600 group-hover:text-gray-400 cursor-grab active:cursor-grabbing text-lg select-none" data-drag-handle title="Drag to reorder">⠿</div>' +

    '<div class="flex items-center gap-3">' +
      '<div class="text-3xl w-12 h-12 flex items-center justify-center bg-gray-900 rounded-lg border border-gray-700 shrink-0" id="img-preview-' + idx + '">' + escField(p.image || '📦') + '</div>' +
      '<div class="flex-1 min-w-0">' +
        '<label class="' + LBL + '">Image (emoji or URL)</label>' +
        '<input type="text" class="' + INP + '" data-field="image" value="' + escField(p.image) + '" oninput="updateImgPreview(' + idx + ',this.value)" placeholder="📦" />' +
      '</div>' +
    '</div>' +

    '<div><label class="' + LBL + '">Title</label>' +
    '<input type="text" class="' + INP + '" data-field="title" value="' + escField(p.title) + '" oninput="autoId(' + idx + ',this.value)" placeholder="Product Name" /></div>' +

    '<div><label class="' + LBL + '">ID <span class="text-gray-600">(slug)</span></label>' +
    '<input type="text" class="' + INP + ' font-mono" data-field="id" value="' + escField(p.id) + '" placeholder="product-slug" data-auto-id="false" /></div>' +

    '<div><label class="' + LBL + '">Description</label>' +
    '<textarea class="' + INP + ' resize-none" data-field="description" rows="2" placeholder="Short description">' + escField(p.description) + '</textarea></div>' +

    '<div class="flex gap-2">' +
      '<div class="flex-1"><label class="' + LBL + '">Price</label>' +
      '<input type="number" step="0.01" min="0" class="' + INP + '" data-field="price_decimal" value="' + escField(price) + '" placeholder="12.00" /></div>' +
      '<div class="w-20"><label class="' + LBL + '">Currency</label>' +
      '<select class="' + INP + '" data-field="currency">' + currOpts + '</select></div>' +
    '</div>' +

    '<div><label class="' + LBL + '">Labels <span class="text-gray-600">(comma-separated)</span></label>' +
    '<input type="text" class="' + INP + '" data-field="labels" value="' + escField(labels) + '" placeholder="tag1, tag2" /></div>' +

    '<div><label class="' + LBL + '">Tax Code</label>' +
    '<input type="text" class="' + INP + ' font-mono text-xs" data-field="tax_code" value="' + escField(p.tax_code) + '" placeholder="txcd_99999999" /></div>' +

    (hasStripe
      ? '<div class="flex flex-col gap-1 pt-2 border-t border-gray-700">' +
          '<span class="text-xs text-green-400 font-medium">✓ Linked to Stripe</span>' +
          '<span class="text-xs text-gray-500 font-mono truncate">' + escField(p.stripe_price_id) + '</span>' +
          (p.stripe_payment_link ? '<a href="' + escField(p.stripe_payment_link) + '" target="_blank" class="text-xs text-indigo-400 hover:underline truncate">' + escField(p.stripe_payment_link) + '</a>' : '') +
        '</div>'
      : '<div class="pt-2 border-t border-gray-700"><span class="text-xs text-gray-600">No Stripe link — sync to connect</span></div>') +

    '<button onclick="removeProduct(' + idx + ')" ' +
      'class="absolute bottom-2 right-10 text-xs text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">✕ Remove</button>' +
  '</div>';
}

function readCard(card) {
  const g = f => card.querySelector('[data-field="' + f + '"]')?.value ?? '';
  const origIdx = parseInt(card.getAttribute('data-idx'), 10);
  const orig = products[origIdx] ?? {};
  const priceDec = parseFloat(g('price_decimal'));
  const labelsRaw = g('labels').split(',').map(s => s.trim()).filter(Boolean);
  return {
    id: g('id') || slugify(g('title')) || ('product-' + origIdx),
    title: g('title'),
    description: g('description') || undefined,
    price_cents: isNaN(priceDec) ? (orig.price_cents ?? 0) : Math.round(priceDec * 100),
    currency: g('currency') || 'usd',
    image: g('image') || undefined,
    labels: labelsRaw.length ? labelsRaw : undefined,
    tax_code: g('tax_code') || undefined,
    stripe_price_id: orig.stripe_price_id || undefined,
    stripe_payment_link: orig.stripe_payment_link || undefined,
  };
}

function collectProducts() {
  return [...document.querySelectorAll('#products-grid [data-idx]')].map(readCard);
}

function addProduct() {
  products.push({ id: '', title: '', price_cents: 0, currency: 'usd', image: '📦' });
  renderGrid();
}

function removeProduct(idx) {
  if (!confirm('Remove this product?')) return;
  products = collectProducts();
  products.splice(idx, 1);
  renderGrid();
}

function renderGrid() {
  const grid = document.getElementById('products-grid');
  grid.innerHTML = products.map((p, i) => renderCard(p, i)).join('');
  initProductsSortable();
}

function initProductsSortable() {
  const grid = document.getElementById('products-grid');
  if (!grid || typeof Sortable === 'undefined') return;
  if (grid._sortable) grid._sortable.destroy();
  grid._sortable = Sortable.create(grid, {
    handle: '[data-drag-handle]',
    animation: 150,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    onEnd() {
      [...grid.querySelectorAll('[data-idx]')].forEach((el, i) => el.setAttribute('data-idx', i));
    },
  });
}

// ── Tab UI ──────────────────────────────────────────────────────────────────

function switchTab(tab) {
  activeTab = tab;
  const visualBtn = document.getElementById('tab-visual');
  const yamlBtn   = document.getElementById('tab-yaml');
  const panelV    = document.getElementById('panel-visual');
  const panelY    = document.getElementById('panel-yaml');
  const visualAct = document.getElementById('visual-actions');

  if (tab === 'visual') {
    visualBtn.className = 'px-3 py-1.5 bg-indigo-600 text-white font-medium transition-colors';
    yamlBtn.className   = 'px-3 py-1.5 bg-gray-800 text-gray-400 hover:text-white transition-colors';
    panelV.className = 'flex flex-col gap-4';
    panelY.className = 'hidden flex flex-col gap-2';
    visualAct.className = 'flex gap-2';
    loadVisual(); // re-parse from server so YAML edits are reflected
  } else {
    yamlBtn.className   = 'px-3 py-1.5 bg-indigo-600 text-white font-medium transition-colors';
    visualBtn.className = 'px-3 py-1.5 bg-gray-800 text-gray-400 hover:text-white transition-colors';
    panelY.className = 'flex flex-col gap-2';
    panelV.className = 'hidden flex flex-col gap-4';
    visualAct.className = 'hidden flex gap-2';
    loadYaml();
  }
}

// ── Data loaders ─────────────────────────────────────────────────────────────

async function loadVisual() {
  const loading = document.getElementById('products-loading');
  loading.className = 'flex items-center gap-2 text-gray-500 text-sm py-6';
  document.getElementById('panel-visual').className = 'hidden flex flex-col gap-4';
  try {
    const resp = await fetch('/sites/' + SITE_ID + '/products/parsed');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    products = data.products ?? [];
    renderGrid();
    loading.className = 'hidden';
    document.getElementById('panel-visual').className = 'flex flex-col gap-4';
  } catch(e) {
    loading.innerHTML = '<span class="text-red-400">Failed to load products: ' + e.message + '</span>';
  }
}

async function loadYaml() {
  const ta = document.getElementById('yaml-editor');
  ta.value = 'Loading…';
  try {
    const resp = await fetch('/sites/' + SITE_ID + '/products/raw');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    ta.value = data.content ?? '';
  } catch(e) {
    ta.value = '# Error loading products.yaml: ' + e.message;
  }
}

// ── Save ─────────────────────────────────────────────────────────────────────

async function handleSave(siteId) {
  if (activeTab === 'yaml') return saveYaml(siteId);
  return saveVisual(siteId);
}

async function saveVisual(siteId) {
  const prods = collectProducts();
  prods.forEach((p, i) => { p.order = i + 1; });
  const status = document.getElementById('save-status');
  try {
    const resp = await fetch('/sites/' + siteId + '/products/parsed', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: prods }),
    });
    if (resp.ok) {
      products = prods; renderGrid();
      status.textContent = 'Saved ✓'; status.className = 'text-xs text-green-400 h-4';
    } else {
      const err = await resp.json();
      status.textContent = 'Error: ' + (err.error ?? resp.status);
      status.className = 'text-xs text-red-400 h-4';
    }
  } catch(e) {
    status.textContent = 'Network error';
    status.className = 'text-xs text-red-400 h-4';
  }
  setTimeout(() => { if (status) status.textContent = ''; }, 3000);
}

async function saveYaml(siteId) {
  const content = document.getElementById('yaml-editor').value;
  const status = document.getElementById('save-status');
  try {
    const resp = await fetch('/sites/' + siteId + '/products', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (resp.ok) {
      status.textContent = 'Saved ✓'; status.className = 'text-xs text-green-400 h-4';
    } else {
      const err = await resp.json();
      status.textContent = 'Error: ' + (err.error ?? resp.status);
      status.className = 'text-xs text-red-400 h-4';
    }
  } catch(e) {
    status.textContent = 'Network error';
    status.className = 'text-xs text-red-400 h-4';
  }
  setTimeout(() => { if (status) status.textContent = ''; }, 3000);
}

// ── Build log / actions ───────────────────────────────────────────────────────

async function streamBuildLog(url, method) {
  const log = document.getElementById('build-log');
  log.textContent = '';
  try {
    const resp = await fetch(url, { method });
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split('\\n\\n'); buf = parts.pop() ?? '';
      for (const part of parts) {
        if (part.startsWith('data: ')) { log.textContent += part.slice(6) + '\\n'; log.scrollTop = log.scrollHeight; }
      }
    }
  } catch(e) { log.textContent += '\\nError: ' + e.message; }
}

function runGenerate(siteId) { streamBuildLog('/sites/' + siteId + '/products/generate', 'POST'); }
function runSync(siteId, force) {
  streamBuildLog('/sites/' + siteId + '/products/sync' + (force ? '/force' : ''), 'POST');
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
// Handles both full-page load and HTMX swap (readyState may already be 'complete').
function init() { loadVisual(); }
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
})();
</script>`;

  return htmx ? body : shell({ title: 'Products — Flint Manager', siteId, activeSection: 'products', body });
}
