import CartAPI from './cart-api.js';

/* ------------------------------------------------------------------ */
/*  Build-time constants (injected by Rspack DefinePlugin)            */
/* ------------------------------------------------------------------ */
declare const __STRIPE_KEY_MASK__: string;
declare const __STRIPE_KEY_DATA__: string;
declare const __CHECKOUT_MODE__: string;
declare const __CHECKOUT_ENDPOINT__: string;

function deobfuscateKey(): string {
  try {
    const mask = __STRIPE_KEY_MASK__;
    const data = __STRIPE_KEY_DATA__;
    if (!mask || !data) return '';
    const m = new Uint8Array(mask.match(/.{2}/g)!.map(h => parseInt(h, 16)));
    const d = new Uint8Array(data.match(/.{2}/g)!.map(h => parseInt(h, 16)));
    const out = new Uint8Array(m.length);
    for (let i = 0; i < m.length; i++) out[i] = m[i] ^ d[i];
    return new TextDecoder().decode(out);
  } catch {
    return '';
  }
}

/* ------------------------------------------------------------------ */
/*  Product-index cache (prices, titles, images)                      */
/* ------------------------------------------------------------------ */
type ProductMeta = {
  id: string;
  title: string;
  price_cents: number;
  currency: string;
  stripe_price_id?: string;
  stripe_payment_link?: string;
  image?: string;
};

let _productIndex: Record<string, ProductMeta> | null = null;

function getBasePath(): string {
  return document.querySelector('meta[name="base-path"]')?.getAttribute('content') || '';
}

async function loadProductIndex(): Promise<Record<string, ProductMeta>> {
  if (_productIndex) return _productIndex;
  try {
    const res = await fetch(`${getBasePath()}/static/products/index.json`);
    _productIndex = res.ok ? await res.json() : {};
  } catch {
    _productIndex = {};
  }
  return _productIndex!;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/* ------------------------------------------------------------------ */
/*  Drain the pre-init queue                                          */
/* ------------------------------------------------------------------ */
function drainQueue(): void {
  try {
    const q = (window as any).__flintCartQueue || [];
    if (q && q.length && CartAPI) {
      q.forEach((item: any) => {
        const name = item[0];
        const args = item[1] || [];
        if (typeof (CartAPI as any)[name] === 'function') {
          try { (CartAPI as any)[name](...args); } catch (e) { console.error('drain call', e); }
        }
      });
      (window as any).__flintCartQueue = [];
    }
  } catch (e) { console.error('drainQueue', e); }
}

/* ------------------------------------------------------------------ */
/*  Render cart items into the DOM                                    */
/* ------------------------------------------------------------------ */
async function renderItems(items: Array<{ id: string; qty: number }>): Promise<void> {
  const list = document.getElementById('flint-cart-items');
  const countEl = document.getElementById('flint-cart-count');
  const totalEl = document.getElementById('flint-cart-total');
  if (!list) return;

  const index = await loadProductIndex();

  if (!items || !items.length) {
    list.innerHTML = '<div class="text-sm text-gray-400 py-2">Cart is empty</div>';
    if (countEl) countEl.textContent = '0';
    if (totalEl) totalEl.textContent = 'Total: $0.00';
    return;
  }

  let totalCents = 0;
  let totalQty = 0;

  list.innerHTML = items.map((item) => {
    const meta = index[item.id];
    const title = meta?.title ?? item.id;
    const unitCents = meta?.price_cents ?? 0;
    const lineCents = unitCents * item.qty;
    totalCents += lineCents;
    totalQty += item.qty;

    return `<div class="flex items-center justify-between gap-2 py-1.5 border-b border-gray-50 last:border-0" data-cart-line="${item.id}">
  <div class="flex-1 min-w-0">
    <div class="text-sm font-medium text-gray-800 truncate">${title}</div>
    <div class="text-xs text-gray-400">${unitCents ? formatCents(unitCents) + ' each' : ''}</div>
  </div>
  <div class="flex items-center gap-1">
    <button class="flint-cart-qty w-6 h-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-sm font-bold leading-none" data-id="${item.id}" data-delta="-1" aria-label="Decrease quantity">\u2212</button>
    <span class="text-sm w-6 text-center tabular-nums">${item.qty}</span>
    <button class="flint-cart-qty w-6 h-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-sm font-bold leading-none" data-id="${item.id}" data-delta="1" aria-label="Increase quantity">+</button>
  </div>
  <div class="text-sm font-semibold text-gray-700 w-16 text-right tabular-nums">${lineCents ? formatCents(lineCents) : ''}</div>
  <button class="flint-cart-remove ml-1 text-gray-300 hover:text-red-500 transition-colors" data-id="${item.id}" aria-label="Remove ${title} from cart">
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
  </button>
</div>`;
  }).join('');

  if (countEl) countEl.textContent = String(totalQty);
  if (totalEl) totalEl.textContent = `Total: ${formatCents(totalCents)}`;

  // Wire qty +/- buttons
  list.querySelectorAll('.flint-cart-qty').forEach((el) => {
    const btn = el as HTMLButtonElement;
    if (btn.dataset.flintBound) return;
    btn.dataset.flintBound = '1';
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = btn.dataset.id!;
      const delta = parseInt(btn.dataset.delta || '0', 10);
      const current = items.find(i => i.id === id);
      if (!current) return;
      const newQty = current.qty + delta;
      if (newQty <= 0) {
        await CartAPI.removeItem(id);
      } else {
        await CartAPI.updateQuantity(id, newQty);
      }
    });
  });

  // Wire remove buttons
  list.querySelectorAll('.flint-cart-remove').forEach((el) => {
    const btn = el as HTMLButtonElement;
    if (btn.dataset.flintBound) return;
    btn.dataset.flintBound = '1';
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = btn.dataset.id!;
      await CartAPI.removeItem(id);
    });
  });
}

/* ------------------------------------------------------------------ */
/*  Wire panel toggle + checkout                                      */
/* ------------------------------------------------------------------ */
function wireUI(): void {
  const toggle = document.getElementById('flint-cart-toggle');
  const panel = document.getElementById('flint-cart-panel');
  const checkoutMode: string = (typeof __CHECKOUT_MODE__ !== 'undefined' ? __CHECKOUT_MODE__ : 'payment-links');

  if (toggle && panel) {
    toggle.addEventListener('click', () => {
      const wasHidden = panel.classList.contains('hidden');
      panel.classList.toggle('hidden');
      toggle.setAttribute('aria-expanded', String(wasHidden));
    });

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      const cart = document.getElementById('flint-cart');
      if (cart && !cart.contains(e.target as Node) && !panel.classList.contains('hidden')) {
        panel.classList.add('hidden');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // In payment-links mode: intercept "Add to Cart" buttons that have a payment link
  if (checkoutMode === 'payment-links') {
    document.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.flint-add-to-cart') as HTMLElement | null;
      if (!btn) return;
      const paymentLink = btn.dataset.paymentLink;
      if (paymentLink && paymentLink.startsWith('https://')) {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = paymentLink;
      }
      // If no payment link, allow normal cart behaviour (falls through to cart-api)
    }, true); // capture phase so it fires before cart-api handlers
  }

  const checkoutBtn = document.getElementById('flint-cart-checkout');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', async () => {
      try {
        const index = await loadProductIndex();
        const items = await CartAPI.getItems();
        if (!items || !items.length) { alert('Cart is empty'); return; }

        if (checkoutMode === 'payment-links') {
          // Payment-links mode: one product at a time
          if (items.length > 1) {
            alert('Payment Links support one product at a time.\nPlease use "Buy Now" on each product page to checkout individually.');
            return;
          }
          const item = items[0];
          const meta = index[item.id];
          const link = (meta as ProductMeta)?.stripe_payment_link;
          if (link && link.startsWith('https://')) {
            window.location.href = link;
          } else {
            alert('No payment link available for this product yet. Run bun run build:sync first.');
          }
          return;
        }

        // Serverless mode: POST cart to Bun checkout server
        const lineItems: Array<{ priceId: string; qty: number }> = [];
        const missing: string[] = [];
        items.forEach((it) => {
          const meta = index[it.id] as ProductMeta;
          if (!meta?.stripe_price_id) missing.push(it.id);
          else lineItems.push({ priceId: meta.stripe_price_id, qty: it.qty });
        });
        if (missing.length) { alert('Some items not available for checkout: ' + missing.join(', ')); return; }

        const endpoint: string = (typeof __CHECKOUT_ENDPOINT__ !== 'undefined' ? __CHECKOUT_ENDPOINT__ : 'http://localhost:3001');
        const cfg = (window as any).__FLINT_CONFIG__ || {};
        const siteUrl = cfg.siteUrl || window.location.origin;

        checkoutBtn.setAttribute('disabled', 'true');
        checkoutBtn.textContent = 'Redirecting…';

        const res = await fetch(`${endpoint}/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: lineItems,
            successUrl: `${siteUrl}/checkout/success`,
            cancelUrl: `${siteUrl}/checkout/cancel`,
          }),
        });

        const data = await res.json() as { url?: string; error?: string };
        if (!res.ok || !data.url) {
          throw new Error(data.error || 'Checkout server error');
        }
        window.location.href = data.url;
      } catch (e) {
        console.error('checkout', e);
        alert('Checkout failed: ' + (e instanceof Error ? e.message : String(e)));
        const btn = document.getElementById('flint-cart-checkout');
        if (btn) { btn.removeAttribute('disabled'); btn.textContent = 'Checkout'; }
      }
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Bootstrap                                                         */
/* ------------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
  try {
    drainQueue();

    if (!(window as any).CartAPI) (window as any).CartAPI = CartAPI;

    // In payment-links mode, hide the cart widget entirely — users go direct to Stripe
    const checkoutMode: string = (typeof __CHECKOUT_MODE__ !== 'undefined' ? __CHECKOUT_MODE__ : 'payment-links');
    if (checkoutMode === 'payment-links') {
      const cartEl = document.getElementById('flint-cart');
      if (cartEl) cartEl.hidden = true;
    }

    // Initial render
    CartAPI.getItems().then(items => renderItems(items)).catch(() => {});

    // Re-render on every cart change
    window.addEventListener('cart:updated', (e: any) => {
      const items = e?.detail || [];
      renderItems(items);
    });

    wireUI();
  } catch (e) {
    console.error('cart-hydrate init', e);
  }
});

export default {};
