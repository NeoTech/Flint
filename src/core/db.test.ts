import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * db.ts relies on window.indexedDB (browser API).
 * In the Node/happy-dom test environment we mock IndexedDB
 * to verify the function contracts.
 */

// In-memory store that simulates IndexedDB
const memStore: Record<string, Record<string, unknown>> = {
  kv: {},
  secrets: {},
};

// Minimal IDB mock
function createMockIDB() {
  const mockObjectStore = (name: string) => ({
    get: (key: string) => {
      const val = memStore[name]?.[key];
      const req = { result: val === undefined ? undefined : val, onsuccess: null as any, onerror: null as any };
      setTimeout(() => req.onsuccess?.(), 0);
      return req;
    },
    put: (val: unknown, key: string) => {
      if (!memStore[name]) memStore[name] = {};
      memStore[name][key] = val;
      const req = { onsuccess: null as any, onerror: null as any };
      setTimeout(() => req.onsuccess?.(), 0);
      return req;
    },
    delete: (key: string) => {
      if (memStore[name]) delete memStore[name][key];
      const req = { onsuccess: null as any, onerror: null as any };
      setTimeout(() => req.onsuccess?.(), 0);
      return req;
    },
  });

  const mockDB = {
    objectStoreNames: { contains: () => true },
    createObjectStore: vi.fn(),
    transaction: (stores: string[]) => ({
      objectStore: (name: string) => mockObjectStore(name),
    }),
  };

  return {
    open: (_name: string, _version: number) => {
      const req = {
        result: mockDB,
        onupgradeneeded: null as any,
        onsuccess: null as any,
        onerror: null as any,
      };
      setTimeout(() => req.onsuccess?.(), 0);
      return req;
    },
  };
}

beforeEach(() => {
  // Reset stores
  memStore.kv = {};
  memStore.secrets = {};

  // Provide window.indexedDB mock
  Object.defineProperty(globalThis, 'window', {
    value: {
      indexedDB: createMockIDB(),
    },
    writable: true,
    configurable: true,
  });
});

import { get, set, del } from './db.js';

describe('db helpers', () => {
  it('should store and retrieve a value from kv', async () => {
    await set('kv', 'test-key', { hello: 'world' });
    const result = await get('kv', 'test-key');

    expect(result).toEqual({ hello: 'world' });
  });

  it('should return null for missing keys', async () => {
    const result = await get('kv', 'nonexistent');

    expect(result).toBeNull();
  });

  it('should delete a key', async () => {
    await set('kv', 'to-delete', 'value');
    await del('kv', 'to-delete');
    const result = await get('kv', 'to-delete');

    expect(result).toBeNull();
  });

  it('should store and retrieve from secrets store', async () => {
    await set('secrets', 'seed', [1, 2, 3]);
    const result = await get('secrets', 'seed');

    expect(result).toEqual([1, 2, 3]);
  });

  it('should overwrite existing values', async () => {
    await set('kv', 'key', 'first');
    await set('kv', 'key', 'second');
    const result = await get('kv', 'key');

    expect(result).toBe('second');
  });
});
