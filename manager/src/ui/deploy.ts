/**
 * UI: Deploy Config — edit per-service config files.
 *
 * GET /sites/:id/deploy             — overview cards for all 4 services
 * GET /sites/:id/deploy/:service    — config form for one service
 */
import { shell, escHtml } from './shell.js';
import { getSite } from '../registry.js';

// ---- Service metadata -------------------------------------------------------

interface ServiceField {
  key: string;
  label: string;
  type: 'text' | 'checkbox' | 'select' | 'json';
  placeholder: string;
  options?: string[];
  /** Show field only when the sibling deployType select has this value */
  showWhen?: string;
}

interface ServiceDef {
  id: string;
  label: string;
  icon: string;
  configFile: string;
  description: string;
  fields: ServiceField[];
}

const SERVICES: ServiceDef[] = [
  {
    id: 'cloudflare',
    label: 'Cloudflare Workers',
    icon: '&#x2601;',
    configFile: '',
    description: 'Configure via .env: CF_WORKER_NAME, CF_WORKER_MAIN, CF_WORKER_COMPAT_DATE, CLOUDFLARE_EMAIL, CLOUDFLARE_GLOBAL_API_KEY, CLOUDFLARE_ACCOUNT_ID. Deploy with: bun run deploy:checkout:cloudflare',
    fields: [],
  },
  {
    id: 'cloudflare-pages',
    label: 'Cloudflare Pages',
    icon: '&#x2601;',
    configFile: '',
    description: 'Requires a scoped API Token (not the Global API Key) with Cloudflare Pages:Edit permission — wrangler silently skips deployments without it. Create one at dash.cloudflare.com → Profile → API Tokens → Edit Cloudflare Workers template. Set in .env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CF_PAGES_PROJECT, CF_PAGES_DIR. Deploy with: bun run deploy:cloudflare:pages',
    fields: [],
  },
  {
    id: 'vercel',
    label: 'Vercel',
    icon: '&#x25b2;',
    configFile: 'vercel.json',
    description: 'Deploy to Vercel. Serverless functions are auto-detected from the api/ directory.',
    fields: [
      { key: 'outputDirectory', label: 'Output directory',  type: 'text',     placeholder: 'dist' },
      { key: 'buildCommand',    label: 'Build command',     type: 'text',     placeholder: 'bun run build' },
      { key: 'framework',       label: 'Framework preset',  type: 'text',     placeholder: 'Leave blank for static' },
      { key: 'cleanUrls',       label: 'Clean URLs',        type: 'checkbox', placeholder: '' },
      { key: 'trailingSlash',   label: 'Trailing slash',    type: 'checkbox', placeholder: '' },
    ],
  },
  {
    id: 'netlify',
    label: 'Netlify',
    icon: '&#x2665;',
    configFile: 'netlify.toml',
    description: 'Deploy to Netlify using the Netlify CLI. Supports serverless functions.',
    fields: [
      { key: 'publish',      label: 'Publish directory',   type: 'text', placeholder: 'dist' },
      { key: 'command',      label: 'Build command',       type: 'text', placeholder: 'bun run build' },
      { key: 'functionsDir', label: 'Functions directory', type: 'text', placeholder: 'netlify/functions (leave blank to omit)' },
    ],
  },
  {
    id: 'ghpages',
    label: 'GitHub Pages',
    icon: '&#x1f4e6;',
    configFile: '',
    description: 'Deploys static files directly to a GitHub repo branch via the gh-pages npm package. No config file needed \u2014 set GH_TOKEN and GH_REPO in the Env editor.',
    fields: [],
  },
];

// ---- Overview ---------------------------------------------------------------

export function renderDeploy(siteId: string, htmx = false): string {
  const site = getSite(siteId);
  if (!site) {
    const body = `<p class="text-red-400">Site not found: ${escHtml(siteId)}</p>`;
    return htmx ? body : shell({ title: 'Deploy — Flint Manager', body });
  }

  const body = `
<div class="flex flex-col gap-6 max-w-3xl">
  <div>
    <h1 class="text-2xl font-bold text-white">Deploy Config</h1>
    <p class="text-sm text-gray-400 mt-1">
      Configure your deploy targets. To trigger a deploy, use the
      <a href="/sites/${escHtml(siteId)}/build"
         hx-get="/sites/${escHtml(siteId)}/build" hx-target="#content" hx-push-url="true"
         class="text-indigo-400 hover:underline">Build page</a>.
    </p>
  </div>

  <div id="deploy-cards" class="grid grid-cols-2 gap-4">
    <div class="col-span-2 text-xs text-gray-500">Loading&#x2026;</div>
  </div>
</div>

<script>(function() {
  const SITE_ID = '${escHtml(siteId)}';

  const SERVICES = ${JSON.stringify(SERVICES.map(s => ({ id: s.id, label: s.label, icon: s.icon, configFile: s.configFile, description: s.description })))};

  async function loadCards() {
    const container = document.getElementById('deploy-cards');
    const results = await Promise.all(
      SERVICES.map(s =>
        fetch('/sites/' + SITE_ID + '/deploy/' + s.id + '/config')
          .then(r => r.json())
          .catch(() => ({ service: s.id, exists: false, envVars: [] }))
      )
    );

    container.innerHTML = results.map((r, i) => {
      const s = SERVICES[i];
      const allEnvSet = r.envVars?.every(v => v.set);
      const someEnvSet = r.envVars?.some(v => v.set);
      const statusDot = r.exists
        ? '<span class="w-2 h-2 rounded-full bg-green-500 shrink-0"></span>'
        : '<span class="w-2 h-2 rounded-full bg-gray-600 shrink-0"></span>';
      const envBadge = allEnvSet
        ? '<span class="text-xs text-green-400">&#x2713; Auth set</span>'
        : someEnvSet
          ? '<span class="text-xs text-yellow-400">&#x26a0; Auth partial</span>'
          : '<span class="text-xs text-gray-500">&#x2717; Auth missing</span>';

      return \`<a
        href="/sites/\${SITE_ID}/deploy/\${s.id}"
        hx-get="/sites/\${SITE_ID}/deploy/\${s.id}"
        hx-target="#content"
        hx-push-url="true"
        class="flex flex-col gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-indigo-500 text-white rounded-xl p-4 transition-colors cursor-pointer">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            \${statusDot}
            <span class="font-medium text-sm">\${s.label}</span>
          </div>
          <span class="text-gray-500 text-xs">\${s.icon}</span>
        </div>
        <p class="text-xs text-gray-400">\${s.description}</p>
        <div class="flex items-center justify-between mt-1">
          <code class="text-xs text-gray-500">\${s.configFile}</code>
          \${envBadge}
        </div>
        <div class="flex items-center justify-between">
          <span class="text-xs \${r.exists ? 'text-green-400' : 'text-gray-500'}">\${r.exists ? '&#x2713; Config exists' : '&#x25cb; No config yet'}</span>
          <span class="text-xs text-indigo-400">Configure &#x2192;</span>
        </div>
      </a>\`;
    }).join('');
  }

  if (document.readyState !== 'loading') loadCards();
  else document.addEventListener('DOMContentLoaded', loadCards);
})();</script>`;

  return htmx ? body : shell({ title: 'Deploy — Flint Manager', siteId, activeSection: 'deploy', body });
}

// ---- Per-service form -------------------------------------------------------

export function renderDeployForm(siteId: string, service: string, htmx = false): string {
  const site = getSite(siteId);
  if (!site) {
    const body = `<p class="text-red-400">Site not found: ${escHtml(siteId)}</p>`;
    return htmx ? body : shell({ title: 'Deploy Config — Flint Manager', body });
  }

  const svcMeta = SERVICES.find(s => s.id === service);
  if (!svcMeta) {
    const body = `<p class="text-red-400">Unknown service: ${escHtml(service)}</p>`;
    return htmx ? body : shell({ title: 'Deploy Config — Flint Manager', body });
  }

  // Serialise field descriptors for client-side rendering
  const fieldsJson = JSON.stringify(svcMeta.fields.map(f => ({
    key: f.key, label: f.label, type: f.type, placeholder: f.placeholder,
    options: f.options, showWhen: f.showWhen,
  })));

  const body = `
<div class="flex flex-col gap-6 max-w-2xl">
  <div class="flex items-center gap-3">
    <a href="/sites/${escHtml(siteId)}/deploy"
       hx-get="/sites/${escHtml(siteId)}/deploy" hx-target="#content" hx-push-url="true"
       class="text-gray-400 hover:text-white text-sm">&#x2190; Deploy Config</a>
    <span class="text-gray-700">/</span>
    <h1 class="text-xl font-bold text-white">${escHtml(svcMeta.label)}</h1>
  </div>

  <!-- Config file info -->
  ${svcMeta.configFile ? `
  <div class="bg-gray-800 border border-gray-700 rounded-xl p-4 text-sm text-gray-300">
    Config file: <code class="text-indigo-300">${escHtml(svcMeta.configFile)}</code>
    <span id="config-exists-badge" class="ml-3 text-xs text-gray-500">checking&#x2026;</span>
  </div>` : `
  <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-gray-400 italic">
    No config file &#x2014; this service is configured entirely via environment variables.
  </div>`}

  <!-- Auth status -->
  <div id="env-status" class="bg-gray-900 border border-gray-800 rounded-xl p-4">
    <div class="text-xs text-gray-500">Loading auth status&#x2026;</div>
  </div>

  <!-- Form -->
  ${svcMeta.fields.length > 0 ? `
  <form id="deploy-config-form" onsubmit="window.saveDeployConfig(event)" class="flex flex-col gap-4">
    <div id="form-fields" class="flex flex-col gap-4">
      <div class="text-xs text-gray-500">Loading config&#x2026;</div>
    </div>

    <div class="flex items-center gap-3 pt-2">
      <button type="submit"
        class="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium">
        Save Config
      </button>
      <span id="save-status" class="text-xs text-gray-500"></span>
    </div>
  </form>` : ''}

  <!-- Deploy -->
  <div class="flex flex-col gap-3 pt-4 border-t border-gray-800">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold text-white">Deploy</h2>
      <span id="deploy-run-status" class="text-xs text-gray-500"></span>
    </div>
    <pre id="deploy-log" class="bg-gray-900 border border-gray-800 rounded-xl p-3 text-xs font-mono text-gray-300 whitespace-pre-wrap min-h-[3rem] max-h-64 overflow-y-auto"></pre>
    <button id="deploy-run-btn" onclick="window.startServiceDeploy()"
      class="self-start text-sm bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium">
      &#x25b6; Deploy ${escHtml(svcMeta.label)}
    </button>
  </div>
</div>

<script>(function() {
  const SITE_ID   = '${escHtml(siteId)}';
  const SERVICE   = '${escHtml(service)}';
  const FIELDS    = ${fieldsJson};

  let currentConfig = {};

  function renderField(f, value) {
    const showAttr = f.showWhen ? ' data-show-when="' + f.showWhen + '"' : '';
    if (f.type === 'checkbox') {
      const checked = value ? 'checked' : '';
      return \`<label\${showAttr} class="flex items-center gap-3 text-sm text-gray-200 cursor-pointer">
        <input type="checkbox" id="field-\${f.key}" name="\${f.key}" \${checked}
          class="w-4 h-4 rounded bg-gray-700 border-gray-600 text-indigo-500 focus:ring-indigo-500">
        <span>\${f.label}</span>
      </label>\`;
    }
    if (f.type === 'select') {
      const opts = (f.options ?? []).map(o =>
        \`<option value="\${o}"\${value === o ? ' selected' : ''}>\${o}</option>\`
      ).join('');
      return \`<div\${showAttr} class="flex flex-col gap-1">
        <label for="field-\${f.key}" class="text-xs font-medium text-gray-400">\${f.label}</label>
        <select id="field-\${f.key}" name="\${f.key}"
          onchange="window.__deployFieldChange && window.__deployFieldChange(this)"
          class="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          \${opts}
        </select>
      </div>\`;
    }
    if (f.type === 'json') {
      const jsonVal = typeof value === 'object' && value !== null
        ? JSON.stringify(value, null, 2)
        : (value ?? '{}');
      return \`<div\${showAttr} class="flex flex-col gap-1">
        <label for="field-\${f.key}" class="text-xs font-medium text-gray-400">\${f.label}</label>
        <textarea id="field-\${f.key}" name="\${f.key}" rows="4"
          placeholder="\${f.placeholder}"
          class="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-600">\${jsonVal}</textarea>
        <p class="text-xs text-gray-600">JSON object — e.g. {&quot;MY_VAR&quot;: &quot;value&quot;}</p>
      </div>\`;
    }
    return \`<div\${showAttr} class="flex flex-col gap-1">
      <label for="field-\${f.key}" class="text-xs font-medium text-gray-400">\${f.label}</label>
      <input id="field-\${f.key}" name="\${f.key}" type="text"
        value="\${String(value ?? '').replace(/"/g, '&quot;')}"
        placeholder="\${f.placeholder}"
        class="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-600">
    </div>\`;
  }

  function applyFieldVisibility() {
    const typeEl = document.getElementById('field-deployType');
    if (!typeEl) return;
    const deployType = typeEl.value;
    document.querySelectorAll('[data-show-when]').forEach(el => {
      el.style.display = el.dataset.showWhen === deployType ? '' : 'none';
    });
  }

  window.__deployFieldChange = function(el) {
    if (el.name === 'deployType') applyFieldVisibility();
  };

  async function loadConfig() {
    try {
      const resp = await fetch('/sites/' + SITE_ID + '/deploy/' + SERVICE + '/config');
      const data = await resp.json();
      currentConfig = data.config ?? {};

      // Exists badge (only rendered when configFile is non-empty)
      const badge = document.getElementById('config-exists-badge');
      if (badge) {
        badge.innerHTML = data.exists ? '&#x2713; file exists' : '&#x25cb; file not created yet';
        badge.className = 'ml-3 text-xs ' + (data.exists ? 'text-green-400' : 'text-gray-500');
      }

      // Auth status
      const envEl = document.getElementById('env-status');
      const envRows = (data.envVars ?? []).map(v => \`
        <div class="flex items-center justify-between py-1">
          <code class="text-xs text-gray-300">\${v.name}</code>
          \${v.set
            ? '<span class="text-xs text-green-400">&#x2713; set</span>'
            : \`<span class="text-xs text-red-400">&#x2717; missing &mdash;
                <a href="/sites/\${SITE_ID}/env" hx-get="/sites/\${SITE_ID}/env"
                   hx-target="#content" hx-push-url="true"
                   class="text-indigo-400 hover:underline">add in Env</a></span>\`
          }
        </div>\`).join('');
      envEl.innerHTML = \`
        <div class="text-xs font-medium text-gray-400 mb-2">Required credentials</div>
        \${envRows || '<div class="text-xs text-gray-600">None required.</div>'}\`;

      // Form fields (only rendered when service has fields)
      const ffEl = document.getElementById('form-fields');
      if (ffEl) {
        ffEl.innerHTML = FIELDS.map(f => renderField(f, currentConfig[f.key])).join('');
        // Apply conditional visibility after rendering
        applyFieldVisibility();
      }
    } catch (e) {
      document.getElementById('form-fields').innerHTML =
        '<div class="text-xs text-red-400">Failed to load config: ' + e.message + '</div>';
    }
  }

  window.saveDeployConfig = async function(e) {
    e.preventDefault();
    const status = document.getElementById('save-status');
    status.innerHTML = 'Saving&#x2026;';
    status.className = 'text-xs text-gray-400';

    const payload = {};
    for (const f of FIELDS) {
      const el = document.getElementById('field-' + f.key);
      if (!el) continue;
      if (f.type === 'checkbox') {
        payload[f.key] = el.checked;
      } else if (f.type === 'json') {
        try { payload[f.key] = JSON.parse(el.value || '{}'); } catch { payload[f.key] = {}; }
      } else {
        payload[f.key] = el.value;
      }
    }

    try {
      const resp = await fetch('/sites/' + SITE_ID + '/deploy/' + SERVICE + '/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (resp.ok) {
        status.innerHTML = '&#x2713; Saved to ' + data.configFile;
        status.className = 'text-xs text-green-400';
        // Refresh to show exists badge update
        setTimeout(loadConfig, 600);
      } else {
        status.innerHTML = '&#x2717; ' + (data.error ?? 'Unknown error');
        status.className = 'text-xs text-red-400';
      }
    } catch (err) {
      status.innerHTML = '&#x2717; ' + err.message;
      status.className = 'text-xs text-red-400';
    }
  };

  // ---- Deploy stream -------------------------------------------------------
  async function streamDeploy(url) {
    const logEl    = document.getElementById('deploy-log');
    const statusEl = document.getElementById('deploy-run-status');
    const btn      = document.getElementById('deploy-run-btn');
    btn.disabled = true;
    btn.textContent = '\\u23f3 Deploying\\u2026';
    statusEl.textContent = 'Running\\u2026';
    statusEl.className = 'text-xs text-gray-400';
    logEl.textContent = '';

    try {
      const resp = await fetch(url, { method: 'POST' });
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
            logEl.textContent += '\\n\\u25ba ' + label + '\\n';
          } else if (part.startsWith('event: done')) {
            const exit = parseInt(part.split('\\n').find(l => l.startsWith('data:'))?.slice(5) ?? '0', 10);
            statusEl.innerHTML = exit === 0 ? '&#x2713; Success' : '&#x2717; Failed (exit ' + exit + ')';
            statusEl.className = 'text-xs ' + (exit === 0 ? 'text-green-400' : 'text-red-400');
          } else if (part.startsWith('data: ')) {
            logEl.textContent += part.slice(6) + '\\n';
            logEl.scrollTop = logEl.scrollHeight;
          }
        }
      }
    } catch (e) {
      logEl.textContent += '\\nError: ' + e.message;
      statusEl.innerHTML = '&#x2717; Error';
      statusEl.className = 'text-xs text-red-400';
    } finally {
      btn.disabled = false;
      btn.textContent = '\\u25b6 Deploy ${escHtml(svcMeta.label)}';
    }
  }

  window.startServiceDeploy = function() {
    streamDeploy('/sites/' + SITE_ID + '/deploy/' + SERVICE);
  };

  if (document.readyState !== 'loading') loadConfig();
  else document.addEventListener('DOMContentLoaded', loadConfig);
})();</script>`;

  return htmx ? body : shell({ title: `${svcMeta.label} Config — Flint Manager`, siteId, activeSection: 'deploy', body });
}
