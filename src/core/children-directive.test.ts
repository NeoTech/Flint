import { describe, it, expect } from 'vitest';
import {
  processChildrenDirectives,
  parseChildrenOptions,
  renderChildTemplate,
  formatDate,
  renderLabelBadges,
  type ChildPageData,
} from './children-directive.js';

const sampleChildren: ChildPageData[] = [
  {
    title: 'Getting Started with HTMX',
    url: '/blog/getting-started-with-htmx',
    description: 'Learn HTMX basics',
    date: new Date('2026-02-01'),
    category: 'Tutorials',
    labels: ['htmx', 'beginner'],
    author: 'Jane Developer',
    type: 'post',
    shortUri: 'getting-started-htmx',
    order: 1,
    price: '',
    priceCents: 0,
    currency: '',
    stripePriceId: '',
    image: '',
  },
  {
    title: 'Tailwind Patterns',
    url: '/blog/tailwind-patterns',
    description: 'Reusable Tailwind components',
    date: new Date('2026-01-28'),
    category: 'Tutorials',
    labels: ['tailwind', 'css'],
    author: 'Jane Developer',
    type: 'post',
    shortUri: 'tailwind-patterns',
    order: 2,
    price: '',
    priceCents: 0,
    currency: '',
    stripePriceId: '',
    image: '',
  },
  {
    title: 'Static Sites Are Back',
    url: '/blog/static-sites-are-back',
    description: 'Why static is trending',
    date: new Date('2026-01-20'),
    category: 'Deep Dives',
    labels: ['architecture', 'opinion'],
    author: 'Alex Architect',
    type: 'post',
    shortUri: 'static-sites-back',
    order: 3,
    price: '',
    priceCents: 0,
    currency: '',
    stripePriceId: '',
    image: '',
  },
];

const sampleProduct: ChildPageData = {
  title: 'Blue Ceramic Mug',
  url: '/shop/blue-mug',
  description: 'A beautiful hand-crafted mug',
  date: new Date('2026-01-15'),
  category: 'Shop',
  labels: ['shop'],
  author: 'System',
  type: 'product',
  shortUri: 'blue-mug',
  order: 1,
  price: '$12.00',
  priceCents: 1200,
  currency: 'usd',
  stripePriceId: 'price_1ExampleBlueMug',
  image: '☕',
};

describe('Children Directive', () => {
  describe('parseChildrenOptions', () => {
    it('should parse sort option', () => {
      const options = parseChildrenOptions('sort=date-desc');
      expect(options.sort).toBe('date-desc');
    });

    it('should parse limit option', () => {
      const options = parseChildrenOptions('limit=2');
      expect(options.limit).toBe(2);
    });

    it('should parse multiple options', () => {
      const options = parseChildrenOptions('sort=title limit=5');
      expect(options.sort).toBe('title');
      expect(options.limit).toBe(5);
    });

    it('should use defaults for empty string', () => {
      const options = parseChildrenOptions('');
      expect(options.sort).toBe('date-desc');
      expect(options.limit).toBeUndefined();
    });

    it('should parse class option with quoted value', () => {
      const options = parseChildrenOptions('class="grid grid-cols-2 gap-4"');
      expect(options.wrapperClass).toBe('grid grid-cols-2 gap-4');
    });

    it('should parse all options together', () => {
      const options = parseChildrenOptions('sort=order limit=3 class="my-grid"');
      expect(options.sort).toBe('order');
      expect(options.limit).toBe(3);
      expect(options.wrapperClass).toBe('my-grid');
    });

    it('should parse type filter option', () => {
      const options = parseChildrenOptions('type=product');
      expect(options.filterType).toBe('product');
    });

    it('should parse type with other options', () => {
      const options = parseChildrenOptions('sort=order type=product limit=5');
      expect(options.sort).toBe('order');
      expect(options.filterType).toBe('product');
      expect(options.limit).toBe(5);
    });

    it('should ignore invalid sort values', () => {
      const options = parseChildrenOptions('sort=invalid');
      expect(options.sort).toBe('date-desc');
    });
  });

  describe('formatDate', () => {
    it('should format date as "Mon D, YYYY"', () => {
      const result = formatDate(new Date('2026-02-01'));
      expect(result).toBe('Feb 1, 2026');
    });

    it('should return empty string for null', () => {
      expect(formatDate(null)).toBe('');
    });

    it('should handle end-of-year dates', () => {
      const result = formatDate(new Date('2025-12-31'));
      expect(result).toBe('Dec 31, 2025');
    });
  });

  describe('renderLabelBadges', () => {
    it('should render labels as styled badge spans', () => {
      const result = renderLabelBadges(['htmx', 'css']);
      expect(result).toContain('htmx');
      expect(result).toContain('css');
      expect(result).toContain('<span');
      expect(result).toContain('rounded');
    });

    it('should return empty string for empty labels', () => {
      expect(renderLabelBadges([])).toBe('');
    });

    it('should render single label', () => {
      const result = renderLabelBadges(['htmx']);
      expect(result).toContain('htmx');
      expect(result.match(/<span/g)?.length).toBe(1);
    });
  });

  describe('renderChildTemplate', () => {
    it('should replace {title} placeholder', () => {
      const result = renderChildTemplate('{title}', sampleChildren[0]);
      expect(result).toBe('Getting Started with HTMX');
    });

    it('should replace {url} placeholder', () => {
      const result = renderChildTemplate('{url}', sampleChildren[0]);
      expect(result).toBe('/blog/getting-started-with-htmx');
    });

    it('should replace {description} placeholder', () => {
      const result = renderChildTemplate('{description}', sampleChildren[0]);
      expect(result).toBe('Learn HTMX basics');
    });

    it('should replace {category} placeholder', () => {
      const result = renderChildTemplate('{category}', sampleChildren[0]);
      expect(result).toBe('Tutorials');
    });

    it('should replace {author} placeholder', () => {
      const result = renderChildTemplate('{author}', sampleChildren[0]);
      expect(result).toBe('Jane Developer');
    });

    it('should replace {labels} with comma-separated list', () => {
      const result = renderChildTemplate('{labels}', sampleChildren[0]);
      expect(result).toBe('htmx, beginner');
    });

    it('should replace {labels:badges} with badge HTML', () => {
      const result = renderChildTemplate('{labels:badges}', sampleChildren[0]);
      expect(result).toContain('<span');
      expect(result).toContain('htmx');
      expect(result).toContain('beginner');
    });

    it('should replace {date} with formatted date', () => {
      const result = renderChildTemplate('{date}', sampleChildren[0]);
      expect(result).toBe('Feb 1, 2026');
    });

    it('should replace {date:iso} with ISO date', () => {
      const result = renderChildTemplate('{date:iso}', sampleChildren[0]);
      expect(result).toBe('2026-02-01');
    });

    it('should replace {short-uri} placeholder', () => {
      const result = renderChildTemplate('{short-uri}', sampleChildren[0]);
      expect(result).toBe('getting-started-htmx');
    });

    it('should replace {type} placeholder', () => {
      const result = renderChildTemplate('{type}', sampleChildren[0]);
      expect(result).toBe('post');
    });

    it('should replace multiple placeholders in one template', () => {
      const result = renderChildTemplate('[{title}]({url}) - {category}', sampleChildren[0]);
      expect(result).toBe('[Getting Started with HTMX](/blog/getting-started-with-htmx) - Tutorials');
    });

    it('should handle empty description gracefully', () => {
      const page: ChildPageData = { ...sampleChildren[0], description: '' };
      const result = renderChildTemplate('{description}', page);
      expect(result).toBe('');
    });

    it('should handle null date gracefully', () => {
      const page: ChildPageData = { ...sampleChildren[0], date: null };
      const result = renderChildTemplate('{date} {date:iso}', page);
      expect(result).toBe(' ');
    });

    it('should replace {price} placeholder', () => {
      const result = renderChildTemplate('{price}', sampleProduct);
      expect(result).toBe('$12.00');
    });

    it('should replace {price-cents} placeholder', () => {
      const result = renderChildTemplate('{price-cents}', sampleProduct);
      expect(result).toBe('1200');
    });

    it('should replace {currency} placeholder', () => {
      const result = renderChildTemplate('{currency}', sampleProduct);
      expect(result).toBe('usd');
    });

    it('should replace {stripe-price-id} placeholder', () => {
      const result = renderChildTemplate('{stripe-price-id}', sampleProduct);
      expect(result).toBe('price_1ExampleBlueMug');
    });

    it('should replace {image} placeholder', () => {
      const result = renderChildTemplate('{image}', sampleProduct);
      expect(result).toBe('☕');
    });

    it('should render product card template with all placeholders', () => {
      const template = '<div>{title} - {price} <button data-id="{short-uri}">{image}</button></div>';
      const result = renderChildTemplate(template, sampleProduct);
      expect(result).toBe('<div>Blue Ceramic Mug - $12.00 <button data-id="blue-mug">☕</button></div>');
    });

    it('should default product fields to empty for non-product pages', () => {
      const result = renderChildTemplate('{price}|{image}|{currency}', sampleChildren[0]);
      expect(result).toBe('||');
    });
  });

  describe('processChildrenDirectives', () => {
    it('should render default template when body is empty', () => {
      const markdown = '# Blog\n\n:::children\n:::';
      const result = processChildrenDirectives(markdown, sampleChildren);

      expect(result).toContain(':::html');
      expect(result).toContain('Getting Started with HTMX');
      expect(result).toContain('Tailwind Patterns');
      expect(result).toContain('Static Sites Are Back');
    });

    it('should render custom template', () => {
      const markdown = '# Blog\n\n:::children\n<li><a href="{url}">{title}</a></li>\n:::';
      const result = processChildrenDirectives(markdown, sampleChildren);

      expect(result).toContain('<li><a href="/blog/getting-started-with-htmx">Getting Started with HTMX</a></li>');
      expect(result).toContain('<li><a href="/blog/tailwind-patterns">Tailwind Patterns</a></li>');
    });

    it('should sort by date descending by default', () => {
      const markdown = ':::children\n:::';
      const result = processChildrenDirectives(markdown, sampleChildren);

      const htmxPos = result.indexOf('Getting Started with HTMX');
      const tailwindPos = result.indexOf('Tailwind Patterns');
      const staticPos = result.indexOf('Static Sites Are Back');

      expect(htmxPos).toBeLessThan(tailwindPos);
      expect(tailwindPos).toBeLessThan(staticPos);
    });

    it('should sort by date ascending', () => {
      const markdown = ':::children sort=date-asc\n:::';
      const result = processChildrenDirectives(markdown, sampleChildren);

      const htmxPos = result.indexOf('Getting Started with HTMX');
      const staticPos = result.indexOf('Static Sites Are Back');

      expect(staticPos).toBeLessThan(htmxPos);
    });

    it('should sort by title', () => {
      const markdown = ':::children sort=title\n:::';
      const result = processChildrenDirectives(markdown, sampleChildren);

      const gettingPos = result.indexOf('Getting Started');
      const staticPos = result.indexOf('Static Sites');
      const tailwindPos = result.indexOf('Tailwind Patterns');

      expect(gettingPos).toBeLessThan(staticPos);
      expect(staticPos).toBeLessThan(tailwindPos);
    });

    it('should sort by order', () => {
      const markdown = ':::children sort=order\n:::';
      const result = processChildrenDirectives(markdown, sampleChildren);

      const htmxPos = result.indexOf('Getting Started with HTMX');
      const tailwindPos = result.indexOf('Tailwind Patterns');
      const staticPos = result.indexOf('Static Sites Are Back');

      expect(htmxPos).toBeLessThan(tailwindPos);
      expect(tailwindPos).toBeLessThan(staticPos);
    });

    it('should respect limit option', () => {
      const markdown = ':::children limit=2\n:::';
      const result = processChildrenDirectives(markdown, sampleChildren);

      expect(result).toContain('Getting Started with HTMX');
      expect(result).toContain('Tailwind Patterns');
      expect(result).not.toContain('Static Sites Are Back');
    });

    it('should use custom wrapper class', () => {
      const markdown = ':::children class="grid grid-cols-2 gap-4"\n:::';
      const result = processChildrenDirectives(markdown, sampleChildren);

      expect(result).toContain('grid grid-cols-2 gap-4');
    });

    it('should output nothing when no children exist', () => {
      const markdown = '# Blog\n\n:::children\n:::';
      const result = processChildrenDirectives(markdown, []);

      expect(result).not.toContain(':::html');
      expect(result).toContain('# Blog');
    });

    it('should preserve surrounding content', () => {
      const markdown = '# Title\n\nSome intro.\n\n:::children\n:::\n\n## Footer';
      const result = processChildrenDirectives(markdown, sampleChildren);

      expect(result).toContain('# Title');
      expect(result).toContain('Some intro.');
      expect(result).toContain('## Footer');
      expect(result).toContain('Getting Started with HTMX');
    });

    it('should handle combined sort and limit options', () => {
      const markdown = ':::children sort=title limit=1\n:::';
      const result = processChildrenDirectives(markdown, sampleChildren);

      // Title sort, limit 1 → "Getting Started with HTMX" (alphabetically first)
      expect(result).toContain('Getting Started with HTMX');
      expect(result).not.toContain('Static Sites Are Back');
      expect(result).not.toContain('Tailwind Patterns');
    });

    it('should wrap output in :::html block', () => {
      const markdown = ':::children\n:::';
      const result = processChildrenDirectives(markdown, sampleChildren);

      expect(result).toContain(':::html');
      expect(result).toContain(':::');
    });

    it('should use default space-y-4 wrapper class', () => {
      const markdown = ':::children\n:::';
      const result = processChildrenDirectives(markdown, sampleChildren);

      expect(result).toContain('class="space-y-4"');
    });

    it('should not modify markdown without :::children directives', () => {
      const markdown = '# Just a page\n\nNo directives here.';
      const result = processChildrenDirectives(markdown, sampleChildren);

      expect(result).toBe(markdown);
    });

    it('should handle CRLF line endings', () => {
      const markdown = '# Blog\r\n\r\n:::children sort=date-desc\r\n:::\r\n\r\nMore content';
      const result = processChildrenDirectives(markdown, sampleChildren);

      expect(result).not.toContain(':::children');
      expect(result).toContain(':::html');
      expect(result).toContain('Getting Started with HTMX');
      expect(result).toContain('More content');
    });

    it('should handle CRLF with custom template', () => {
      const markdown = ':::children\r\n<li>{title}</li>\r\n:::\r\n';
      const result = processChildrenDirectives(markdown, sampleChildren);

      expect(result).toContain('<li>Getting Started with HTMX</li>');
      expect(result).toContain('<li>Tailwind Patterns</li>');
    });

    it('should filter children by type=product', () => {
      const mixed = [...sampleChildren, sampleProduct];
      const markdown = ':::children type=product\n<div>{title} - {price}</div>\n:::';
      const result = processChildrenDirectives(markdown, mixed);

      expect(result).toContain('Blue Ceramic Mug - $12.00');
      expect(result).not.toContain('Getting Started with HTMX');
      expect(result).not.toContain('Tailwind Patterns');
      expect(result).not.toContain('Static Sites Are Back');
    });

    it('should filter children by type=post', () => {
      const mixed = [...sampleChildren, sampleProduct];
      const markdown = ':::children type=post\n<div>{title}</div>\n:::';
      const result = processChildrenDirectives(markdown, mixed);

      expect(result).toContain('Getting Started with HTMX');
      expect(result).not.toContain('Blue Ceramic Mug');
    });

    it('should return empty when type filter matches nothing', () => {
      const markdown = '# Shop\n\n:::children type=product\n<div>{title}</div>\n:::';
      const result = processChildrenDirectives(markdown, sampleChildren);

      expect(result).not.toContain(':::html');
      expect(result).toContain('# Shop');
    });

    it('should combine type filter with sort and limit', () => {
      const product2: ChildPageData = {
        ...sampleProduct,
        title: 'Red Ceramic Mug',
        shortUri: 'red-mug',
        url: '/shop/red-mug',
        order: 2,
        price: '$15.00',
        priceCents: 1500,
      };
      const mixed = [...sampleChildren, sampleProduct, product2];
      const markdown = ':::children type=product sort=order limit=1\n<div>{title}</div>\n:::';
      const result = processChildrenDirectives(markdown, mixed);

      expect(result).toContain('Blue Ceramic Mug');
      expect(result).not.toContain('Red Ceramic Mug');
      expect(result).not.toContain('Getting Started');
    });
  });
});
