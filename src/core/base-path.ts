/**
 * Base-path rewriter for HTML content.
 *
 * Prefixes a basePath onto absolute paths in HTML attributes that
 * reference site-local resources. Handles:
 *   - HTMX attributes: hx-get, hx-post, hx-put, hx-delete, hx-patch
 *   - Standard attributes: href, src
 *
 * Skips external URLs (http://, https://, //), fragment-only (#),
 * and paths that already start with the basePath.
 */

/** Attributes whose values should be rewritten. */
const PATH_ATTRS = ['hx-get', 'hx-post', 'hx-put', 'hx-delete', 'hx-patch', 'href', 'src'];

/**
 * Build a single regex that matches any of the target attributes
 * with a quoted absolute-path value.
 *
 * Captures:  (attrName)  (quote)  (path)
 *   e.g.  hx-get  "  /fragments/greeting.html  "
 */
function buildPattern(attrs: string[]): RegExp {
  const attrGroup = attrs.join('|');
  // Match: attr="/" where the value starts with / but not //
  return new RegExp(`(${attrGroup})=(['"])(\/(?!\\/)[^'"]*?)\\2`, 'g');
}

const ATTR_RE = buildPattern(PATH_ATTRS);

/**
 * Rewrite absolute paths in HTML content, prefixing them with basePath.
 *
 * Returns the content unchanged when basePath is empty.
 */
export function rewriteAbsolutePaths(html: string, basePath: string): string {
  if (!basePath) return html;

  return html.replace(ATTR_RE, (_match, attr: string, quote: string, path: string) => {
    // Don't double-prefix
    if (path.startsWith(basePath)) {
      return `${attr}=${quote}${path}${quote}`;
    }
    return `${attr}=${quote}${basePath}${path}${quote}`;
  });
}
