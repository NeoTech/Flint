import * as db from '../core/db.js';
import * as crypto from '../core/crypto.js';

type CartItem = { id: string; qty: number };

const CART_KEY = 'cart-v1';
const SEED_KEY = 'install-seed';

let _ready = false;
let _key: CryptoKey | null = null;
let _encrypted = false;
let _items: CartItem[] = [];

async function ensureInit() {
  if (_ready) return;
  // if running in non-browser environment, create empty
  if (typeof window === 'undefined') {
    _ready = true;
    return;
  }

  // Determine if encryption is available (requires secure context / HTTPS)
  _encrypted = crypto.isAvailable();

  if (_encrypted) {
    // load or create seed
    let seed = await db.get('secrets', SEED_KEY);
    if (!seed) {
      const arr = new Uint8Array(32);
      window.crypto.getRandomValues(arr);
      await db.set('secrets', SEED_KEY, Array.from(arr));
      seed = Array.from(arr);
    }
    const seedArr = new Uint8Array(seed);
    _key = await crypto.deriveKeyFromSeed(seedArr);
  }

  // load cart
  const stored = await db.get('kv', CART_KEY);
  if (_encrypted && _key && stored && stored.iv && stored.ct) {
    try {
      _items = await crypto.decryptJson(_key, stored.iv, stored.ct);
    } catch {
      _items = [];
    }
  } else if (!_encrypted && Array.isArray(stored)) {
    // plain-JSON fallback (non-secure context / dev server)
    _items = stored;
  } else {
    _items = [];
  }

  _ready = true;
  window.dispatchEvent(new CustomEvent('cart:ready', { detail: _items }));
  window.dispatchEvent(new CustomEvent('cart:updated', { detail: _items }));
}

async function persist() {
  if (_encrypted && _key) {
    const enc = await crypto.encryptJson(_key, _items);
    await db.set('kv', CART_KEY, enc);
  } else {
    // plain-JSON fallback — no encryption available
    await db.set('kv', CART_KEY, _items);
  }
}

export const CartAPI = {
  async addItem(id: string, qty = 1) {
    await ensureInit();
    const existing = _items.find(i => i.id === id);
    if (existing) existing.qty += qty; else _items.push({ id, qty });
    await persist();
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cart:updated', { detail: _items }));
    return _items;
  },

  async removeItem(id: string) {
    await ensureInit();
    _items = _items.filter(i => i.id !== id);
    await persist();
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cart:updated', { detail: _items }));
    return _items;
  },

  async updateQuantity(id: string, qty: number) {
    await ensureInit();
    const existing = _items.find(i => i.id === id);
    if (!existing) return _items;
    existing.qty = qty;
    if (existing.qty <= 0) _items = _items.filter(i => i.id !== id);
    await persist();
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cart:updated', { detail: _items }));
    return _items;
  },

  async getItems() {
    await ensureInit();
    return _items.slice();
  },

  async clear() {
    await ensureInit();
    _items = [];
    await db.del('kv', CART_KEY);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cart:updated', { detail: _items }));
  },

  on(event: 'cart:updated' | 'cart:ready', cb: (ev: any) => void) {
    if (typeof window === 'undefined') return () => {};
    const handler = (e: any) => cb(e);
    window.addEventListener(event, handler as EventListener);
    return () => window.removeEventListener(event, handler as EventListener);
  }
};

// Expose for simple client hydration
if (typeof window !== 'undefined') {
  // attach to window for scripts
  (window as any).CartAPI = CartAPI;
}

export default CartAPI;
