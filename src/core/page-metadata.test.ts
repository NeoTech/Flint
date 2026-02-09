import { describe, it, expect } from 'vitest';
import { 
  parsePageMetadata, 
  validatePageMetadata,
  generateShortUri,
  type PageMetadata 
} from './page-metadata.js';

describe('PageMetadata Parser', () => {
  describe('parsePageMetadata', () => {
    it('should parse all required fields', () => {
      const input = `---
Short-URI: getting-started
Type: page
Category: Documentation
Labels:
  - tutorial
  - beginner
Parent: root
Author: John Doe
Date: 2024-01-15
Description: A getting started guide
Keywords:
  - guide
  - tutorial
---

# Content`;

      const result = parsePageMetadata(input);

      expect(result.shortUri).toBe('getting-started');
      expect(result.type).toBe('page');
      expect(result.category).toBe('Documentation');
      expect(result.labels).toEqual(['tutorial', 'beginner']);
      expect(result.parent).toBe('root');
      expect(result.author).toBe('John Doe');
      expect(result.date).toBeInstanceOf(Date);
      expect(result.description).toBe('A getting started guide');
      expect(result.keywords).toEqual(['guide', 'tutorial']);
    });

    it('should handle empty parent as root', () => {
      const input = `---
Short-URI: home
Type: page
Parent: null
---

# Home`;

      const result = parsePageMetadata(input);
      expect(result.parent).toBe('root');
    });

    it('should handle missing parent as root', () => {
      const input = `---
Short-URI: home
Type: page
---

# Home`;

      const result = parsePageMetadata(input);
      expect(result.parent).toBe('root');
    });

    it('should parse Date as Date object', () => {
      const input = `---
Short-URI: test
Date: 2024-03-15T10:30:00Z
---

# Test`;

      const result = parsePageMetadata(input);
      expect(result.date).toBeInstanceOf(Date);
    });

    it('should handle single label as array', () => {
      const input = `---
Short-URI: test
Labels: tutorial
---

# Test`;

      const result = parsePageMetadata(input);
      expect(result.labels).toEqual(['tutorial']);
    });

    it('should handle empty labels', () => {
      const input = `---
Short-URI: test
---

# Test`;

      const result = parsePageMetadata(input);
      expect(result.labels).toEqual([]);
    });

    it('should parse Order field', () => {
      const input = `---
Short-URI: test
Order: 10
---

# Test`;

      const result = parsePageMetadata(input);
      expect(result.order).toBe(10);
    });

    it('should default Order to 999 when missing', () => {
      const input = `---
Short-URI: test
---

# Test`;

      const result = parsePageMetadata(input);
      expect(result.order).toBe(999);
    });

    it('should handle invalid Order as 999', () => {
      const input = `---
Short-URI: test
Order: abc
---

# Test`;

      const result = parsePageMetadata(input);
      expect(result.order).toBe(999);
    });

    it('should parse Template field', () => {
      const input = `---
Short-URI: test
Template: blog-post
---

# Test`;

      const result = parsePageMetadata(input);
      expect(result.template).toBe('blog-post');
    });

    it('should default Template to "default" when missing', () => {
      const input = `---
Short-URI: test
---

# Test`;

      const result = parsePageMetadata(input);
      expect(result.template).toBe('default');
    });

    it('should throw on invalid Type', () => {
      const input = `---
Short-URI: test
Type: invalid-type
---

# Test`;

      expect(() => parsePageMetadata(input)).toThrow('Invalid Type');
    });

    it('should accept Type: product', () => {
      const input = `---
Short-URI: blue-mug
Type: product
Category: Shop
PriceCents: 1200
Currency: usd
StripePriceId: price_1ExampleBlueMug
Image: ☕
---

# Blue Mug`;

      const result = parsePageMetadata(input);
      expect(result.type).toBe('product');
      expect(result.priceCents).toBe(1200);
      expect(result.currency).toBe('usd');
      expect(result.stripePriceId).toBe('price_1ExampleBlueMug');
      expect(result.image).toBe('☕');
    });

    it('should parse Price-Cents as alternative to PriceCents', () => {
      const input = `---
Short-URI: red-mug
Type: product
Price-Cents: 1500
Stripe-Price-Id: price_1RedMug
---

# Red Mug`;

      const result = parsePageMetadata(input);
      expect(result.priceCents).toBe(1500);
      expect(result.stripePriceId).toBe('price_1RedMug');
    });

    it('should default product fields for non-product types', () => {
      const input = `---
Short-URI: about
Type: page
---

# About`;

      const result = parsePageMetadata(input);
      expect(result.priceCents).toBe(0);
      expect(result.currency).toBe('usd');
      expect(result.stripePriceId).toBe('');
      expect(result.image).toBe('');
    });

    it('should throw on missing Short-URI', () => {
      const input = `---
Type: page
---

# Test`;

      expect(() => parsePageMetadata(input)).toThrow('Short-URI is required');
    });
  });

  describe('validatePageMetadata', () => {
    it('should pass valid metadata', () => {
      const metadata: PageMetadata = {
        shortUri: 'test',
        type: 'page',
        category: 'Docs',
        labels: ['tag'],
        parent: 'root',
        author: 'Test',
        date: '2024-01-01',
        description: 'Test',
        keywords: ['test'],
      };

      expect(() => validatePageMetadata(metadata)).not.toThrow();
    });

    it('should throw on empty Short-URI', () => {
      const metadata: PageMetadata = {
        shortUri: '',
        type: 'page',
      };

      expect(() => validatePageMetadata(metadata)).toThrow('Short-URI cannot be empty');
    });

    it('should throw on invalid Short-URI characters', () => {
      const metadata: PageMetadata = {
        shortUri: 'test page!',
        type: 'page',
      };

      expect(() => validatePageMetadata(metadata)).toThrow('Short-URI contains invalid characters');
    });

    it('should throw on non-existent parent reference', () => {
      const metadata: PageMetadata = {
        shortUri: 'test',
        type: 'page',
        parent: 'non-existent',
      };

      const existingUris = new Set(['root', 'other']);
      expect(() => validatePageMetadata(metadata, existingUris)).toThrow('does not exist');
    });
  });

  describe('generateShortUri', () => {
    it('should generate slug from title', () => {
      const result = generateShortUri('Getting Started Guide');
      expect(result).toBe('getting-started-guide');
    });

    it('should handle special characters', () => {
      const result = generateShortUri('C++ & C# Programming!');
      expect(result).toBe('c-c-programming');
    });

    it('should handle duplicate URIs by enumerating', () => {
      const existing = new Set(['test', 'test-2']);
      const result = generateShortUri('Test', existing);
      expect(result).toBe('test-3');
    });

    it('should return original if not duplicate', () => {
      const existing = new Set(['other']);
      const result = generateShortUri('Test', existing);
      expect(result).toBe('test');
    });
  });
});
