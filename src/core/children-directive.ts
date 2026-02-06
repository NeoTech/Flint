/**
 * Preprocessor for :::children directives in Markdown content.
 *
 * Automatically generates a listing of child pages for section pages,
 * replacing hardcoded HTML with a repeatable template driven by
 * child page frontmatter metadata.
 *
 * Usage in markdown:
 *
 *   :::children sort=date-desc limit=5 class="space-y-4"
 *   <div class="card">
 *     <a href="{url}">{title}</a>
 *     <p>{description}</p>
 *     <p>{date} · {category} {labels:badges}</p>
 *   </div>
 *   :::
 *
 * If no template body is provided, a default card template is used.
 *
 * Placeholders:
 *   {title}         Page title
 *   {url}           Page URL path
 *   {description}   Page description
 *   {date}          Formatted date (e.g. "Feb 1, 2026")
 *   {date:iso}      ISO date (e.g. "2026-02-01")
 *   {category}      Category name
 *   {labels}        Comma-separated labels
 *   {labels:badges} Labels as styled <span> badges
 *   {author}        Author name
 *   {type}          Page type (page/post/section)
 *   {short-uri}     Short-URI identifier
 *
 * Options (on the opening :::children line):
 *   sort=date-desc   Sort by date descending (default)
 *   sort=date-asc    Sort by date ascending
 *   sort=order       Sort by Order field
 *   sort=title       Sort alphabetically by title
 *   limit=N          Show at most N children
 *   class="..."      Wrapper div CSS classes (default: "space-y-4")
 */

export interface ChildPageData {
  title: string;
  url: string;
  description: string;
  date: Date | null;
  category: string;
  labels: string[];
  author: string;
  type: string;
  shortUri: string;
  order: number;
}

export interface ChildrenDirectiveOptions {
  sort: 'date-desc' | 'date-asc' | 'order' | 'title';
  limit?: number;
  wrapperClass?: string;
}

const CHILDREN_PATTERN = /^:::children(?:[ \t]+(.*))?\r?\n([\s\S]*?)^:::\s*$/gm;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DEFAULT_TEMPLATE = `<div class="border border-gray-200 rounded p-4 hover:shadow-sm transition-shadow">
  <a href="{url}" class="text-lg font-semibold text-blue-600 hover:underline">{title}</a>
  <p class="text-sm text-gray-500 mt-1">{date} · {category} {labels:badges}</p>
  <p class="text-gray-600 mt-2">{description}</p>
</div>`;

/**
 * Parse options from the :::children opening line.
 * Supports: sort=value, limit=N, class="value with spaces"
 */
export function parseChildrenOptions(optionString: string): ChildrenDirectiveOptions {
  const options: ChildrenDirectiveOptions = {
    sort: 'date-desc',
  };

  if (!optionString || !optionString.trim()) return options;

  const regex = /([\w-]+)=(?:"([^"]*)"|(\S+))/g;
  let match;

  while ((match = regex.exec(optionString)) !== null) {
    const key = match[1];
    const value = match[2] !== undefined ? match[2] : match[3];

    switch (key) {
      case 'sort':
        if (['date-desc', 'date-asc', 'order', 'title'].includes(value)) {
          options.sort = value as ChildrenDirectiveOptions['sort'];
        }
        break;
      case 'limit':
        options.limit = parseInt(value, 10);
        break;
      case 'class':
        options.wrapperClass = value;
        break;
    }
  }

  return options;
}

/**
 * Format a Date as "Mon D, YYYY" using UTC to avoid timezone issues.
 */
export function formatDate(date: Date | null): string {
  if (!date) return '';
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/**
 * Format a Date as "YYYY-MM-DD" ISO string.
 */
function formatIsoDate(date: Date | null): string {
  if (!date) return '';
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Render labels as styled badge <span> elements.
 */
export function renderLabelBadges(labels: string[]): string {
  if (labels.length === 0) return '';
  return labels
    .map(l => `<span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">${l}</span>`)
    .join(' ');
}

/**
 * Render a template string by replacing {placeholder} tokens with page data.
 * Longer placeholders like {date:iso} and {labels:badges} are replaced first
 * to avoid partial matches.
 */
export function renderChildTemplate(template: string, page: ChildPageData): string {
  return template
    .replace(/\{date:iso\}/g, formatIsoDate(page.date))
    .replace(/\{labels:badges\}/g, renderLabelBadges(page.labels))
    .replace(/\{title\}/g, page.title)
    .replace(/\{url\}/g, page.url)
    .replace(/\{description\}/g, page.description)
    .replace(/\{date\}/g, formatDate(page.date))
    .replace(/\{category\}/g, page.category)
    .replace(/\{labels\}/g, page.labels.join(', '))
    .replace(/\{author\}/g, page.author)
    .replace(/\{type\}/g, page.type)
    .replace(/\{short-uri\}/g, page.shortUri);
}

/**
 * Sort child pages by the specified strategy.
 */
function sortPages(pages: ChildPageData[], sort: ChildrenDirectiveOptions['sort']): ChildPageData[] {
  const sorted = [...pages];

  switch (sort) {
    case 'date-desc':
      sorted.sort((a, b) => {
        const da = a.date ? a.date.getTime() : 0;
        const db = b.date ? b.date.getTime() : 0;
        return db - da;
      });
      break;
    case 'date-asc':
      sorted.sort((a, b) => {
        const da = a.date ? a.date.getTime() : 0;
        const db = b.date ? b.date.getTime() : 0;
        return da - db;
      });
      break;
    case 'order':
      sorted.sort((a, b) => a.order - b.order);
      break;
    case 'title':
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
  }

  return sorted;
}

/**
 * Process all :::children directives in a Markdown string.
 *
 * For each directive, the child pages are sorted, limited, and rendered
 * using either a custom template (the body of the block) or the default
 * card template. The output is wrapped in a :::html block so it passes
 * through the Markdown compiler untouched.
 */
export function processChildrenDirectives(
  markdown: string,
  children: ChildPageData[],
): string {
  return markdown.replace(CHILDREN_PATTERN, (_match, optionsStr: string | undefined, body: string) => {
    const options = parseChildrenOptions(optionsStr || '');

    let pages = sortPages(children, options.sort);
    if (options.limit) {
      pages = pages.slice(0, options.limit);
    }

    if (pages.length === 0) {
      return '';
    }

    const template = body.trim() || DEFAULT_TEMPLATE;
    const wrapperClass = options.wrapperClass || 'space-y-4';

    const items = pages.map(page => renderChildTemplate(template, page));

    return `:::html\n<div class="${wrapperClass}">\n${items.join('\n')}\n</div>\n:::`;
  });
}
