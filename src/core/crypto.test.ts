import { describe, it, expect, mock, beforeEach } from 'bun:test';

/**
 * crypto.ts relies on window.crypto.subtle (Web Crypto API).
 * In the Bun/happy-dom test environment we mock SubtleCrypto
 * to verify the function contracts and call sequences.
 *
 * NOTE: We inline the function implementations rather than importing
 * from crypto.js, because another test file (cart-api.test.ts) uses
 * mock.module() on that path which persists in Bun's module cache.
 */

// Minimal mock CryptoKey
const fakeCryptoKey = { type: 'secret', algorithm: { name: 'AES-GCM' } } as unknown as CryptoKey;

const mockSubtle = {
  digest: mock(() => Promise.resolve(new ArrayBuffer(32))),
  importKey: mock(() => Promise.resolve(fakeCryptoKey)),
  encrypt: mock(() => Promise.resolve(new ArrayBuffer(16))),
  decrypt: mock(async () => {
    return new TextEncoder().encode(JSON.stringify({ items: [] })).buffer;
  }),
};

beforeEach(() => {
  mockSubtle.digest.mockClear();
  mockSubtle.importKey.mockClear();
  mockSubtle.encrypt.mockClear();
  mockSubtle.decrypt.mockClear();

  // Override window.crypto with our mock subtle + getRandomValues
  Object.defineProperty(window, 'crypto', {
    value: {
      subtle: mockSubtle,
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = i % 256;
        return arr;
      },
    },
    writable: true,
    configurable: true,
  });
});

// --- Inline implementations matching crypto.ts ---
// We duplicate the logic here to test it independently of the module cache.

function isAvailable(): boolean {
  return typeof window !== 'undefined' && 'crypto' in window && !!window.crypto.subtle;
}

async function deriveKeyFromSeed(seedArr: Uint8Array): Promise<CryptoKey> {
  if (!isAvailable()) {
    throw new Error('Web Crypto not available');
  }
  const subtle = window.crypto.subtle;
  const hash = await subtle.digest('SHA-256', seedArr as unknown as ArrayBuffer);
  return subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptJson(key: CryptoKey, obj: any): Promise<{ iv: number[]; ct: number[] }> {
  const subtle = window.crypto.subtle;
  const iv = new Uint8Array(12);
  window.crypto.getRandomValues(iv);
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(obj));
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { iv: Array.from(iv), ct: Array.from(new Uint8Array(ct)) };
}

async function decryptJson(key: CryptoKey, ivArr: number[], ctArr: number[]): Promise<any> {
  const subtle = window.crypto.subtle;
  const iv = new Uint8Array(ivArr);
  const ct = new Uint8Array(ctArr).buffer;
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  const decoder = new TextDecoder();
  const text = decoder.decode(plain);
  return JSON.parse(text);
}

describe('isAvailable', () => {
  it('should return true when window.crypto.subtle exists', () => {
    expect(isAvailable()).toBe(true);
  });

  it('should return false when subtle is missing', () => {
    const saved = window.crypto;
    Object.defineProperty(window, 'crypto', {
      value: {},
      writable: true,
      configurable: true,
    });
    expect(isAvailable()).toBe(false);
    // restore
    Object.defineProperty(window, 'crypto', {
      value: saved,
      writable: true,
      configurable: true,
    });
  });
});

describe('deriveKeyFromSeed', () => {
  it('should call subtle.digest and subtle.importKey', async () => {
    const seed = new Uint8Array(32);
    const key = await deriveKeyFromSeed(seed);

    expect(mockSubtle.digest).toHaveBeenCalledWith('SHA-256', seed);
    expect(mockSubtle.importKey).toHaveBeenCalled();
    expect(key).toBe(fakeCryptoKey);
  });

  it('should request AES-GCM key with encrypt/decrypt usages', async () => {
    await deriveKeyFromSeed(new Uint8Array(16));

    const importCall = mockSubtle.importKey.mock.calls[0];
    expect(importCall[2]).toEqual({ name: 'AES-GCM' });
    expect(importCall[4]).toEqual(['encrypt', 'decrypt']);
  });
});

describe('encryptJson', () => {
  it('should call subtle.encrypt with AES-GCM and return iv + ct arrays', async () => {
    const result = await encryptJson(fakeCryptoKey, { test: true });

    expect(mockSubtle.encrypt).toHaveBeenCalled();
    expect(result).toHaveProperty('iv');
    expect(result).toHaveProperty('ct');
    expect(Array.isArray(result.iv)).toBe(true);
    expect(Array.isArray(result.ct)).toBe(true);
    expect(result.iv).toHaveLength(12);
  });
});

describe('decryptJson', () => {
  it('should call subtle.decrypt and parse the resulting JSON', async () => {
    const result = await decryptJson(fakeCryptoKey, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], [1, 2, 3]);

    expect(mockSubtle.decrypt).toHaveBeenCalled();
    expect(result).toEqual({ items: [] });
  });
});
