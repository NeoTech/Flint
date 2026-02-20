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
// Static metadata (labels, icons, descriptions)
// ---------------------------------------------------------------------------

const TAG_META: Record<string, Pick<ComponentDef, 'label' | 'icon' | 'description'>> = {
  'hero': {
    label: 'Hero Section', icon: '🦸',
    description: 'Full-width gradient hero with heading, optional tagline, subtitle, and up to two CTA buttons. Uses the Hero: frontmatter key.',
  },
  'feature-grid': {
    label: 'Feature Grid', icon: '🔲',
    description: 'Responsive grid of icon cards with titles and descriptions. Driven by Features: frontmatter — a heading, optional subtitle, and an items array.',
  },
  'stats-bar': {
    label: 'Stats Bar', icon: '📊',
    description: 'Dark-background row of headline statistics with colored values. Driven by Stats: frontmatter containing a stats array.',
  },
  'showcase-grid': {
    label: 'Showcase Grid', icon: '🃏',
    description: 'Secondary card grid, typically for showcasing work or products. Same structure as Feature Grid but uses the Showcase: frontmatter key.',
  },
  'call-to-action': {
    label: 'Call to Action', icon: '📢',
    description: 'Conversion banner (smaller than Hero). Heading, optional subtitle, and CTA buttons. Uses the CTA: frontmatter key.',
  },
  'skill-cards': {
    label: 'Skill Cards', icon: '🎯',
    description: 'Grid of skill info cards with icon, description, and colored badge tags. The Skills: frontmatter key takes a direct array of skill objects.',
  },
  'gadget': {
    label: 'Demo Gadget', icon: '🎲',
    description: 'Interactive randomizing demo widget. No frontmatter needed — just add {{gadget}} to your template.',
  },
  'product': {
    label: 'Product', icon: '🛍️',
    description: 'Product card or full detail hero, auto-detected from the Template field. Uses Short-URI, PriceCents, Image, Description, StripePaymentLink frontmatter.',
  },
  'cart': {
    label: 'Cart', icon: '🛒',
    description: 'Shopping cart sidebar widget, hydrated client-side from IndexedDB. No frontmatter needed.',
  },
  'navigation': {
    label: 'Navigation Bar', icon: '🧭',
    description: 'Auto-generated navigation bar from page hierarchy. No first-party configuration.',
  },
  'label-footer': {
    label: 'Label Footer', icon: '🏷️',
    description: 'Site-wide label cloud footer showing all page labels as links.',
  },
  'blog-header': {
    label: 'Blog Header', icon: '📝',
    description: 'Article header with title, author byline, reading time, category pill, and label badges.',
  },
};

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
  const tagKeyMap = scanTagEngine(sitePath);
  const templates = discoverTemplates(sitePath);

  const result: ComponentDef[] = [];

  for (const [tag, info] of tagKeyMap) {
    const meta = TAG_META[tag] ?? { label: tag, icon: '🧩', description: '' };
    const ifaceName = info.interfaceName.replace(/\s*\|.*/, '').trim(); // strip ' | undefined'
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
      label: meta.label,
      icon: meta.icon,
      description: meta.description,
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
// Private: tag-engine.ts scanning
// ---------------------------------------------------------------------------

interface TagInfo { key: string; interfaceName: string; }

function scanTagEngine(sitePath: string): Map<string, TagInfo> {
  const file = join(sitePath, 'src', 'templates', 'tag-engine.ts');
  if (!existsSync(file)) return new Map();
  const src = readFileSync(file, 'utf-8');

  const map = new Map<string, TagInfo>();

  // case 'tag-name': { ... ctx.frontmatter['Key'] as Interface ...
  const withFm = /case '([\w-]+)':\s*\{[^}]*ctx\.frontmatter\['(\w+)'\]\s+as\s+([\w\[\]| ]+)/g;
  let m: RegExpExecArray | null;
  while ((m = withFm.exec(src)) !== null) {
    map.set(m[1], { key: m[2], interfaceName: m[3].split('|')[0].trim() });
  }

  // case 'tag': (no frontmatter) — simple tags
  const noFm = /case '([\w-]+)':\s*\n\s*return /g;
  while ((m = noFm.exec(src)) !== null) {
    if (!map.has(m[1])) map.set(m[1], { key: '', interfaceName: '' });
  }

  // Other no-frontmatter tags (gadget, cart, navigation, label-footer etc.)
  for (const tag of Object.keys(TAG_META)) {
    if (!map.has(tag)) map.set(tag, { key: '', interfaceName: '' });
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
