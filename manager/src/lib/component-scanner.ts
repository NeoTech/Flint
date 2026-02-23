/**
 * Component Scanner — introspects a Flint site's source files to extract
 * component metadata: tag names, frontmatter keys, prop interfaces, and editor types.
 *
 * Reads two sources:
 *   1. src/templates/tag-engine.ts — maps {{tag}} → frontmatter key + interface name
 *   2. src/components/*.ts         — extracts interface prop definitions with JSDoc
 *
 * No TypeScript compilation needed — pure regex over source text.
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComponentProp {
  name: string;
  optional: boolean;
  type: string;
  doc: string;
}

export type EditorType = 'cta' | 'card-grid' | 'stats-bar' | 'skill-cards' | 'yaml' | 'none';

export interface ComponentDef {
  /** Template tag, e.g. 'feature-grid' */
  tag: string;
  /** Frontmatter YAML key, e.g. 'Features'. Empty string if no frontmatter. */
  frontmatterKey: string;
  /** TypeScript interface name, e.g. 'CardGridProps' */
  interfaceName: string;
  label: string;
  icon: string;
  description: string;
  editorType: EditorType;
  props: ComponentProp[];
  /** Which templates include this tag */
  usedInTemplates?: string[];
}

// ---------------------------------------------------------------------------
// Private types
// ---------------------------------------------------------------------------

interface TagInfo {
  key: string;
  interfaceName: string;
  label: string;
  icon: string;
  description: string;
}

// Interface name → structured editor type
const INTERFACE_EDITORS: Record<string, EditorType> = {
  'CtaSectionProps': 'cta',
  'CardGridProps': 'card-grid',
  'StatsBarProps': 'stats-bar',
  'SkillInfo': 'skill-cards',   // direct array case
  'SkillInfo[]': 'skill-cards',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Return all component definitions discovered from a site's source tree. */
export function getComponentDefs(sitePath: string): ComponentDef[] {
  const tagInfoMap = scanComponentFiles(sitePath);
  const templates = discoverTemplates(sitePath);

  const result: ComponentDef[] = [];

  for (const [tag, info] of tagInfoMap) {
    const ifaceName = info.interfaceName.replace(/\s*\|.*/, '').trim();
    const editorType: EditorType = info.key
      ? (INTERFACE_EDITORS[ifaceName] ?? 'yaml')
      : 'none';

    const baseIfaceName = ifaceName.replace('[]', '');
    const props = baseIfaceName ? scanInterface(sitePath, baseIfaceName) : [];

    const usedInTemplates = templates.filter(t => t.tags.includes(tag)).map(t => t.name);

    result.push({
      tag,
      frontmatterKey: info.key,
      interfaceName: ifaceName,
      label: info.label,
      icon: info.icon,
      description: info.description,
      editorType,
      props,
      usedInTemplates,
    });
  }

  return result.sort((a, b) => a.label.localeCompare(b.label));
}

/** Return the component tags used in a specific template file. */
export function getTemplateTags(sitePath: string, templateName: string): string[] {
  if (!templateName) return [];
  const candidates = [
    join(sitePath, 'themes', 'default', 'templates', `${templateName}.html`),
    join(sitePath, 'templates', `${templateName}.html`),
  ];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    return extractTagsFromTemplate(readFileSync(candidate, 'utf-8'));
  }
  return [];
}

/** Return a ComponentDef by tag name. */
export function getComponentDef(sitePath: string, tag: string): ComponentDef | undefined {
  return getComponentDefs(sitePath).find(d => d.tag === tag);
}

// ---------------------------------------------------------------------------
// Private: component source scanning (reads tagDefs from src/components/*.ts)
// ---------------------------------------------------------------------------

function scanComponentFiles(sitePath: string): Map<string, TagInfo> {
  const compDir = join(sitePath, 'src', 'components');
  if (!existsSync(compDir)) return new Map();

  const map = new Map<string, TagInfo>();
  const files = readdirSync(compDir).filter(
    f => (f.endsWith('.ts') || f.endsWith('.js')) && !f.includes('.test.')
  );

  for (const file of files) {
    const src = readFileSync(join(compDir, file), 'utf-8');

    // Find the tagDefs array export
    const arrayMatch = /export const tagDefs[\s\S]*?=\s*\[([\s\S]*?)\n\];/.exec(src);
    if (!arrayMatch) continue;
    const arrayContent = arrayMatch[1];

    // Split individual objects on `},\n  {` boundary (our consistent formatting)
    const rawObjs = arrayContent.split(/},\s*\n?\s*{/);

    for (const raw of rawObjs) {
      const tagM = /tag:\s*'([\w-]+)'/.exec(raw);
      const labelM = /label:\s*'([^']+)'/.exec(raw);
      const iconM = /icon:\s*'([^']+)'/.exec(raw);
      const descM = /description:\s*'([^']+)'/.exec(raw);
      const fkM = /frontmatterKey:\s*'(\w+)'/.exec(raw);
      const ifM = /interfaceName:\s*'([\w\[\]]+)'/.exec(raw);

      const tag = tagM?.[1] ?? '';
      const label = labelM?.[1] ?? tag;
      if (!tag && !label) continue;

      // For wildcard entries (no tag prop), derive map key from label
      const mapKey = tag || label.toLowerCase().replace(/\s+/g, '-');

      map.set(mapKey, {
        key: fkM?.[1] ?? '',
        interfaceName: ifM?.[1] ?? '',
        label,
        icon: iconM?.[1] ?? '\ud83e\udde9',
        description: descM?.[1] ?? '',
      });
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// Private: component interface scanning
// ---------------------------------------------------------------------------

function scanInterface(sitePath: string, interfaceName: string): ComponentProp[] {
  const compDir = join(sitePath, 'src', 'components');
  if (!existsSync(compDir)) return [];

  for (const file of readdirSync(compDir).filter(f => f.endsWith('.ts'))) {
    const src = readFileSync(join(compDir, file), 'utf-8');
    const props = extractInterface(src, interfaceName);
    if (props.length > 0) return props;
  }
  return [];
}

function extractInterface(src: string, name: string): ComponentProp[] {
  // Match: export interface Name extends ... { ... }
  const re = new RegExp(`export interface\\s+${name}[^{]*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const m = re.exec(src);
  if (!m) return [];

  const body = m[1];
  const props: ComponentProp[] = [];
  const seen = new Set<string>();

  // Priority 1: /** JSDoc */ field?: type;
  const documented = /\/\*\*([^*]*(?:\*(?!\/)[^*]*)*)\*+\/\s+(\w+)(\?)?\s*:\s*([^\n;]+)/g;
  let fm: RegExpExecArray | null;
  while ((fm = documented.exec(body)) !== null) {
    const fieldName = fm[2];
    if (seen.has(fieldName)) continue;
    seen.add(fieldName);
    props.push({
      name: fieldName,
      optional: fm[3] === '?',
      type: fm[4].trim(),
      doc: fm[1].replace(/[\s*]+/g, ' ').trim(),
    });
  }

  // Priority 2: undocumented bare fields
  const bare = /^\s+(\w+)(\?)?\s*:\s*([^\n;/]+)/gm;
  let bm: RegExpExecArray | null;
  while ((bm = bare.exec(body)) !== null) {
    const fieldName = bm[1];
    if (seen.has(fieldName)) continue;
    seen.add(fieldName);
    props.push({ name: fieldName, optional: bm[2] === '?', type: bm[3].trim(), doc: '' });
  }

  // Filter out ComponentProps base fields
  return props.filter(p => !['id', 'className'].includes(p.name));
}

// ---------------------------------------------------------------------------
// Private: template discovery
// ---------------------------------------------------------------------------

interface TemplateInfo { name: string; tags: string[]; }

function discoverTemplates(sitePath: string): TemplateInfo[] {
  const dirs = [
    join(sitePath, 'themes', 'default', 'templates'),
    join(sitePath, 'templates'),
  ];
  const result: TemplateInfo[] = [];
  const seen = new Set<string>();

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter(f => f.endsWith('.html'))) {
      const name = file.replace('.html', '');
      if (seen.has(name)) continue;
      seen.add(name);
      const src = readFileSync(join(dir, file), 'utf-8');
      result.push({ name, tags: extractTagsFromTemplate(src) });
    }
  }

  return result;
}

function extractTagsFromTemplate(src: string): string[] {
  const tags: string[] = [];
  const re = /\{\{(?:#if\s+|\/if\s+)?([\w-]+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (!tags.includes(m[1]) && m[1] !== 'if' && m[1] !== '/if') tags.push(m[1]);
  }
  return tags;
}
