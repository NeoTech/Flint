/**
 * API: Themes — list available themes, get active theme, set active theme.
 *
 * GET /sites/:id/themes              — list theme directories in themes/
 * GET /sites/:id/themes/active       — return current THEME value from .env
 * PUT /sites/:id/themes/active       — set THEME in .env (triggers a build)
 * GET /sites/:id/themes/:name/templates — list template filenames in themes/:name/templates/
 * GET /sites/:id/themes/:name/files  — list all editable files in a theme (html/css/js)
 * PUT /sites/:id/themes/:name/files/*path — save any editable theme file
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, unlinkSync, mkdirSync, renameSync, rmSync } from 'fs';
import { join, extname, basename, normalize } from 'path';
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

const EDITABLE_EXTS = new Set(['.html', '.css', '.js']);

export function handleListThemeFiles(siteId: string, themeName: string): Response {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);

  const themeDir = join(resolveSitePath(site), 'themes', themeName);
  if (!existsSync(themeDir)) return error(`Theme not found: ${themeName}`, 404);

  return json(collectThemeFiles(themeDir, themeDir));
}

export async function handleCreateThemeFile(siteId: string, themeName: string, relPath: string, req: Request): Promise<Response> {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);
  if (!isSafeRelPath(relPath)) return error('Invalid file path', 400);
  const ext = extname(relPath);
  if (!EDITABLE_EXTS.has(ext)) return error(`Unsupported file type: ${ext}`, 400);

  const filePath = join(resolveSitePath(site), 'themes', themeName, relPath);
  if (existsSync(filePath)) return error(`File already exists: ${relPath}`, 409);
  mkdirSync(join(filePath, '..'), { recursive: true });

  const defaults: Record<string, string> = {
    '.html': '<!DOCTYPE html>\n<html>\n<head>\n  {{head}}\n</head>\n<body>\n  {{content}}\n</body>\n</html>',
    '.css': '/* styles */\n',
    '.js': '/* scripts */\n',
  };
  let content = defaults[ext] ?? '';
  try {
    const body = (await req.json()) as { content?: string };
    if (typeof body.content === 'string') content = body.content;
  } catch { /* use default */ }

  writeFileSync(filePath, content, 'utf-8');
  return json({ ok: true, file: relPath, content });
}

export async function handleRenameThemeFile(siteId: string, themeName: string, relPath: string, req: Request): Promise<Response> {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);
  if (!isSafeRelPath(relPath)) return error('Invalid file path', 400);

  const oldPath = join(resolveSitePath(site), 'themes', themeName, relPath);
  if (!existsSync(oldPath)) return error(`File not found: ${relPath}`, 404);

  let body: { newName: string };
  try { body = (await req.json()) as { newName: string }; } catch { return error('Invalid JSON', 400); }
  if (!isSafeFileName(body.newName)) return error('Invalid new name', 400);
  if (extname(body.newName) !== extname(relPath)) return error('Cannot change file extension on rename', 400);

  const dir = relPath.includes('/') ? relPath.slice(0, relPath.lastIndexOf('/') + 1) : '';
  const newRelPath = dir + body.newName;
  const newPath = join(resolveSitePath(site), 'themes', themeName, newRelPath);
  if (existsSync(newPath)) return error(`File already exists: ${newRelPath}`, 409);

  const content = readFileSync(oldPath, 'utf-8');
  writeFileSync(newPath, content, 'utf-8');
  unlinkSync(oldPath);
  return json({ ok: true, newRelativePath: newRelPath });
}

export async function handleSaveThemeFile(siteId: string, themeName: string, relPath: string, req: Request): Promise<Response> {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);
  if (!isSafeRelPath(relPath)) return error('Invalid file path', 400);
  if (!EDITABLE_EXTS.has(extname(relPath))) return error('File type not editable', 400);

  const filePath = join(resolveSitePath(site), 'themes', themeName, relPath);
  if (!existsSync(filePath)) return error(`File not found: ${relPath}`, 404);

  let body: { content: string };
  try { body = (await req.json()) as { content: string }; } catch { return error('Invalid JSON', 400); }
  if (typeof body.content !== 'string') return error('content must be a string', 400);

  writeFileSync(filePath, body.content, 'utf-8');
  return json({ ok: true, file: relPath });
}

export function handleDeleteThemeFile(siteId: string, themeName: string, relPath: string): Response {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);
  if (!isSafeRelPath(relPath)) return error('Invalid file path', 400);

  // Protect the primary stylesheet
  if (relPath === 'styles/main.css') return error('Cannot delete styles/main.css', 400);

  const themeDir = join(resolveSitePath(site), 'themes', themeName);
  const filePath = join(themeDir, relPath);
  if (!existsSync(filePath)) return error(`File not found: ${relPath}`, 404);

  // Template guard: must keep at least one .html template
  if (relPath.startsWith('templates/') && extname(relPath) === '.html') {
    const templatesDir = join(themeDir, 'templates');
    const remaining = readdirSync(templatesDir).filter(f => extname(f) === '.html');
    if (remaining.length <= 1) return error('Cannot delete the last template file', 400);
  }

  unlinkSync(filePath);
  return json({ ok: true, file: relPath });
}

function collectThemeFiles(
  dir: string,
  themeRoot: string,
): Array<{ name: string; relativePath: string; content: string }> {
  const results: Array<{ name: string; relativePath: string; content: string }> = [];
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectThemeFiles(full, themeRoot));
    } else if (EDITABLE_EXTS.has(extname(entry))) {
      const relativePath = full.slice(themeRoot.length + 1).replace(/\\/g, '/');
      results.push({ name: entry, relativePath, content: readFileSync(full, 'utf-8') });
    }
  }
  return results;
}

/** Allow sub-paths like styles/main.css but reject any traversal. */
function isSafeRelPath(relPath: string): boolean {
  if (!relPath) return false;
  const norm = normalize(relPath).replace(/\\/g, '/');
  return !norm.startsWith('..') && !norm.includes('/../') && !relPath.startsWith('/');
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

const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  {{head}}
</head>
<body class="min-h-screen bg-white text-gray-900">
  {{navigation}}
  <main class="max-w-4xl mx-auto px-4 py-8">
    {{content}}
  </main>
  {{foot-scripts}}
</body>
</html>`;

const DEFAULT_CSS = `@tailwind base;
@tailwind components;
@tailwind utilities;
`;

export async function handleCreateTheme(siteId: string, req: Request): Promise<Response> {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);

  let body: { name: string };
  try { body = (await req.json()) as { name: string }; } catch { return error('Invalid JSON', 400); }
  const name = (body.name ?? '').trim();
  if (!isSafeDirName(name)) return error('Invalid theme name (use letters, numbers, hyphens, underscores only)', 400);

  const themeDir = join(resolveSitePath(site), 'themes', name);
  if (existsSync(themeDir)) return error(`Theme already exists: ${name}`, 409);

  mkdirSync(join(themeDir, 'templates'), { recursive: true });
  mkdirSync(join(themeDir, 'styles'), { recursive: true });
  writeFileSync(join(themeDir, 'templates', 'default.html'), DEFAULT_TEMPLATE, 'utf-8');
  writeFileSync(join(themeDir, 'styles', 'main.css'), DEFAULT_CSS, 'utf-8');

  return json({ ok: true, name });
}

export async function handleRenameTheme(siteId: string, themeName: string, req: Request): Promise<Response> {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);

  let body: { newName: string };
  try { body = (await req.json()) as { newName: string }; } catch { return error('Invalid JSON', 400); }
  const newName = (body.newName ?? '').trim();
  if (!isSafeDirName(newName)) return error('Invalid theme name (use letters, numbers, hyphens, underscores only)', 400);
  if (newName === themeName) return json({ ok: true, name: themeName });

  const sitePath = resolveSitePath(site);
  const oldDir = join(sitePath, 'themes', themeName);
  const newDir = join(sitePath, 'themes', newName);
  if (!existsSync(oldDir)) return error(`Theme not found: ${themeName}`, 404);
  if (existsSync(newDir)) return error(`Theme already exists: ${newName}`, 409);

  renameSync(oldDir, newDir);

  // If this was the active theme, update .env
  const active = readThemeFromEnv(sitePath);
  if (active === themeName) writeThemeToEnv(sitePath, newName);

  return json({ ok: true, name: newName });
}

export function handleDeleteTheme(siteId: string, themeName: string): Response {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);

  const sitePath = resolveSitePath(site);
  const themeDir = join(sitePath, 'themes', themeName);
  if (!existsSync(themeDir)) return error(`Theme not found: ${themeName}`, 404);

  const active = readThemeFromEnv(sitePath) ?? 'default';
  if (active === themeName) return error('Cannot delete the active theme. Activate another theme first.', 400);

  const themesDir = join(sitePath, 'themes');
  const remaining = readdirSync(themesDir).filter(e => statSync(join(themesDir, e)).isDirectory());
  if (remaining.length <= 1) return error('Cannot delete the only remaining theme', 400);

  rmSync(themeDir, { recursive: true, force: true });
  return json({ ok: true, name: themeName });
}

/** Theme names: letters, numbers, hyphens, underscores only. */
function isSafeDirName(name: string): boolean {
  return !!name && /^[a-zA-Z0-9_-]+$/.test(name);
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

export async function handleSaveTemplate(siteId: string, themeName: string, fileName: string, req: Request): Promise<Response> {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);
  if (!isSafeFileName(fileName)) return error('Invalid file name', 400);

  const templatesDir = join(resolveSitePath(site), 'themes', themeName, 'templates');
  if (!existsSync(templatesDir)) return error('Templates directory not found', 404);

  const filePath = join(templatesDir, fileName);
  if (!existsSync(filePath)) return error(`Template not found: ${fileName}`, 404);

  let body: { content: string };
  try { body = (await req.json()) as { content: string }; } catch { return error('Invalid JSON', 400); }
  if (typeof body.content !== 'string') return error('content must be a string', 400);

  writeFileSync(filePath, body.content, 'utf-8');
  return json({ ok: true, file: fileName });
}

export async function handleCreateTemplate(siteId: string, themeName: string, fileName: string, req: Request): Promise<Response> {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);
  if (!isSafeFileName(fileName)) return error('Invalid file name', 400);
  if (extname(fileName) !== '.html') return error('File must have .html extension', 400);

  const templatesDir = join(resolveSitePath(site), 'themes', themeName, 'templates');
  mkdirSync(templatesDir, { recursive: true });

  const filePath = join(templatesDir, fileName);
  if (existsSync(filePath)) return error(`File already exists: ${fileName}`, 409);

  let content = '<!DOCTYPE html>\n<html>\n<head>\n  {{head}}\n</head>\n<body>\n  {{content}}\n</body>\n</html>';
  try {
    const body = (await req.json()) as { content?: string };
    if (typeof body.content === 'string') content = body.content;
  } catch { /* use default */ }

  writeFileSync(filePath, content, 'utf-8');
  return json({ ok: true, file: fileName, content });
}

export function handleDeleteTemplate(siteId: string, themeName: string, fileName: string): Response {
  const site = getSite(siteId);
  if (!site) return notFound(siteId);
  if (!isSafeFileName(fileName)) return error('Invalid file name', 400);

  const templatesDir = join(resolveSitePath(site), 'themes', themeName, 'templates');
  const filePath = join(templatesDir, fileName);
  if (!existsSync(filePath)) return error(`Template not found: ${fileName}`, 404);

  const remaining = readdirSync(templatesDir).filter(f => extname(f) === '.html');
  if (remaining.length <= 1) return error('Cannot delete the last template file', 400);

  unlinkSync(filePath);
  return json({ ok: true, file: fileName });
}

// ---- helpers ----------------------------------------------------------------

/** Ensure a file name is a plain name with no path traversal. */
function isSafeFileName(name: string): boolean {
  if (!name) return false;
  const safe = basename(normalize(name));
  return safe === name && !name.includes('/') && !name.includes('\\') && !name.startsWith('.');
}

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
