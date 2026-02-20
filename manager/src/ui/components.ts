/**
 * UI: Components — reference browser for all Flint components.
 *
 * Shows every available {{tag}}, its frontmatter key, prop schema,
 * YAML example, and which templates include it.
 */
import { shell, escHtml } from './shell.js';
import { getSite, resolveSitePath } from '../registry.js';
import { getComponentDefs, type ComponentDef } from '../lib/component-scanner.js';


export function renderComponents(siteId: string, htmx = false): string {
  const site = getSite(siteId);
  if (!site) {
    return shell({ title: 'Components', body: `<p class="text-red-400">Site not found: ${escHtml(siteId)}</p>` });
  }

  const sitePath = resolveSitePath(site);
  const defs = getComponentDefs(sitePath);

  const body = `
<div class="flex gap-4" style="height:calc(100vh - 5rem)">
  <!-- Component list sidebar -->
  <div class="w-64 shrink-0 flex flex-col bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
    <div class="px-3 py-2.5 border-b border-gray-800">
      <span class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Components</span>
      <p class="text-xs text-gray-600 mt-0.5">${defs.length} discovered</p>
    </div>
    <div class="flex-1 overflow-y-auto py-1">
      ${defs.map(d => componentListItem(d)).join('')}
    </div>
  </div>

  <!-- Detail panel -->
  <div class="flex-1 overflow-y-auto bg-gray-900 rounded-xl border border-gray-800 p-6" id="comp-detail">
    ${renderWelcomePanel(defs)}
  </div>
</div>

<script>
function showComponent(tag) {
  fetch('/sites/${escHtml(siteId)}/components/' + tag, { headers: { 'HX-Request': 'true' } })
    .then(r => r.text())
    .then(html => { document.getElementById('comp-detail').innerHTML = html; });

  document.querySelectorAll('[data-comp-tag]').forEach(el => {
    const active = el.getAttribute('data-comp-tag') === tag;
    el.classList.toggle('bg-indigo-800', active);
    el.classList.toggle('text-white', active);
    el.classList.toggle('text-gray-300', !active);
    el.classList.toggle('hover:bg-gray-800', !active);
  });
}
</script>`;

  return htmx ? body : shell({ title: 'Components — Flint Manager', siteId, activeSection: 'components', body });
}

export function renderComponentDetail(siteId: string, tag: string): string {
  const site = getSite(siteId);
  if (!site) return '<p class="text-red-400">Site not found</p>';
  const defs = getComponentDefs(resolveSitePath(site));
  const def = defs.find(d => d.tag === tag);
  if (!def) return `<p class="text-red-400">Component not found: ${escHtml(tag)}</p>`;

  return renderDetailPanel(def);
}

// ---------------------------------------------------------------------------
// Private renderers
// ---------------------------------------------------------------------------

function componentListItem(def: ComponentDef): string {
  return `
<button data-comp-tag="${escHtml(def.tag)}"
  onclick="showComponent('${escHtml(def.tag)}')"
  class="w-full flex items-center gap-2 py-2 px-3 rounded-md text-left transition-colors text-gray-300 hover:bg-gray-800">
  <span class="text-base shrink-0">${def.icon}</span>
  <div class="min-w-0">
    <div class="text-xs font-medium truncate">${escHtml(def.label)}</div>
    <div class="text-xs text-gray-600 font-mono truncate">{{${escHtml(def.tag)}}}</div>
  </div>
</button>`;
}

function renderWelcomePanel(defs: ComponentDef[]): string {
  const withFm = defs.filter(d => d.frontmatterKey);
  const noFm = defs.filter(d => !d.frontmatterKey);

  return `
<div class="max-w-3xl">
  <h1 class="text-2xl font-bold text-white mb-2">Components</h1>
  <p class="text-gray-400 text-sm mb-8">
    Components are reusable UI blocks rendered server-side at build time.
    They're wired into templates via <code class="bg-gray-800 px-1 rounded text-indigo-300">{{tag}}</code> placeholders
    and driven by <strong class="text-gray-200">frontmatter fields</strong> in your Markdown pages.
    Select a component from the sidebar to see its props and usage.
  </p>

  <div class="grid grid-cols-2 gap-3 mb-8">
    <div class="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <p class="text-3xl font-bold text-indigo-400">${defs.length}</p>
      <p class="text-xs text-gray-400 mt-1">Total components</p>
    </div>
    <div class="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <p class="text-3xl font-bold text-green-400">${withFm.length}</p>
      <p class="text-xs text-gray-400 mt-1">With frontmatter config</p>
    </div>
  </div>

  <h2 class="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">Configurable via frontmatter</h2>
  <div class="grid grid-cols-2 gap-2 mb-6">
    ${withFm.map(d => miniCard(d)).join('')}
  </div>

  <h2 class="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">Auto-rendered (no config needed)</h2>
  <div class="grid grid-cols-2 gap-2">
    ${noFm.map(d => miniCard(d)).join('')}
  </div>
</div>`;
}

function miniCard(def: ComponentDef): string {
  return `
<button onclick="showComponent('${escHtml(def.tag)}')"
  class="flex items-center gap-2 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-indigo-500 rounded-xl p-3 text-left transition-colors group">
  <span class="text-xl shrink-0">${def.icon}</span>
  <div class="min-w-0">
    <div class="text-xs font-medium text-white truncate">${escHtml(def.label)}</div>
    <div class="text-xs text-gray-500 font-mono truncate">{{${escHtml(def.tag)}}}</div>
  </div>
</button>`;
}

function renderDetailPanel(def: ComponentDef): string {
  const hasProps = def.props.length > 0;
  const hasFm = !!def.frontmatterKey;
  const usedIn = def.usedInTemplates ?? [];

  return `
<div class="max-w-3xl">
  <!-- Header -->
  <div class="flex items-start gap-3 mb-6">
    <span class="text-5xl">${def.icon}</span>
    <div>
      <h1 class="text-2xl font-bold text-white">${escHtml(def.label)}</h1>
      <div class="flex items-center gap-2 mt-1">
        <code class="bg-gray-800 border border-gray-700 text-indigo-300 px-2 py-0.5 rounded text-sm font-mono">{{${escHtml(def.tag)}}}</code>
        ${hasFm ? `<code class="bg-gray-800 border border-gray-700 text-amber-300 px-2 py-0.5 rounded text-sm font-mono">${escHtml(def.frontmatterKey)}:</code>` : '<span class="text-xs text-gray-500 italic">no frontmatter</span>'}
      </div>
    </div>
  </div>

  <p class="text-gray-300 text-sm mb-6 leading-relaxed">${escHtml(def.description)}</p>

  <!-- Used in templates -->
  ${usedIn.length > 0 ? `
  <div class="mb-6">
    <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Used in templates</h2>
    <div class="flex flex-wrap gap-2">
      ${usedIn.map(t => `<span class="bg-indigo-900 border border-indigo-700 text-indigo-300 text-xs px-2 py-1 rounded-md font-mono">${escHtml(t)}</span>`).join('')}
    </div>
  </div>` : ''}

  <!-- Props table -->
  ${hasProps && hasFm ? `
  <div class="mb-6">
    <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Props</h2>
    <div class="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-gray-700">
            <th class="px-3 py-2 text-left text-gray-400 font-medium w-32">Field</th>
            <th class="px-3 py-2 text-left text-gray-400 font-medium w-8">Req?</th>
            <th class="px-3 py-2 text-left text-gray-400 font-medium w-40">Type</th>
            <th class="px-3 py-2 text-left text-gray-400 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          ${def.props.map((p, i) => `
          <tr class="${i % 2 === 0 ? '' : 'bg-gray-750'}">
            <td class="px-3 py-2 font-mono text-amber-300">${escHtml(p.name)}</td>
            <td class="px-3 py-2 text-center">${p.optional ? '<span class="text-gray-600">–</span>' : '<span class="text-green-400">✓</span>'}</td>
            <td class="px-3 py-2 font-mono text-blue-300 text-xs">${escHtml(p.type.slice(0, 40))}</td>
            <td class="px-3 py-2 text-gray-400">${escHtml(p.doc)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>` : !hasFm ? `
  <div class="mb-6 bg-gray-800 border border-gray-700 rounded-xl p-4 text-xs text-gray-400">
    This component requires no frontmatter configuration — just add the
    <code class="text-indigo-300">{{${escHtml(def.tag)}}}</code> tag to your template and it renders automatically.
  </div>` : ''}

  <!-- YAML example -->
  ${hasFm ? `
  <div class="mb-6">
    <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Frontmatter YAML example</h2>
    <div class="relative">
      <pre class="bg-gray-950 border border-gray-700 rounded-xl p-4 text-xs font-mono text-green-300 overflow-x-auto">${escHtml(buildYamlExample(def))}</pre>
      <button onclick="copyYaml('yaml-${escHtml(def.tag)}')"
        class="absolute top-2 right-2 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded-md transition-colors">
        Copy
      </button>
      <textarea id="yaml-${escHtml(def.tag)}" class="sr-only">${escHtml(buildYamlExample(def))}</textarea>
    </div>
  </div>` : ''}

  <!-- Editor type badge -->
  ${def.editorType !== 'none' && def.editorType !== 'yaml' ? `
  <div class="flex items-center gap-2 text-xs text-gray-500 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3">
    <span class="text-green-400">✓</span>
    <span>This component has a <strong class="text-white">structured visual editor</strong>
    available in the page editor. Open any page that uses the
    <code class="text-indigo-300">${escHtml(def.usedInTemplates?.[0] ?? 'landing')}</code> template to configure it.</span>
  </div>` : ''}
</div>

<script>
function copyYaml(id) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.value).then(() => {
    const btn = event.target.closest('button');
    if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy'; }, 1500); }
  });
}
</script>`;
}

// ---------------------------------------------------------------------------
// YAML example generator
// ---------------------------------------------------------------------------

function buildYamlExample(def: ComponentDef): string {
  const lines: string[] = [];

  switch (def.tag) {
    case 'hero':
    case 'call-to-action':
      lines.push(`${def.frontmatterKey}:`);
      lines.push(`  heading: "Build Something Amazing"`);
      lines.push(`  tagline: "Introducing our platform"`);
      lines.push(`  subtitle: "A short description of what you offer."`);
      lines.push(`  primaryCta:`);
      lines.push(`    label: "Get Started"`);
      lines.push(`    href: "/docs"`);
      lines.push(`  secondaryCta:`);
      lines.push(`    label: "Learn More"`);
      lines.push(`    href: "/about"`);
      break;

    case 'feature-grid':
    case 'showcase-grid':
      lines.push(`${def.frontmatterKey}:`);
      lines.push(`  heading: "Our Features"`);
      lines.push(`  subtitle: "Everything you need to build great sites."`);
      lines.push(`  items:`);
      lines.push(`    - icon: "⚡"`);
      lines.push(`      title: "Fast Builds"`);
      lines.push(`      description: "Compiles to static HTML in milliseconds."`);
      lines.push(`      color: blue`);
      lines.push(`    - icon: "🎨"`);
      lines.push(`      title: "Tailwind Styling"`);
      lines.push(`      description: "Full Tailwind CSS support out of the box."`);
      lines.push(`      href: "/docs/styling"`);
      lines.push(`      color: purple`);
      break;

    case 'stats-bar':
      lines.push(`Stats:`);
      lines.push(`  stats:`);
      lines.push(`    - value: "10k+"`);
      lines.push(`      label: "Sites Built"`);
      lines.push(`      color: blue`);
      lines.push(`    - value: "99.9%"`);
      lines.push(`      label: "Uptime"`);
      lines.push(`      color: green`);
      lines.push(`    - value: "<100ms"`);
      lines.push(`      label: "Build Time"`);
      lines.push(`      color: amber`);
      break;

    case 'skill-cards':
      lines.push(`Skills:`);
      lines.push(`  - name: TypeScript`);
      lines.push(`    icon: "🔷"`);
      lines.push(`    description: "Strong typing for reliable code."`);
      lines.push(`    tags: [types, compile, strict]`);
      lines.push(`    color: blue`);
      lines.push(`  - name: Tailwind CSS`);
      lines.push(`    icon: "🎨"`);
      lines.push(`    description: "Utility-first CSS framework."`);
      lines.push(`    tags: [css, design, responsive]`);
      lines.push(`    color: teal`);
      break;

    default:
      for (const prop of def.props.slice(0, 5)) {
        lines.push(`  ${prop.name}: ${exampleValue(prop.type, prop.name)}`);
      }
      if (lines.length) lines.unshift(`${def.frontmatterKey}:`);
  }

  return lines.join('\n');
}

function exampleValue(type: string, name: string): string {
  if (type.includes('string')) return `"example"`;
  if (type.includes('number')) return `42`;
  if (type.includes('boolean')) return `true`;
  if (name === 'color') return `blue`;
  if (type.includes('[]')) return `[]`;
  return `"..."`;
}
