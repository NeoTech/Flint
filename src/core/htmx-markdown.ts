export interface HtmxAttributes {
  [key: string]: string;
}

/**
 * Parse HTMX attributes from markdown attribute syntax
 * Format: {hx-get=/url hx-target=#id}
 * Supports values with spaces when quoted: {hx-trigger="click delay:500ms"}
 * Unquoted values extend until the next key= or end of string
 */
export function parseHtmxAttributes(attributeString: string): HtmxAttributes {
  const attrs: HtmxAttributes = {};
  
  if (!attributeString.trim()) {
    return attrs;
  }
  
  // Remove braces if present
  const cleanString = attributeString.replace(/^\{|\}$/g, '').trim();
  
  // Parse key="value" (quoted) or key=value (unquoted, extends to next key= or end)
  const regex = /([\w][-\w:]*)=(?:"([^"]*)"|([^\s]+(?:\s+(?![\w][-\w:]*=)(?:[^\s]+))*))/g;
  let match;
  
  while ((match = regex.exec(cleanString)) !== null) {
    const key = match[1];
    // match[2] is quoted value, match[3] is unquoted value
    const value = match[2] !== undefined ? match[2] : (match[3] || '');
    attrs[key] = value.trim();
  }
  
  return attrs;
}

/**
 * Render HTML element with HTMX attributes
 */
export function renderHtmxElement(
  tag: string, 
  attributes: HtmxAttributes, 
  content: string
): string {
  const attrString = Object.entries(attributes)
    .map(([key, value]) => `${key}="${escapeHtml(value)}"`)
    .join(' ');
  
  if (attrString) {
    return `<${tag} ${attrString}>${content}</${tag}>`;
  }
  
  return `<${tag}>${content}</${tag}>`;
}

/**
 * Process markdown content with HTMX attributes
 * Converts [Text](url){hx-attrs} to HTML with HTMX
 */
export function processHtmxMarkdown(markdown: string): string {
  // Pattern for links with HTMX attributes: [text](url){attrs}
  // Only matches when {attrs} is present (HTMX-specific links)
  // Uses negative lookbehind to skip images: ![alt](url)
  const linkPattern = /(?<!!)\[([^\]]+)\]\(([^)]+)\)\{([^}]+)\}/g;
  
  return markdown.replace(linkPattern, (match, text, url, attrs) => {
    const htmxAttrs = attrs ? parseHtmxAttributes(attrs) : {};
    
    // Determine if this should be a button or link
    const hasPost = htmxAttrs['hx-post'];
    const hasDelete = htmxAttrs['hx-delete'];
    const hasPut = htmxAttrs['hx-put'];
    const hasPatch = htmxAttrs['hx-patch'];
    
    // If it has action methods or explicit button behavior, render as button
    if (hasPost || hasDelete || hasPut || hasPatch || htmxAttrs['hx-trigger']) {
      // For buttons, we keep the visual as a button but may have href for fallback
      const buttonAttrs: HtmxAttributes = { ...htmxAttrs };
      if (url && url !== '#') {
        buttonAttrs['data-href'] = url;
      }
      return renderHtmxElement('button', buttonAttrs, text);
    }
    
    // Otherwise render as link
    const linkAttrs: HtmxAttributes = { href: url, ...htmxAttrs };
    return renderHtmxElement('a', linkAttrs, text);
  });
}

/**
 * Escape HTML entities
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Check if markdown contains HTMX attributes
 */
export function hasHtmxAttributes(markdown: string): boolean {
  return /\[([^\]]+)\]\(([^)]+)\)\{[^}]*hx-/.test(markdown);
}

/**
 * Extract all HTMX hooks from markdown for preloading
 */
export function extractHtmxHooks(markdown: string): string[] {
  const hooks: string[] = [];
  const pattern = /hx-get="([^"]*)"/g;
  let match;
  
  while ((match = pattern.exec(markdown)) !== null) {
    hooks.push(match[1]);
  }
  
  return [...new Set(hooks)];
}
