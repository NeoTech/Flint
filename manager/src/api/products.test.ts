/**
 * Tests for api/products.ts — read/write products.yaml + SSE commands.
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';
import type { Product } from './products.js';

// ---- mock registry + runner -------------------------------------------------

let mockSitePath = '';
const spawnCalls: string[][] = [];

mock.module('../registry.js', () => ({
  getSite: (id: string) => id === 'test' ? { id: 'test', name: 'Test', path: mockSitePath } : null,
  resolveSitePath: (site: { path: string }) => site.path,
  // include full surface so other test files don't see a partial mock
  loadRegistry: () => [],
  saveRegistry: () => {},
  upsertSite: () => {},
  removeSite: () => {},
}));

mock.module('../runner.js', () => ({
  spawnAsStream: (cmd: string[]) => {
    spawnCalls.push(cmd);
    return new ReadableStream({
      start(controller) {
        controller.enqueue('data: done\n\n');
        controller.close();
      },
    });
  },
}));

const {
  handleGetProducts,
  handleSaveProducts,
  handleGetProductsParsed,
  handleSaveProductsParsed,
  handleGenerateProducts,
  handleSyncProducts,
} = await import('./products.js');

// ---- helpers ----------------------------------------------------------------

async function jsonBody(r: Response): Promise<unknown> {
  return r.json();
}

function makeRequest(body: unknown, method = 'PUT'): Request {
  return new Request('http://localhost/', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const SAMPLE_YAML = `products:
  - id: blue-mug
    title: Blue Mug
    price_cents: 1500
`;

const SAMPLE_PRODUCTS: Product[] = [
  { id: 'blue-mug', title: 'Blue Mug', price_cents: 1500 },
];

// ---- setup ------------------------------------------------------------------

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'manager-products-test-'));
  mockSitePath = tempDir;
  spawnCalls.length = 0;
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

// ---- handleGetProducts (raw) ------------------------------------------------

describe('handleGetProducts', () => {
  it('returns empty content when products.yaml absent', async () => {
    const resp = handleGetProducts('test');
    expect(resp.status).toBe(200);
    const body = await jsonBody(resp) as Record<string, string>;
    expect(body.content).toBe('');
  });

  it('returns raw YAML content as string', async () => {
    writeFileSync(join(tempDir, 'products.yaml'), SAMPLE_YAML);
    const resp = handleGetProducts('test');
    expect(resp.status).toBe(200);
    const body = await jsonBody(resp) as Record<string, string>;
    expect(body.content).toBe(SAMPLE_YAML);
  });

  it('returns 404 for unknown site', () => {
    expect(handleGetProducts('ghost').status).toBe(404);
  });
});

// ---- handleSaveProducts (raw) -----------------------------------------------

describe('handleSaveProducts', () => {
  it('writes raw content string to products.yaml', async () => {
    const resp = await handleSaveProducts('test', makeRequest({ content: SAMPLE_YAML }));
    expect(resp.status).toBe(200);
    expect(readFileSync(join(tempDir, 'products.yaml'), 'utf-8')).toBe(SAMPLE_YAML);
  });

  it('overwrites existing products.yaml', async () => {
    writeFileSync(join(tempDir, 'products.yaml'), 'products: []');
    await handleSaveProducts('test', makeRequest({ content: SAMPLE_YAML }));
    expect(readFileSync(join(tempDir, 'products.yaml'), 'utf-8')).toBe(SAMPLE_YAML);
  });

  it('returns 400 if content field is missing', async () => {
    const resp = await handleSaveProducts('test', makeRequest({}));
    expect(resp.status).toBe(400);
  });

  it('returns 400 on invalid JSON', async () => {
    const req = new Request('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'bad json{',
    });
    expect((await handleSaveProducts('test', req)).status).toBe(400);
  });

  it('returns 404 for unknown site', async () => {
    const resp = await handleSaveProducts('ghost', makeRequest({ content: '' }));
    expect(resp.status).toBe(404);
  });
});

// ---- handleGetProductsParsed ------------------------------------------------

describe('handleGetProductsParsed', () => {
  it('returns empty products array when file absent', async () => {
    const resp = handleGetProductsParsed('test');
    expect(resp.status).toBe(200);
    expect(await jsonBody(resp)).toEqual({ products: [] });
  });

  it('parses YAML and returns product array', async () => {
    writeFileSync(join(tempDir, 'products.yaml'), SAMPLE_YAML);
    const resp = handleGetProductsParsed('test');
    const body = await jsonBody(resp) as { products: Product[] };
    expect(body.products).toHaveLength(1);
    expect(body.products[0].id).toBe('blue-mug');
    expect(body.products[0].title).toBe('Blue Mug');
    expect(body.products[0].price_cents).toBe(1500);
  });

  it('handles YAML with no products key', async () => {
    writeFileSync(join(tempDir, 'products.yaml'), 'some_other_key: value\n');
    const resp = handleGetProductsParsed('test');
    expect(await jsonBody(resp)).toEqual({ products: [] });
  });

  it('returns 404 for unknown site', () => {
    expect(handleGetProductsParsed('ghost').status).toBe(404);
  });
});

// ---- handleSaveProductsParsed -----------------------------------------------

describe('handleSaveProductsParsed', () => {
  it('writes products array as valid YAML', async () => {
    const resp = await handleSaveProductsParsed(
      'test',
      makeRequest({ products: SAMPLE_PRODUCTS }),
    );
    expect(resp.status).toBe(200);
    const saved = readFileSync(join(tempDir, 'products.yaml'), 'utf-8');
    const parsed = yaml.load(saved) as { products: Product[] };
    expect(parsed.products).toHaveLength(1);
    expect(parsed.products[0].id).toBe('blue-mug');
    expect(parsed.products[0].price_cents).toBe(1500);
  });

  it('writes all product fields through round-trip', async () => {
    const products: Product[] = [{
      id: 'sneakers',
      title: 'Classic Sneakers',
      description: 'Great shoes',
      price_cents: 8900,
      currency: 'usd',
      image: '/img/sneakers.jpg',
      order: 2,
      labels: ['footwear', 'sale'],
      stripe_price_id: 'price_abc123',
    }];
    await handleSaveProductsParsed('test', makeRequest({ products }));
    const saved = yaml.load(readFileSync(join(tempDir, 'products.yaml'), 'utf-8')) as { products: Product[] };
    expect(saved.products[0]).toMatchObject({ id: 'sneakers', title: 'Classic Sneakers', price_cents: 8900 });
    expect(saved.products[0].labels).toEqual(['footwear', 'sale']);
  });

  it('returns 400 if products is not an array', async () => {
    const resp = await handleSaveProductsParsed('test', makeRequest({ products: {} }));
    expect(resp.status).toBe(400);
  });

  it('returns 400 on invalid JSON', async () => {
    const req = new Request('http://localhost/', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{ bad',
    });
    expect((await handleSaveProductsParsed('test', req)).status).toBe(400);
  });

  it('returns 404 for unknown site', async () => {
    const resp = await handleSaveProductsParsed('ghost', makeRequest({ products: [] }));
    expect(resp.status).toBe(404);
  });
});

// ---- handleGenerateProducts -------------------------------------------------

describe('handleGenerateProducts', () => {
  it('returns SSE stream response with event-stream content type', () => {
    const resp = handleGenerateProducts('test');
    expect(resp.status).toBe(200);
    expect(resp.headers.get('Content-Type')).toContain('text/event-stream');
  });

  it('calls spawnAsStream with bun run generate', () => {
    handleGenerateProducts('test');
    expect(spawnCalls.some(cmd => cmd.join(' ') === 'bun run generate')).toBe(true);
  });

  it('returns 404 for unknown site', () => {
    expect(handleGenerateProducts('ghost').status).toBe(404);
  });
});

// ---- handleSyncProducts -----------------------------------------------------

describe('handleSyncProducts', () => {
  it('returns SSE stream response for normal sync', () => {
    const resp = handleSyncProducts('test', false);
    expect(resp.status).toBe(200);
    expect(resp.headers.get('Content-Type')).toContain('text/event-stream');
  });

  it('calls build:sync script for normal sync', () => {
    handleSyncProducts('test', false);
    expect(spawnCalls.some(cmd => cmd.join(' ') === 'bun run build:sync')).toBe(true);
  });

  it('calls build:sync:force script when force=true', () => {
    handleSyncProducts('test', true);
    expect(spawnCalls.some(cmd => cmd.join(' ') === 'bun run build:sync:force')).toBe(true);
  });

  it('returns 404 for unknown site', () => {
    expect(handleSyncProducts('ghost').status).toBe(404);
  });
});
