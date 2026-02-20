/**
 * UI: Env — .env key-value editor with secret masking.
 *
 * GET /sites/:id/env
 */
import { shell, escHtml } from './shell.js';
import { getSite, resolveSitePath } from '../registry.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const MASK_PATTERN = /SECRET|KEY|TOKEN|PASSWORD|PRIVATE|STRIPE/i;
const MASK_VALUE = '••••••';

interface EnvEntry {
  key: string;
  value: string;
  masked: boolean;
}

export function renderEnv(siteId: string, htmx = false): string {
  const site = getSite(siteId);
  if (!site) {
    return shell({ title: 'Env', body: `<p class="text-red-400">Site not found: ${escHtml(siteId)}</p>` });
  }

  const envPath = join(resolveSitePath(site), '.env');
  const raw = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';
  const entries = parseEnv(raw);

  const rows = entries.map(({ key, value, masked }, i) => {
    const displayVal = masked ? MASK_VALUE : value;
    return `
<tr class="border-t border-gray-700">
  <td class="py-2 pr-4 w-64">
    <input type="text" name="key-${i}" value="${escHtml(key)}"
           class="w-full bg-gray-900 border border-gray-700 text-white rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-indigo-500" />
  </td>
  <td class="py-2 pr-4">
    <div class="flex gap-2 items-center">
      <input type="${masked ? 'password' : 'text'}" name="val-${i}" id="val-${i}" value="${escHtml(displayVal)}"
             data-masked="${masked}"
             class="flex-1 bg-gray-900 border border-gray-700 text-white rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-indigo-500" />
      ${masked ? `<button type="button" onclick="toggleMask(${i})" class="text-xs text-gray-500 hover:text-gray-300 shrink-0">Show</button>` : ''}
    </div>
  </td>
  <td class="py-2 w-8">
    <button type="button" onclick="removeRow(this)" class="text-red-600 hover:text-red-400 text-xs">✕</button>
  </td>
</tr>`;
  }).join('');

  const body = `
<div class="flex flex-col gap-6 max-w-3xl">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold text-white">Environment Variables</h1>
    <div class="flex gap-2">
      <button type="button" onclick="addRow()"
        class="text-sm bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg">
        + Add
      </button>
      <button type="button" onclick="saveEnv('${escHtml(siteId)}')"
        class="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg">
        Save
      </button>
    </div>
  </div>

  <div class="bg-gray-800 rounded-xl border border-gray-700 p-4 overflow-x-auto">
    <table class="w-full text-sm" id="env-table">
      <thead>
        <tr class="text-left text-xs text-gray-500">
          <th class="pb-2 pr-4 font-medium">Key</th>
          <th class="pb-2 pr-4 font-medium">Value</th>
          <th></th>
        </tr>
      </thead>
      <tbody id="env-rows">
        ${rows}
      </tbody>
    </table>
  </div>

  <div id="save-status" class="text-xs text-gray-500 h-4"></div>
</div>

<script>(function() {
let rowCount = ${entries.length};

window.toggleMask = function(i) {
  const input = document.getElementById('val-' + i);
  input.type = input.type === 'password' ? 'text' : 'password';
};

window.removeRow = function(btn) {
  btn.closest('tr').remove();
};

window.addRow = function addRow() {
  const tbody = document.getElementById('env-rows');
  const i = rowCount++;
  const tr = document.createElement('tr');
  tr.className = 'border-t border-gray-700';
  tr.innerHTML = \`
    <td class="py-2 pr-4 w-64">
      <input type="text" name="key-\${i}" placeholder="KEY_NAME"
             class="w-full bg-gray-900 border border-gray-700 text-white rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-indigo-500" />
    </td>
    <td class="py-2 pr-4">
      <input type="text" name="val-\${i}" id="val-\${i}" placeholder="value" data-masked="false"
             class="w-full bg-gray-900 border border-gray-700 text-white rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-indigo-500" />
    </td>
    <td class="py-2 w-8">
      <button type="button" onclick="removeRow(this)" class="text-red-600 hover:text-red-400 text-xs">✕</button>
    </td>\`;
  tbody.appendChild(tr);
};

window.saveEnv = async function(siteId) {
  const rows = document.querySelectorAll('#env-rows tr');
  const entries = [];
  rows.forEach(tr => {
    const inputs = tr.querySelectorAll('input[name]');
    let key = '', value = '', masked = false;
    inputs.forEach(inp => {
      if (inp.name.startsWith('key-')) key = inp.value.trim();
      if (inp.name.startsWith('val-')) {
        value = inp.value;
        masked = inp.dataset.masked === 'true';
      }
    });
    if (key) entries.push({ key, value, masked });
  });

  const resp = await fetch('/sites/' + siteId + '/env', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entries),
  });
  const status = document.getElementById('save-status');
  if (resp.ok) {
    status.textContent = 'Saved ✓';
    status.className = 'text-xs text-green-400 h-4';
  } else {
    const err = await resp.json();
    status.textContent = 'Error: ' + (err.error ?? resp.status);
    status.className = 'text-xs text-red-400 h-4';
  }
  setTimeout(() => { status.textContent = ''; }, 3000);
}
})();
</script>`;

  return htmx ? body : shell({ title: 'Env — Flint Manager', siteId, activeSection: 'env', body });
}

function parseEnv(raw: string): EnvEntry[] {
  const result: EnvEntry[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    result.push({ key, value, masked: MASK_PATTERN.test(key) });
  }
  return result;
}
