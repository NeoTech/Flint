import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db and crypto modules
vi.mock('../core/db.js', () => {
  const store: Record<string, any> = {};
  return {
    get: async (_s: string, k: string) => (store[k] ?? null),
    set: async (_s: string, k: string, v: any) => { store[k] = v; },
    del: async (_s: string, k: string) => { delete store[k]; },
  };
});

vi.mock('../core/crypto.js', () => {
  return {
    isAvailable: () => true,
    deriveKeyFromSeed: async (_: Uint8Array) => ({ fake: 'key' } as any),
    encryptJson: async (_k: any, obj: any) => ({ iv: [1,2,3], ct: Array.from(Buffer.from(JSON.stringify(obj)))}),
    decryptJson: async (_k: any, _iv: number[], ct: number[]) => JSON.parse(Buffer.from(ct).toString()),
  };
});

import { CartAPI } from './cart-api.js';

describe('CartAPI (unit)', () => {
  beforeEach(async () => {
    // ensure clear state
    await CartAPI.clear();
  });

  it('adds and retrieves items', async () => {
    await CartAPI.addItem('blue-mug', 2);
    const items = await CartAPI.getItems();
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ id: 'blue-mug', qty: 2 });
  });

  it('updates quantity', async () => {
    await CartAPI.addItem('blue-mug', 1);
    await CartAPI.updateQuantity('blue-mug', 5);
    const items = await CartAPI.getItems();
    expect(items[0].qty).toBe(5);
  });

  it('removes items', async () => {
    await CartAPI.addItem('blue-mug', 1);
    await CartAPI.removeItem('blue-mug');
    const items = await CartAPI.getItems();
    expect(items).toHaveLength(0);
  });
});
