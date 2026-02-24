/**
 * UI: Build + Deploy — trigger a build and stream the log, then deploy.
 *
 * GET /sites/:id/build
 */
import { shell, escHtml } from './shell.js';
import { getSite } from '../registry.js';

export function renderBuild(siteId: string, htmx = false): string {
  const site = getSite(siteId);
  if (!site) {
    return shell({ title: 'Build', body: `<p class="text-red-400">Site not found: ${escHtml(siteId)}</p>` });
  }

  const body = `
<div class="flex flex-col gap-6 max-w-3xl">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold text-white">Build &amp; Deploy</h1>
    <div class="flex gap-2">
      <button id="build-btn"
        onclick="startBuild('${escHtml(siteId)}')"
        class="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium">
        🔨 Build
      </button>
      <button id="test-btn"
        onclick="startTest('${escHtml(siteId)}')"
        class="text-sm bg-gray-700 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium">
        ✅ Run Tests
      </button>
      <button
        onclick="document.getElementById('build-log').textContent = ''"
        class="text-sm bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg">
        Clear
      </button>
    </div>
  </div>

  <!-- Build log -->
  <div class="bg-gray-900 rounded-xl border border-gray-700 p-4">
    <div class="flex items-center justify-between mb-2">
      <span class="text-sm font-medium text-gray-300">Output</span>
      <span id="build-status" class="text-xs text-gray-500"></span>
    </div>
    <pre id="build-log" class="text-xs font-mono text-gray-300 whitespace-pre-wrap min-h-48 max-h-[50vh] overflow-y-auto"></pre>
  </div>

  <!-- Deploy targets -->
  <div>
    <h2 class="text-base font-semibold text-white mb-3">Deploy</h2>
    <div id="deploy-targets" class="grid grid-cols-2 gap-3">
      <div class="col-span-2 text-xs text-gray-500">Loading deploy targets…</div>
    </div>
    <!-- Download fallback — always visible -->
    <a href="/sites/${escHtml(siteId)}/build/download"
       class="mt-3 flex items-center justify-between gap-2 bg-gray-900 hover:bg-gray-800 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white text-sm rounded-xl px-4 py-3 transition-colors">
      <span class="font-medium">⬇ Download dist.tar.gz</span>
      <span class="text-xs text-gray-500">No platform needed</span>
    </a>
    <p class="text-xs text-gray-600 mt-3">
      Add deploy credentials to this site's <code class="text-indigo-400">.env</code> via the
      <a href="/sites/${escHtml(siteId)}/env" hx-get="/sites/${escHtml(siteId)}/env"
         hx-target="#content" hx-push-url="true"
         class="text-indigo-400 hover:underline">Env editor</a>
      to unlock deploy targets.
    </p>
  </div>
</div>

<script>(function() {
  const SITE_ID = '${escHtml(siteId)}';

  // ---- Deploy targets -------------------------------------------------------
  async function loadTargets() {
    const container = document.getElementById('deploy-targets');
    try {
      const resp = await fetch('/sites/' + SITE_ID + '/build/targets');
      const targets = await resp.json();
      container.innerHTML = targets.map(t => {
        if (t.available) {
          return \`<button
            onclick="startDeploy('\${t.id}', '\${t.label}')"
            class="flex items-center justify-between gap-2 bg-gray-800 hover:bg-indigo-700 border border-gray-700 hover:border-indigo-500 text-white text-sm rounded-xl px-4 py-3 transition-colors text-left">
            <span class="font-medium">\${t.label}</span>
            <span class="text-xs text-indigo-300">Deploy →</span>
          </button>\`;
        } else {
          const missing = t.missing.map(k => \`<code class="text-yellow-400">\${k}</code>\`).join(', ');
          const cfgHref = '/sites/' + SITE_ID + (t.configUrl ?? '/deploy/' + t.id);
          return \`<div title="Missing: \${t.missing.join(', ')}"
            class="flex flex-col gap-1 bg-gray-900 border border-gray-800 text-gray-600 text-sm rounded-xl px-4 py-3">
            <div class="flex items-center justify-between">
              <span class="font-medium">\${t.label}</span>
              <a href="\${cfgHref}"
                 hx-get="\${cfgHref}"
                 hx-target="#content"
                 hx-push-url="true"
                 class="text-xs text-indigo-400 hover:underline cursor-pointer">&#x2699; Configure &#x2192;</a>
            </div>
            <span class="text-xs text-gray-600">missing \${missing}</span>
          </div>\`;
        }
      }).join('') || '<div class="col-span-2 text-xs text-gray-500">No targets defined.</div>';
    } catch (e) {
      container.innerHTML = '<div class="col-span-2 text-xs text-red-400">Failed to load deploy targets.</div>';
    }
  }

  // ---- Stream helper --------------------------------------------------------
  async function streamTo(url, method, logEl, statusEl, doneBtn) {
    doneBtn.disabled = true;
    statusEl.textContent = 'Running…';
    statusEl.className = 'text-xs text-gray-400';
    logEl.textContent = '';

    try {
      const resp = await fetch(url, { method });
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\\n\\n');
        buf = parts.pop() ?? '';
        for (const part of parts) {
          if (part.startsWith('event: section')) {
            const label = part.split('\\n').find(l => l.startsWith('data:'))?.slice(5) ?? '';
            logEl.textContent += '\\n' + label + '\\n';
          } else if (part.startsWith('event: done')) {
            const exit = parseInt(part.split('\\n').find(l => l.startsWith('data:'))?.slice(5) ?? '0', 10);
            statusEl.textContent = exit === 0 ? '✓ Success' : '✗ Failed (exit ' + exit + ')';
            statusEl.className = 'text-xs ' + (exit === 0 ? 'text-green-400' : 'text-red-400');
          } else if (part.startsWith('data: ')) {
            logEl.textContent += part.slice(6) + '\\n';
            logEl.scrollTop = logEl.scrollHeight;
          }
        }
      }
    } catch (e) {
      logEl.textContent += '\\nError: ' + e.message;
      statusEl.textContent = '✗ Error';
      statusEl.className = 'text-xs text-red-400';
    } finally {
      doneBtn.disabled = false;
    }
  }

  // ---- Build ----------------------------------------------------------------
  window.startBuild = function(siteId) {
    const log = document.getElementById('build-log');
    const btn = document.getElementById('build-btn');
    const status = document.getElementById('build-status');
    btn.textContent = '⏳ Building…';
    streamTo('/sites/' + siteId + '/build', 'POST', log, status, btn)
      .then(() => { btn.textContent = '🔨 Build'; });
  };

  // ---- Test -----------------------------------------------------------------
  window.startTest = function(siteId) {
    const log = document.getElementById('build-log');
    const btn = document.getElementById('test-btn');
    const status = document.getElementById('build-status');
    btn.textContent = '⏳ Testing…';
    streamTo('/sites/' + siteId + '/build/test', 'POST', log, status, btn)
      .then(() => { btn.textContent = '✅ Run Tests'; });
  };

  // ---- Deploy ---------------------------------------------------------------
  window.startDeploy = function(targetId, targetLabel) {
    const log = document.getElementById('build-log');
    const status = document.getElementById('build-status');
    const btn = document.getElementById('build-btn');
    log.textContent = 'Deploying to ' + targetLabel + '…\\n';
    streamTo('/sites/' + SITE_ID + '/deploy/' + targetId, 'POST', log, status, btn);
  };

  document.addEventListener('DOMContentLoaded', loadTargets);
  // Also load immediately in case DOMContentLoaded already fired (HTMX swap)
  if (document.readyState !== 'loading') loadTargets();
})();</script>`;

  return htmx ? body : shell({ title: 'Build — Flint Manager', siteId, activeSection: 'build', body });
}
