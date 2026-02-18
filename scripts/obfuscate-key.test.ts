import { describe, test, expect } from 'bun:test';
import { obfuscateString, getKeyDefines } from './obfuscate-key.js';

describe('obfuscate-key', () => {
  test('obfuscateString returns empty for empty input', () => {
    const result = obfuscateString('');
    expect(result.mask).toBe('');
    expect(result.data).toBe('');
  });

  test('obfuscateString produces mask and data of correct length', () => {
    const input = 'pk_test_abc123';
    const result = obfuscateString(input);

    // hex = 2 chars per byte, input is UTF-8
    const expectedHexLen = Buffer.from(input, 'utf-8').length * 2;
    expect(result.mask.length).toBe(expectedHexLen);
    expect(result.data.length).toBe(expectedHexLen);
  });

  test('XOR of mask and data recovers original string', () => {
    const input = 'pk_test_51abc_xyz';
    const { mask, data } = obfuscateString(input);

    const maskBuf = Buffer.from(mask, 'hex');
    const dataBuf = Buffer.from(data, 'hex');
    const recovered = Buffer.alloc(maskBuf.length);

    for (let i = 0; i < maskBuf.length; i++) {
      recovered[i] = maskBuf[i] ^ dataBuf[i];
    }

    expect(recovered.toString('utf-8')).toBe(input);
  });

  test('obfuscateString produces different mask each call', () => {
    const input = 'pk_test_identical';
    const a = obfuscateString(input);
    const b = obfuscateString(input);
    expect(a.mask).not.toBe(b.mask);
    expect(a.data).not.toBe(b.data);
  });

  test('getKeyDefines returns stringified JSON values', () => {
    const defines = getKeyDefines();
    expect(typeof defines.__STRIPE_KEY_MASK__).toBe('string');
    expect(typeof defines.__STRIPE_KEY_DATA__).toBe('string');
    // They should be JSON-stringified (wrapped in quotes)
    expect(defines.__STRIPE_KEY_MASK__.startsWith('"')).toBe(true);
    expect(defines.__STRIPE_KEY_DATA__.startsWith('"')).toBe(true);
  });
});
