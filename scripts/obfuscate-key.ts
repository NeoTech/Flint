/**
 * XOR-obfuscate the Stripe publishable key for client-side injection.
 *
 * Generates a random mask and XOR'd data so the raw key doesn't appear
 * as a plaintext string in the JS bundle.
 *
 * This is cosmetic obfuscation — Stripe publishable keys are inherently
 * shareable — but it prevents naive scraping of the bundle.
 */

import { readFileSync } from 'fs';
import { randomBytes } from 'crypto';
import { join } from 'path';

/**
 * Read STRIPE_PUBLISHABLE_KEY from environment or .env file
 */
export function getPublishableKey(): string {
  let key = process.env.STRIPE_PUBLISHABLE_KEY;

  if (!key) {
    try {
      const envFile = readFileSync(join(process.cwd(), '.env'), 'utf-8');
      const match = envFile.match(/^STRIPE_PUBLISHABLE_KEY=(.+)$/m);
      if (match) key = match[1].trim();
    } catch {
      // .env may not exist
    }
  }

  return key || '';
}

/**
 * XOR-obfuscate a string and return mask + data as hex strings
 */
export function obfuscateString(input: string): { mask: string; data: string } {
  if (!input) {
    return { mask: '', data: '' };
  }

  const bytes = Buffer.from(input, 'utf-8');
  const mask = randomBytes(bytes.length);
  const data = Buffer.alloc(bytes.length);

  for (let i = 0; i < bytes.length; i++) {
    data[i] = bytes[i] ^ mask[i];
  }

  return {
    mask: mask.toString('hex'),
    data: data.toString('hex'),
  };
}

/**
 * Generate DefinePlugin replacement values for Rspack
 */
export function getKeyDefines(): Record<string, string> {
  const key = getPublishableKey();
  const { mask, data } = obfuscateString(key);

  return {
    __STRIPE_KEY_MASK__: JSON.stringify(mask),
    __STRIPE_KEY_DATA__: JSON.stringify(data),
  };
}
