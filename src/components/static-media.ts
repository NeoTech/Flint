import { Component, type ComponentProps } from './component.js';
import type { TagDef } from '../templates/tag-registry.js';

/** A single media asset entry. */
export interface MediaAsset {
  /** Public path or URL, e.g. "/static/images/hero.jpg" */
  src: string;
  /** Alt text — falls back to the file name if omitted */
  alt?: string;
  /** Optional caption displayed below the asset */
  caption?: string;
}

export type MediaLayout = 'gallery' | 'carousel' | 'hero' | 'strip';

export interface StaticMediaProps extends ComponentProps {
  /** Array of assets to display */
  items: MediaAsset[];
  /** How to arrange the assets (default: gallery) */
  layout?: MediaLayout;
  /**
   * Number of columns for the gallery layout (2–6).
   * Defaults to whichever fits: 3 for ≥3 items, otherwise item count.
   */
  columns?: 2 | 3 | 4 | 5 | 6;
  /**
   * For single-asset rendering: zero-based index into items[].
   * When set, only that one image is rendered, no wrapper grid.
   */
  index?: number;
  /** Max height for hero layout (CSS value, default "500px") */
  heroHeight?: string;
}

/**
 * StaticMedia component — renders one or more static assets from
 * the page's Image frontmatter array.
 *
 * Layout modes:
 *   gallery   — responsive CSS grid (default)
 *   carousel  — horizontal-scroll film-strip
 *   hero      — first image full-width hero banner
 *   strip     — equal-width thumbs in a row, no labels
 *
 * Index access:
 *   Set `index` to render a single asset by position (0-based).
 *   Useful in templates: `{{media:0}}`, `{{media:1}}`, etc.
 */
export class StaticMedia extends Component<StaticMediaProps> {
  render(): string {
    const { items, index } = this.props;
    if (items.length === 0) return '';

    // Single-index mode — render exactly one asset
    if (typeof index === 'number') {
      const asset = items[index];
      if (!asset) return '';
      return this.renderSingle(asset);
    }

    const layout = this.props.layout ?? 'gallery';
    switch (layout) {
      case 'carousel': return this.renderCarousel(items);
      case 'hero':     return this.renderHero(items);
      case 'strip':    return this.renderStrip(items);
      default:         return this.renderGallery(items);
    }
  }

  // ---- layouts ------------------------------------------------------------

  private renderGallery(items: MediaAsset[]): string {
    const count = items.length;
    const cols = this.props.columns ?? (count >= 3 ? 3 : count >= 2 ? 2 : 1);
    const gridClass = ({
      1: 'grid-cols-1',
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
      4: 'grid-cols-2 md:grid-cols-4',
      5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
      6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
    }[cols] ?? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3');

    const cells = items.map((a, i) => this.galleryCell(a, i)).join('\n  ');
    const cls = this.classNames('static-media-gallery grid gap-4 my-6', gridClass, this.props.className);
    return `<div class="${cls}">\n  ${cells}\n</div>`;
  }

  private galleryCell(asset: MediaAsset, index: number): string {
    const alt = this.escapeHtml(asset.alt ?? this.filenameAlt(asset.src));
    const caption = asset.caption
      ? `\n  <figcaption class="text-xs text-gray-500 text-center mt-1 px-1">${this.escapeHtml(asset.caption)}</figcaption>`
      : '';
    return `<figure class="static-media-item" data-index="${index}">
  <img src="${this.escapeHtml(asset.src)}" alt="${alt}"
       loading="lazy" decoding="async"
       class="w-full h-48 object-cover rounded-lg shadow-sm hover:shadow-md transition-shadow" />${caption}
</figure>`;
  }

  private renderCarousel(items: MediaAsset[]): string {
    const cls = this.classNames('static-media-carousel my-6', this.props.className);
    const cells = items.map((a, i) => {
      const alt = this.escapeHtml(a.alt ?? this.filenameAlt(a.src));
      const caption = a.caption
        ? `\n      <figcaption class="text-xs text-gray-500 text-center mt-1">${this.escapeHtml(a.caption)}</figcaption>`
        : '';
      return `  <figure class="static-media-item shrink-0 w-64" data-index="${i}">
    <img src="${this.escapeHtml(a.src)}" alt="${alt}"
         loading="lazy" decoding="async"
         class="w-64 h-40 object-cover rounded-lg shadow-sm" />${caption}
  </figure>`;
    }).join('\n');

    return `<div class="${cls}">
  <div class="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth" style="-webkit-overflow-scrolling:touch">
${cells}
  </div>
</div>`;
  }

  private renderHero(items: MediaAsset[]): string {
    const asset = items[0];
    const height = this.props.heroHeight ?? '500px';
    const alt = this.escapeHtml(asset.alt ?? this.filenameAlt(asset.src));
    const caption = asset.caption
      ? `\n<figcaption class="text-xs text-gray-500 text-center mt-2">${this.escapeHtml(asset.caption)}</figcaption>`
      : '';
    const cls = this.classNames('static-media-hero my-6', this.props.className);

    const rest = items.slice(1);
    const strip = rest.length > 0 ? `\n${this.renderStrip(rest)}` : '';

    return `<figure class="${cls}">
  <img src="${this.escapeHtml(asset.src)}" alt="${alt}"
       loading="eager" decoding="async"
       class="w-full object-cover rounded-xl shadow-lg"
       style="max-height:${height}" />${caption}
</figure>${strip}`;
  }

  private renderStrip(items: MediaAsset[]): string {
    const cls = this.classNames('static-media-strip my-4', this.props.className);
    const thumbs = items.map((a, i) => {
      const alt = this.escapeHtml(a.alt ?? this.filenameAlt(a.src));
      return `  <img src="${this.escapeHtml(a.src)}" alt="${alt}" data-index="${i}"
       loading="lazy" decoding="async"
       class="h-20 w-auto object-cover rounded-md shadow-sm hover:opacity-80 transition-opacity cursor-pointer" />`;
    }).join('\n');
    return `<div class="${cls} flex flex-wrap gap-2">\n${thumbs}\n</div>`;
  }

  // Single asset (used for index access)
  private renderSingle(asset: MediaAsset): string {
    const alt = this.escapeHtml(asset.alt ?? this.filenameAlt(asset.src));
    const cls = this.classNames('static-media-single', this.props.className);
    const caption = asset.caption
      ? `\n<figcaption class="text-xs text-gray-500 text-center mt-1">${this.escapeHtml(asset.caption)}</figcaption>`
      : '';
    return `<figure class="${cls}">
  <img src="${this.escapeHtml(asset.src)}" alt="${alt}"
       loading="lazy" decoding="async"
       class="max-w-full rounded-lg shadow-sm" />${caption}
</figure>`;
  }

  // ---- helpers ------------------------------------------------------------

  /** Derive alt text from the file name portion of a path. */
  private filenameAlt(src: string): string {
    return src.split('/').pop()?.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ') ?? '';
  }
}

/**
 * Normalise the `Image` frontmatter value into a `MediaAsset[]`.
 *
 * Accepts:
 *   - string          → [{ src }]
 *   - string[]        → [{ src }, …]
 *   - MediaAsset      → [asset]
 *   - MediaAsset[]    → assets
 *   - undefined/null  → []
 */
export function normaliseMediaAssets(raw: unknown): MediaAsset[] {
  if (!raw) return [];
  if (typeof raw === 'string') return raw ? [{ src: raw }] : [];
  if (Array.isArray(raw)) {
    return raw
      .map(item => {
        if (typeof item === 'string') return item ? { src: item } : null;
        if (typeof item === 'object' && item !== null && typeof (item as MediaAsset).src === 'string') {
          return item as MediaAsset;
        }
        return null;
      })
      .filter((x): x is MediaAsset => x !== null && Boolean(x.src));
  }
  if (typeof raw === 'object' && raw !== null && typeof (raw as MediaAsset).src === 'string') {
    return [raw as MediaAsset];
  }
  return [];
}

export const tagDefs: TagDef[] = [
  {
    tag: 'media-gallery',
    label: 'Media Gallery',
    icon: '🖼️',
    description: 'Responsive image grid from frontmatter Image array.',
    frontmatterKey: 'Image',
    resolve: (ctx) => {
      const assets = normaliseMediaAssets(ctx.frontmatter['Image']);
      if (assets.length === 0) return '';
      return StaticMedia.render({ items: assets, layout: 'gallery' });
    },
  },
  {
    tag: 'media-carousel',
    label: 'Media Carousel',
    icon: '🎠',
    description: 'Horizontal-scroll image strip from frontmatter Image array.',
    frontmatterKey: 'Image',
    resolve: (ctx) => {
      const assets = normaliseMediaAssets(ctx.frontmatter['Image']);
      if (assets.length === 0) return '';
      return StaticMedia.render({ items: assets, layout: 'carousel' });
    },
  },
  {
    tag: 'media-hero',
    label: 'Media Hero',
    icon: '🌄',
    description: 'First image as hero banner, remainder as strip.',
    frontmatterKey: 'Image',
    resolve: (ctx) => {
      const assets = normaliseMediaAssets(ctx.frontmatter['Image']);
      if (assets.length === 0) return '';
      return StaticMedia.render({ items: assets, layout: 'hero' });
    },
  },
  {
    tag: 'media-strip',
    label: 'Media Strip',
    icon: '📽️',
    description: 'Compact thumbnail row from frontmatter Image array.',
    frontmatterKey: 'Image',
    resolve: (ctx) => {
      const assets = normaliseMediaAssets(ctx.frontmatter['Image']);
      if (assets.length === 0) return '';
      return StaticMedia.render({ items: assets, layout: 'strip' });
    },
  },
  {
    matchTag: (name) => /^media:\d+$/.test(name),
    label: 'Media Index',
    icon: '🔢',
    description: 'Single image at index N from frontmatter Image array (media:N syntax).',
    frontmatterKey: 'Image',
    resolve: (ctx, tagName) => {
      const idx = parseInt(tagName.split(':')[1], 10);
      const assets = normaliseMediaAssets(ctx.frontmatter['Image']);
      return StaticMedia.render({ items: assets, index: idx });
    },
  },
];
