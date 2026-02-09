/**
 * Lightweight WebCrypto helpers for deriving an AES-GCM key
 * and encrypting/decrypting JSON payloads.
 */

/** Returns true when the Web Crypto subtle API is usable (secure context). */
export function isAvailable(): boolean {
  return typeof window !== 'undefined' && 'crypto' in window && !!window.crypto.subtle;
}

export async function deriveKeyFromSeed(seedArr: Uint8Array): Promise<CryptoKey> {
  if (!isAvailable()) {
    throw new Error('Web Crypto not available');
  }

  const subtle = window.crypto.subtle;
  const hash = await subtle.digest('SHA-256', seedArr as unknown as ArrayBuffer);
  return subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptJson(key: CryptoKey, obj: any): Promise<{ iv: number[]; ct: number[] }> {
  const subtle = window.crypto.subtle;
  const iv = new Uint8Array(12);
  window.crypto.getRandomValues(iv);
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(obj));
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { iv: Array.from(iv), ct: Array.from(new Uint8Array(ct)) };
}

export async function decryptJson(key: CryptoKey, ivArr: number[], ctArr: number[]): Promise<any> {
  const subtle = window.crypto.subtle;
  const iv = new Uint8Array(ivArr);
  const ct = new Uint8Array(ctArr).buffer;
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  const decoder = new TextDecoder();
  const text = decoder.decode(plain);
  return JSON.parse(text);
}
