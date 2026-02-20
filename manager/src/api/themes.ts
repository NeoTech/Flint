/**
 * API: Themes — list available themes, get active theme, set active theme.
 *
 * GET /sites/:id/themes              — list theme directories in themes/
 * GET /sites/:id/themes/active       — return current THEME value from .env
 * PUT /sites/:id/themes/active       — set THEME in .env (triggers a build)
 * GET /sites/:id/themes/:name/templates — list template filenames in themes/:name/templates/
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
import { getSite, resolveSitePath } from '../registry.js';
import { getComponentDefs, getTemplateTags } from '../lib/component-scanner.js';

/**
 * Returns component defs for a given template name.
 * Used by the New Page pane to populate its component section.
 *
 * GET /sites/:id/themes/components?template=xxx
 */
export function handleGetTemplateComponents(siteId: string, templateName: string): Response {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);
  const sitePath = resolveSitePath(site);
  try {
    const tags = getTemplateTags(sitePath, templateName || 'default');
    const allDefs = getComponentDefs(sitePath);
    const defs = allDefs.filter(d => tags.includes(d.tag));
    const tagToKey: Record<string, string> = {};
    for (const d of defs) tagToKey[d.tag] = d.frontmatterKey;
    const serialisable = defs.map(d => ({
      tag: d.tag, label: d.label, icon: d.icon,
      frontmatterKey: d.frontmatterKey, editorType: d.editorType,
    }));
    return json({ defs: serialisable, tagToKey });
  } catch {
    return json({ defs: [], tagToKey: {} });
  }
}

export function handleListThemes(siteId: string): Response {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);

  const themesDir = join(resolveSitePath(site), 'themes');
  if (!existsSync(themesDir)) return json([]);

  const themes = readdirSync(themesDir).filter(entry =>
    statSync(join(themesDir, entry)).isDirectory()
  );
  return json(themes);
}

export function handleGetActiveTheme(siteId: string): Response {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);

  const theme = readThemeFromEnv(resolveSitePath(site));
  return json({ theme: theme ?? 'default' });
}

export async function handleSetActiveTheme(siteId: string, req: Request): Promise<Response> {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);

  let body: { theme: string };
  try { body = (await req.json()) as { theme: string }; } catch { return error('Invalid JSON', 400); }
  if (!body.theme) return error('theme is required', 400);

  const sitePath = resolveSitePath(site);
  const themesDir = join(sitePath, 'themes');
  const themeDir = join(themesDir, body.theme);
  if (!existsSync(themeDir)) return error(`Theme not found: ${body.theme}`, 404);

  writeThemeToEnv(sitePath, body.theme);
  return json({ ok: true, theme: body.theme });
}

export function handleListTemplates(siteId: string, themeName: string): Response {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);

  const templatesDir = join(resolveSitePath(site), 'themes', themeName, 'templates');
  if (!existsSync(templatesDir)) return json([]);

  const templates = readdirSync(templatesDir)
    .filter(f => extname(f) === '.html')
    .map(f => ({
      name: f,
      content: readFileSync(join(templatesDir, f), 'utf-8'),
    }));

  return json(templates);
}

// ---- helpers ----------------------------------------------------------------

function readThemeFromEnv(sitePath: string): string | null {
  const envPath = join(sitePath, '.env');
  if (!existsSync(envPath)) return null;
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('THEME=')) {
      return trimmed.slice(6).trim() || null;
    }
  }
  return null;
}

function writeThemeToEnv(sitePath: string, theme: string): void {
  const envPath = join(sitePath, '.env');
  const raw = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';
  const lines = raw.split('\n');

  const idx = lines.findIndex(l => l.trim().startsWith('THEME='));
  if (idx >= 0) {
    lines[idx] = `THEME=${theme}`;
  } else {
    lines.push(`THEME=${theme}`);
  }

  writeFileSync(envPath, lines.join('\n'), 'utf-8');
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
function error(msg: string, status = 400): Response {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json' } });
}
function notFound(what: string): Response {
  return error(`Not found: ${what}`, 404);
}
