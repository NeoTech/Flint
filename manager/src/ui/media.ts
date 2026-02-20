/**
 * UI: Media — browse, upload and delete files in a site's static/ folder.
 *
 * GET /sites/:id/media
 */
import { shell, escHtml } from './shell.js';

export function renderMedia(siteId: string, htmx = false): string {
  const body = `
<div class="flex flex-col gap-4 h-full" style="max-height:calc(100vh - 7rem)">

  <!-- Header -->
  <div class="flex items-center justify-between shrink-0">
    <div>
      <h1 class="text-2xl font-bold text-white">Media Library</h1>
      <p class="text-xs text-gray-500 mt-0.5">Files in <code class="text-indigo-400">static/</code> — public URL shown with each file</p>
    </div>
    <div class="flex items-center gap-2">
      <!-- Folder prefix for upload -->
      <input id="upload-folder" type="text" placeholder="subfolder/ (optional)"
        class="bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-xs w-44 focus:outline-none focus:border-indigo-500 font-mono" />
      <label class="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-1.5 rounded-lg font-medium transition-colors">
        ⬆ Upload
        <input id="file-input" type="file" multiple class="hidden"
          accept="image/*,.pdf,.zip,.mp4,.webm,.mp3,.txt,.json,.xml,.csv,.woff,.woff2,.ttf" />
      </label>
    </div>
  </div>

  <!-- Upload progress -->
  <div id="upload-status" class="hidden text-xs text-indigo-300 bg-indigo-950/60 border border-indigo-800/60 px-3 py-2 rounded-lg shrink-0"></div>

  <!-- Filter bar -->
  <div class="flex items-center gap-2 shrink-0">
    <input id="search-input" type="text" placeholder="Search files…"
      class="bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-xs flex-1 max-w-xs focus:outline-none focus:border-indigo-500" />
    <div class="flex gap-1" id="type-filters">
      ${['all','image','pdf','video','audio','other'].map((t, i) =>
        `<button data-filter="${t}" onclick="setFilter('${t}')"
          class="text-xs px-2.5 py-1 rounded-md border ${i === 0 ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'} transition-colors capitalize">
          ${t}
        </button>`
      ).join('')}
    </div>
    <span id="file-count" class="text-xs text-gray-600 ml-auto"></span>
  </div>

  <!-- Grid -->
  <div class="flex-1 overflow-y-auto">
    <div id="media-grid" class="grid gap-3" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">
      <div class="text-xs text-gray-600 col-span-full pt-8 text-center">Loading…</div>
    </div>
    <div id="empty-state" class="hidden flex-col items-center justify-center pt-16 text-gray-600 gap-2">
      <span class="text-4xl">🖼️</span>
      <p class="text-sm">No files yet — upload something above</p>
    </div>
  </div>
</div>

<!-- Media picker modal (used by pages editor via openMediaPicker()) -->
<div id="media-picker-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/70">
  <div class="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl mx-4 flex flex-col" style="max-height:80vh">
    <div class="flex items-center justify-between px-5 py-3.5 border-b border-gray-700 shrink-0">
      <span class="font-semibold text-white text-sm">🖼️ Pick a file</span>
      <button onclick="closeMediaPicker()" class="text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-800">Cancel</button>
    </div>
    <div class="p-4 overflow-y-auto flex-1">
      <div id="picker-grid" class="grid gap-2" style="grid-template-columns:repeat(auto-fill,minmax(120px,1fr))">
        <div class="text-xs text-gray-600 col-span-full text-center py-8">Loading…</div>
      </div>
    </div>
  </div>
</div>

<script>(function() {
const SITE_ID = '${escHtml(siteId)}';
let allFiles = [];
let activeFilter = 'all';
let pickerCallback = null;

// ---- Load ------------------------------------------------------------------
async function loadFiles() {
  try {
    const resp = await fetch('/sites/' + SITE_ID + '/media/list');
    allFiles = await resp.json();
  } catch { allFiles = []; }
  renderGrid();
}

// ---- Render ----------------------------------------------------------------
function typeIcon(type) {
  return { image:'🖼️', pdf:'📄', video:'🎬', audio:'🎵', other:'📎' }[type] ?? '📎';
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function renderGrid() {
  const search = document.getElementById('search-input')?.value.toLowerCase() ?? '';
  const filtered = allFiles.filter(f => {
    if (activeFilter !== 'all' && f.type !== activeFilter) return false;
    if (search && !f.path.toLowerCase().includes(search)) return false;
    return true;
  });

  const grid = document.getElementById('media-grid');
  const empty = document.getElementById('empty-state');
  const count = document.getElementById('file-count');
  if (!grid) return;

  if (count) count.textContent = filtered.length + ' file' + (filtered.length !== 1 ? 's' : '');

  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty?.classList.remove('hidden');
    empty?.classList.add('flex');
    return;
  }
  empty?.classList.add('hidden');
  empty?.classList.remove('flex');

  grid.innerHTML = filtered.map(f => {
    const preview = f.type === 'image'
      ? \`<img src="/sites/\${SITE_ID}/media/file/\${encodeURIComponent(f.path)}" alt=""
             class="w-full h-full object-cover" loading="lazy"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
         <div class="hidden w-full h-full items-center justify-center text-3xl">\${typeIcon(f.type)}</div>\`
      : \`<div class="w-full h-full flex items-center justify-center text-3xl">\${typeIcon(f.type)}</div>\`;

    return \`<div class="group relative bg-gray-800 border border-gray-700 rounded-xl overflow-hidden hover:border-indigo-500 transition-colors">
  <div class="w-full bg-gray-900" style="height:120px">\${preview}</div>
  <div class="p-2">
    <p class="text-xs text-gray-200 truncate font-medium" title="\${f.path}">\${f.name}</p>
    <p class="text-xs text-gray-600">\${formatSize(f.size)}</p>
    <p class="text-xs text-indigo-400 font-mono truncate" title="\${f.url}">\${f.url}</p>
  </div>
  <!-- Hover overlay -->
  <div class="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
    <button data-action="copy" data-url="\${f.url}"
      class="w-full text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-md px-2 py-1.5 transition-colors">
      📋 Copy URL
    </button>
    <a href="/sites/\${SITE_ID}/media/file/\${encodeURIComponent(f.path)}" download="\${f.name}"
      class="w-full text-center text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-md px-2 py-1.5 transition-colors">
      ⬇ Download
    </a>
    <button data-action="delete" data-path="\${f.path}"
      class="w-full text-xs bg-red-900/80 hover:bg-red-700 text-red-300 hover:text-white rounded-md px-2 py-1.5 transition-colors">
      🗑 Delete
    </button>
  </div>
</div>\`;
  }).join('');
}

// ---- Filter / search -------------------------------------------------------
window.setFilter = function(f) {
  activeFilter = f;
  document.querySelectorAll('[data-filter]').forEach(el => {
    const active = el.getAttribute('data-filter') === f;
    el.classList.toggle('bg-indigo-600', active);
    el.classList.toggle('border-indigo-600', active);
    el.classList.toggle('text-white', active);
    el.classList.toggle('bg-gray-800', !active);
    el.classList.toggle('border-gray-700', !active);
    el.classList.toggle('text-gray-400', !active);
  });
  renderGrid();
};

document.getElementById('search-input')?.addEventListener('input', renderGrid);

// ---- Event delegation for grid buttons ------------------------------------
document.getElementById('media-grid')?.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.getAttribute('data-action');
  if (action === 'copy') {
    navigator.clipboard.writeText(btn.getAttribute('data-url')).then(() =>
      showStatus('Copied: ' + btn.getAttribute('data-url'), 'green'));
  } else if (action === 'delete') {
    deleteFile(btn.getAttribute('data-path'));
  }
});

// ---- Upload ----------------------------------------------------------------
document.getElementById('file-input')?.addEventListener('change', async function() {
  const files = this.files;
  if (!files || files.length === 0) return;
  const folder = document.getElementById('upload-folder')?.value.trim() ?? '';
  const form = new FormData();
  if (folder) form.append('folder', folder);
  for (const f of files) form.append('files[]', f);

  showStatus('Uploading ' + files.length + ' file(s)…', 'blue');
  try {
    const resp = await fetch('/sites/' + SITE_ID + '/media/upload', { method: 'POST', body: form });
    const data = await resp.json();
    if (resp.ok) {
      showStatus('Uploaded: ' + data.uploaded.join(', '), 'green');
      await loadFiles();
    } else {
      showStatus('Error: ' + (data.error ?? resp.status), 'red');
    }
  } catch (e) {
    showStatus('Network error', 'red');
  }
  this.value = '';
});

// ---- Delete ----------------------------------------------------------------
async function deleteFile(path) {
  if (!confirm('Delete ' + path + '?')) return;
  const resp = await fetch('/sites/' + SITE_ID + '/media/' + encodeURIComponent(path), { method: 'DELETE' });
  if (resp.ok) {
    showStatus('Deleted ' + path, 'green');
    await loadFiles();
  } else {
    const data = await resp.json();
    showStatus('Error: ' + (data.error ?? resp.status), 'red');
  }
}

// ---- Drag & drop upload ----------------------------------------------------
const grid = document.getElementById('media-grid');
if (grid) {
  grid.addEventListener('dragover', e => { e.preventDefault(); grid.style.opacity = '0.7'; });
  grid.addEventListener('dragleave', () => { grid.style.opacity = ''; });
  grid.addEventListener('drop', async e => {
    e.preventDefault(); grid.style.opacity = '';
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const folder = document.getElementById('upload-folder')?.value.trim() ?? '';
    const form = new FormData();
    if (folder) form.append('folder', folder);
    for (const f of files) form.append('files[]', f);
    showStatus('Uploading ' + files.length + ' file(s)…', 'blue');
    const resp = await fetch('/sites/' + SITE_ID + '/media/upload', { method: 'POST', body: form });
    const data = await resp.json();
    if (resp.ok) { showStatus('Uploaded: ' + data.uploaded.join(', '), 'green'); await loadFiles(); }
    else showStatus('Error: ' + (data.error ?? resp.status), 'red');
  });
}

// ---- Status bar ------------------------------------------------------------
function showStatus(msg, color) {
  const el = document.getElementById('upload-status');
  if (!el) return;
  const colors = { green: 'text-green-300', blue: 'text-indigo-300', red: 'text-red-300' };
  el.className = 'text-xs ' + (colors[color] ?? colors.blue) + ' bg-indigo-950/60 border border-indigo-800/60 px-3 py-2 rounded-lg shrink-0';
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 4000);
}

// ---- Media Picker (used by pages editor) -----------------------------------
window.openMediaPicker = function(callback) {
  pickerCallback = callback;
  renderPickerGrid();
  document.getElementById('media-picker-modal')?.classList.remove('hidden');
};

window.closeMediaPicker = function() {
  pickerCallback = null;
  document.getElementById('media-picker-modal')?.classList.add('hidden');
};

function renderPickerGrid() {
  const pickerGrid = document.getElementById('picker-grid');
  if (!pickerGrid) return;
  const images = allFiles.filter(f => f.type === 'image');
  const others = allFiles.filter(f => f.type !== 'image');
  const all = [...images, ...others];

  if (all.length === 0) {
    pickerGrid.innerHTML = '<div class="col-span-full text-center text-xs text-gray-500 py-8">No files uploaded yet.</div>';
    return;
  }

  pickerGrid.innerHTML = all.map(f => {
    const thumb = f.type === 'image'
      ? \`<img src="/sites/\${SITE_ID}/media/file/\${encodeURIComponent(f.path)}" class="w-full h-full object-cover" loading="lazy" />\`
      : \`<div class="w-full h-full flex items-center justify-center text-2xl">\${typeIcon(f.type)}</div>\`;
    return \`<button data-pick-url="\${f.url}"
      class="group bg-gray-800 border border-gray-700 rounded-lg overflow-hidden hover:border-indigo-500 transition-colors text-left w-full">
      <div class="w-full bg-gray-900" style="height:90px">\${thumb}</div>
      <div class="p-1.5">
        <p class="text-xs text-gray-300 truncate" title="\${f.url}">\${f.name}</p>
      </div>
    </button>\`;
  }).join('');

  // Replace any previous listener by re-assigning innerHTML
  pickerGrid.onclick = e => {
    const btn = e.target.closest('[data-pick-url]');
    if (!btn) return;
    if (pickerCallback) pickerCallback(btn.getAttribute('data-pick-url'));
    window.closeMediaPicker();
  };
}

// ---- Boot ------------------------------------------------------------------
loadFiles();
})();
</script>`;

  return htmx ? body : shell({ title: 'Media — Flint Manager', siteId, activeSection: 'media', body });
}
