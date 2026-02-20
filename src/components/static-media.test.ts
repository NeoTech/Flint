import { describe, it, expect } from 'bun:test';
import { StaticMedia, normaliseMediaAssets } from './static-media.js';

// ---- normaliseMediaAssets --------------------------------------------------

describe('normaliseMediaAssets', () => {
  it('returns [] for falsy values', () => {
    expect(normaliseMediaAssets(undefined)).toEqual([]);
    expect(normaliseMediaAssets(null)).toEqual([]);
    expect(normaliseMediaAssets('')).toEqual([]);
  });

  it('wraps a plain string in an array', () => {
    expect(normaliseMediaAssets('/static/a.png')).toEqual([{ src: '/static/a.png' }]);
  });

  it('converts a string[] to asset array', () => {
    expect(normaliseMediaAssets(['/a.jpg', '/b.jpg'])).toEqual([
      { src: '/a.jpg' },
      { src: '/b.jpg' },
    ]);
  });

  it('passes through MediaAsset[] unchanged', () => {
    const assets = [{ src: '/a.jpg', alt: 'A', caption: 'cap' }];
    expect(normaliseMediaAssets(assets)).toEqual(assets);
  });

  it('accepts a single MediaAsset object', () => {
    expect(normaliseMediaAssets({ src: '/x.png', alt: 'X' })).toEqual([{ src: '/x.png', alt: 'X' }]);
  });

  it('filters out empty strings from arrays', () => {
    expect(normaliseMediaAssets(['/a.jpg', '', '/b.jpg'])).toEqual([
      { src: '/a.jpg' },
      { src: '/b.jpg' },
    ]);
  });

  it('filters out items without a valid src', () => {
    expect(normaliseMediaAssets([{ alt: 'no src' }, { src: '/ok.jpg' }] as unknown[])).toEqual([
      { src: '/ok.jpg' },
    ]);
  });

  it('coerces mixed string + object arrays', () => {
    const raw = ['/a.jpg', { src: '/b.jpg', alt: 'B' }];
    expect(normaliseMediaAssets(raw)).toEqual([
      { src: '/a.jpg' },
      { src: '/b.jpg', alt: 'B' },
    ]);
  });
});

// ---- StaticMedia rendering -------------------------------------------------

const SAMPLE = [
  { src: '/static/a.jpg', alt: 'Asset A' },
  { src: '/static/b.png', alt: 'Asset B', caption: 'The B' },
  { src: '/static/c.webp' },
];

describe('StaticMedia — empty', () => {
  it('returns empty string when items is empty', () => {
    expect(new StaticMedia({ items: [] }).render()).toBe('');
  });
});

describe('StaticMedia — single index', () => {
  it('renders only the item at the given index', () => {
    const html = new StaticMedia({ items: SAMPLE, index: 1 }).render();
    expect(html).toContain('static/b.png');
    expect(html).toContain('alt="Asset B"');
    expect(html).toContain('The B');
    expect(html).not.toContain('static/a.jpg');
  });

  it('returns empty string for out-of-range index', () => {
    expect(new StaticMedia({ items: SAMPLE, index: 99 }).render()).toBe('');
  });

  it('derives alt from filename when alt is omitted', () => {
    const html = new StaticMedia({ items: [{ src: '/static/my-hero.jpg' }], index: 0 }).render();
    expect(html).toContain('alt="my hero"');
  });
});

describe('StaticMedia — gallery layout', () => {
  it('uses gallery layout by default', () => {
    const html = new StaticMedia({ items: SAMPLE }).render();
    expect(html).toContain('static-media-gallery');
    expect(html).toContain('grid');
  });

  it('renders all items', () => {
    const html = new StaticMedia({ items: SAMPLE }).render();
    expect(html).toContain('static/a.jpg');
    expect(html).toContain('static/b.png');
    expect(html).toContain('static/c.webp');
  });

  it('includes data-index attributes', () => {
    const html = new StaticMedia({ items: SAMPLE }).render();
    expect(html).toContain('data-index="0"');
    expect(html).toContain('data-index="1"');
    expect(html).toContain('data-index="2"');
  });

  it('renders captions when present', () => {
    const html = new StaticMedia({ items: SAMPLE }).render();
    expect(html).toContain('The B');
    expect(html).toContain('<figcaption');
  });

  it('applies column override', () => {
    const html = new StaticMedia({ items: SAMPLE, columns: 4 }).render();
    expect(html).toContain('grid-cols-2 md:grid-cols-4');
  });

  it('escapes HTML in alt and caption', () => {
    const html = new StaticMedia({ items: [{ src: '/x.jpg', alt: '<script>', caption: '<b>bad</b>' }] }).render();
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<b>bad</b>');
  });
});

describe('StaticMedia — carousel layout', () => {
  it('has carousel class and overflow-x-auto scroller', () => {
    const html = new StaticMedia({ items: SAMPLE, layout: 'carousel' }).render();
    expect(html).toContain('static-media-carousel');
    expect(html).toContain('overflow-x-auto');
    expect(html).toContain('snap-x');
  });

  it('renders all items', () => {
    const html = new StaticMedia({ items: SAMPLE, layout: 'carousel' }).render();
    expect(html).toContain('static/a.jpg');
    expect(html).toContain('static/c.webp');
  });
});

describe('StaticMedia — hero layout', () => {
  it('renders first image as full-width hero', () => {
    const html = new StaticMedia({ items: SAMPLE, layout: 'hero' }).render();
    expect(html).toContain('static-media-hero');
    expect(html).toContain('static/a.jpg');
    expect(html).toContain('loading="eager"');
  });

  it('renders remaining images as a strip', () => {
    const html = new StaticMedia({ items: SAMPLE, layout: 'hero' }).render();
    expect(html).toContain('static-media-strip');
    expect(html).toContain('static/b.png');
    expect(html).toContain('static/c.webp');
  });

  it('respects custom heroHeight', () => {
    const html = new StaticMedia({ items: SAMPLE, layout: 'hero', heroHeight: '300px' }).render();
    expect(html).toContain('max-height:300px');
  });
});

describe('StaticMedia — strip layout', () => {
  it('renders compact thumbnail row', () => {
    const html = new StaticMedia({ items: SAMPLE, layout: 'strip' }).render();
    expect(html).toContain('static-media-strip');
    expect(html).toContain('h-20');
    expect(html).toContain('static/a.jpg');
  });
});

describe('StaticMedia — className prop', () => {
  it('appends custom className to wrapper', () => {
    const html = new StaticMedia({ items: SAMPLE, className: 'my-custom' }).render();
    expect(html).toContain('my-custom');
  });
});
