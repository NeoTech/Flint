// Hydration for product add-to-cart buttons
import CartAPI from './cart-api.js';

function attachButtons(root: ParentNode = document): void {
  root.querySelectorAll('.flint-add-to-cart').forEach((el) => {
    const btn = el as HTMLButtonElement;
    if (btn.dataset.flintBound) return;
    btn.dataset.flintBound = '1';

    const id = btn.dataset.id;
    const qty = parseInt(btn.dataset.qty || '1', 10) || 1;

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        if ((window as any).CartAPI && typeof (window as any).CartAPI.addItem === 'function') {
          await (window as any).CartAPI.addItem(id, qty);
        } else if ((window as any).queueCartCall) {
          (window as any).queueCartCall('addItem', id, qty);
        } else {
          (window as any).__flintCartQueue = (window as any).__flintCartQueue || [];
          (window as any).__flintCartQueue.push(['addItem', [id, qty]]);
        }
        // Visual feedback
        const original = btn.textContent;
        btn.textContent = '✓ Added!';
        btn.classList.replace('bg-blue-600', 'bg-green-600');
        setTimeout(() => {
          btn.textContent = original;
          btn.classList.replace('bg-green-600', 'bg-blue-600');
        }, 1200);
      } catch (err) {
        console.error('addItem', err);
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  try { attachButtons(); } catch (e) { console.error('product-hydrate', e); }
});

// Re-attach after HTMX swaps in new content (product fragments)
// Note: with hx-swap="outerHTML" the original target is detached from DOM,
// so we must re-scan the full document rather than just the target element.
document.addEventListener('htmx:afterSwap', () => {
  try {
    attachButtons(document);
  } catch (e) { console.error('product-hydrate htmx', e); }
});

export default {};
