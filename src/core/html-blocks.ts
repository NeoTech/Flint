/**
 * Preprocessor for raw HTML blocks in markdown content.
 * 
 * Extracts :::html / ::: delimited blocks from markdown,
 * replaces them with placeholders, then restores the raw HTML
 * after markdown compilation — so they pass through untouched.
 * 
 * Usage in markdown:
 *   :::html
 *   <div hx-get="/fragments/greeting.html" hx-target="#result">
 *     Click me
 *   </div>
 *   :::
 */

const BLOCK_PATTERN = /^:::html\s*\n([\s\S]*?)^:::\s*$/gm;

interface ExtractedBlocks {
  markdown: string;
  blocks: Map<string, string>;
}

/**
 * Extract :::html blocks from markdown, replacing them with placeholders.
 */
export function extractHtmlBlocks(markdown: string): ExtractedBlocks {
  const blocks = new Map<string, string>();
  let counter = 0;

  const processed = markdown.replace(BLOCK_PATTERN, (_match, content: string) => {
    const id = `<!--HTML_BLOCK_${counter++}-->`;
    blocks.set(id, content.trim());
    return id;
  });

  return { markdown: processed, blocks };
}

/**
 * Restore raw HTML blocks after markdown compilation.
 */
export function restoreHtmlBlocks(html: string, blocks: Map<string, string>): string {
  let result = html;

  for (const [placeholder, rawHtml] of blocks) {
    // The placeholder may be wrapped in a <p> tag by marked
    result = result.replace(`<p>${placeholder}</p>`, rawHtml);
    result = result.replace(placeholder, rawHtml);
  }

  return result;
}
