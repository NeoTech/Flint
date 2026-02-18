import { parseFrontmatter, type FrontmatterData } from './frontmatter.js';

export type PageType = 'page' | 'post' | 'section' | 'product';

export interface PageMetadata {
  shortUri: string;
  title: string;
  type: PageType;
  category: string;
  labels: string[];
  parent: string;
  order: number;
  author: string;
  date: Date | null;
  description: string;
  keywords: string[];
  template: string;
  /** Product-specific: price in cents (e.g. 1200 = $12.00) */
  priceCents: number;
  /** Product-specific: currency code (default 'usd') */
  currency: string;
  /** Product-specific: Stripe Price ID for checkout */
  stripePriceId: string;
  /** Product-specific: image URL or emoji placeholder */
  image: string;
  /** Product-specific: Stripe Payment Link URL for direct checkout */
  stripePaymentLink: string;
}

const VALID_TYPES: PageType[] = ['page', 'post', 'section', 'product'];

/**
 * Parse page metadata from markdown content with extended fields
 */
export function parsePageMetadata(content: string): PageMetadata {
  const { data } = parseFrontmatter(content);
  
  // Validate required fields
  if (!data['Short-URI']) {
    throw new Error('Short-URI is required');
  }
  
  const shortUri = String(data['Short-URI']).trim();
  
  // Validate type
  const type = (data['Type'] as string) || 'page';
  if (!VALID_TYPES.includes(type as PageType)) {
    throw new Error(`Invalid Type: "${type}". Must be one of: ${VALID_TYPES.join(', ')}`);
  }
  
  // Handle parent - default to 'root' if empty or null
  let parent = data['Parent'];
  if (parent === null || parent === undefined || parent === '') {
    parent = 'root';
  }
  
  // Parse labels - handle single value or array
  const labels = parseStringArray(data['Labels']);
  
  // Parse keywords
  const keywords = parseStringArray(data['Keywords']);
  
  // Parse order - default to 999 so unordered pages sort last
  const order = data['Order'] !== undefined && data['Order'] !== null
    ? Number(data['Order'])
    : 999;

  return {
    shortUri,
    title: (data['title'] as string) || (data['Title'] as string) || shortUri,
    type: type as PageType,
    category: (data['Category'] as string) || '',
    labels,
    parent: String(parent),
    order: Number.isNaN(order) ? 999 : order,
    author: (data['Author'] as string) || '',
    date: data['Date'] ? new Date(data['Date'] as string) : null,
    description: (data['Description'] as string) || '',
    keywords,
    template: (data['Template'] as string) || 'default',
    priceCents: Number(data['PriceCents'] || data['Price-Cents'] || 0),
    currency: (data['Currency'] as string) || 'usd',
    stripePriceId: (data['StripePriceId'] as string) || (data['Stripe-Price-Id'] as string) || '',
    image: (data['Image'] as string) || '',
    stripePaymentLink: (data['StripePaymentLink'] as string) || '',
  };
}

/**
 * Parse string or array into string array
 */
function parseStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  return [String(value)];
}

/**
 * Validate page metadata
 */
export function validatePageMetadata(
  metadata: PageMetadata, 
  existingUris?: Set<string>
): void {
  // Validate Short-URI
  if (!metadata.shortUri) {
    throw new Error('Short-URI cannot be empty');
  }
  
  // Check for valid characters (alphanumeric, hyphens, underscores)
  if (!/^[a-z0-9-_]+$/i.test(metadata.shortUri)) {
    throw new Error('Short-URI contains invalid characters. Use only letters, numbers, hyphens, and underscores.');
  }
  
  // Validate parent exists
  if (existingUris && metadata.parent !== 'root' && !existingUris.has(metadata.parent)) {
    throw new Error(`Parent "${metadata.parent}" does not exist`);
  }
}

/**
 * Generate a URL-friendly slug from text
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate unique Short-URI with enumeration for duplicates
 */
export function generateShortUri(title: string, existingUris?: Set<string>): string {
  const baseSlug = generateSlug(title);
  
  if (!existingUris || !existingUris.has(baseSlug)) {
    return baseSlug;
  }
  
  // Find next available number
  let counter = 2;
  let candidate = `${baseSlug}-${counter}`;
  
  while (existingUris.has(candidate)) {
    counter++;
    candidate = `${baseSlug}-${counter}`;
  }
  
  return candidate;
}
