import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * crypto.ts relies on window.crypto.subtle (Web Crypto API).
 * In the Node/happy-dom test environment we mock SubtleCrypto
 * to verify the function contracts and call sequences.
 */

// Minimal mock CryptoKey
const fakeCryptoKey = { type: 'secret', algorithm: { name: 'AES-GCM' } } as unknown as CryptoKey;

const mockSubtle = {
  digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
  importKey: vi.fn().mockResolvedValue(fakeCryptoKey),
  encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
  decrypt: vi.fn().mockImplementation(async () => {
    return new TextEncoder().encode(JSON.stringify({ items: [] })).buffer;
  }),
};

beforeEach(() => {
  vi.clearAllMocks();

  // Provide window.crypto.subtle and window.crypto.getRandomValues
  Object.defineProperty(globalThis, 'window', {
    value: {
      crypto: {
        subtle: mockSubtle,
        getRandomValues: (arr: Uint8Array) => {
          for (let i = 0; i < arr.length; i++) arr[i] = i % 256;
          return arr;
        },
      },
    },
    writable: true,
    configurable: true,
  });
});

// Import after mocks are set
import { deriveKeyFromSeed, encryptJson, decryptJson, isAvailable } from './crypto.js';

describe('isAvailable', () => {
  it('should return true when window.crypto.subtle exists', () => {
    expect(isAvailable()).toBe(true);
  });

  it('should return false when subtle is missing', () => {
    const saved = (window as any).crypto;
    Object.defineProperty(globalThis, 'window', {
      value: { crypto: {} },
      writable: true,
      configurable: true,
    });
    expect(isAvailable()).toBe(false);
    // restore
    Object.defineProperty(globalThis, 'window', {
      value: { crypto: saved },
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
