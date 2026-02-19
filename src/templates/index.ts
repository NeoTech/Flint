/**
 * Template system index.
 *
 * Exports the tag-based template engine, registry, and helpers.
 * Templates are plain HTML files with {{tag}} placeholders,
 * loaded from a `templates/` directory by the builder.
 *
 * To add a new template:
 *   1. Create templates/<name>.html using {{tag}} syntax
 *   2. Set `Template: <name>` in content frontmatter
 *   3. That's it — no TypeScript needed
 */

export { TemplateRegistry, loadTemplatesFromDir, overlayTemplatesFromDir } from './template-registry.js';
export type { TemplateContext } from './template-registry.js';
export { processTemplate, resolveTag, estimateReadingTime, formatDate } from './tag-engine.js';
export { renderHead, renderFootScripts } from './helpers.js';
export type { HeadOptions } from './helpers.js';
