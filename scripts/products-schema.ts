/**
 * Product catalogue schema — shared by generate-products + stripe-sync
 */

export interface ProductEntry {
  /** URL slug — must be unique, used as filename and cart ID */
  id: string;
  /** Display name */
  title: string;
  /** Short description (plain text or single paragraph) */
  description: string;
  /** Price in smallest currency unit (e.g. 1200 = $12.00) */
  price_cents: number;
  /** ISO 4217 currency code */
  currency: string;
  /** Emoji or image URL */
  image: string;
  /** Sort order on the shop page */
  order: number;
  /** Labels for filtering / cross-referencing */
  labels: string[];
  /** Stripe Price ID — written back by --stripe-sync */
  stripe_price_id: string;
  /** Stripe Payment Link URL — written back by --stripe-sync */
  stripe_payment_link: string;
  /**
   * Stripe tax code for automatic tax calculation.
   * txcd_99999999 — tangible goods
   * txcd_20030000 — general service
   * Leave empty to omit tax code from the Stripe product.
   */
  tax_code?: string;
}

export interface ProductCatalogue {
  products: ProductEntry[];
}

/** Default values applied when YAML fields are missing */
export const PRODUCT_DEFAULTS: Partial<ProductEntry> = {
  currency: 'usd',
  image: '📦',
  order: 100,
  labels: ['shop'],
  stripe_price_id: '',
  stripe_payment_link: '',
};

/**
 * Normalise a raw YAML entry into a fully typed ProductEntry
 */
export function normaliseProduct(raw: Record<string, unknown>): ProductEntry {
  if (!raw.id || typeof raw.id !== 'string') {
    throw new Error('Product entry missing required field: id');
  }
  if (!raw.title || typeof raw.title !== 'string') {
    throw new Error(`Product "${raw.id}" missing required field: title`);
  }
  if (!raw.description || typeof raw.description !== 'string') {
    throw new Error(`Product "${raw.id}" missing required field: description`);
  }
  if (raw.price_cents === undefined || typeof raw.price_cents !== 'number') {
    throw new Error(`Product "${raw.id}" missing required field: price_cents`);
  }
  return {
    id: raw.id as string,
    title: raw.title as string,
    description: raw.description as string,
    price_cents: raw.price_cents as number,
    currency: (raw.currency as string) ?? PRODUCT_DEFAULTS.currency!,
    image: (raw.image as string) ?? PRODUCT_DEFAULTS.image!,
    order: (raw.order as number) ?? PRODUCT_DEFAULTS.order!,
    labels: (raw.labels as string[]) ?? PRODUCT_DEFAULTS.labels!,
    stripe_price_id: (raw.stripe_price_id as string) ?? PRODUCT_DEFAULTS.stripe_price_id!,
    stripe_payment_link: (raw.stripe_payment_link as string) ?? PRODUCT_DEFAULTS.stripe_payment_link!,
    tax_code: raw.tax_code ? (raw.tax_code as string) : undefined,
  };
}
