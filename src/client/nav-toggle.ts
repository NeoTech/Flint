/**
 * Client-side toggle for the responsive navigation hamburger menu.
 *
 * Listens for clicks on `#flint-nav-toggle` and toggles visibility
 * of `#flint-nav-menu`. Updates `aria-expanded` for accessibility.
 *
 * Automatically closes the mobile menu when the viewport crosses
 * the `md` breakpoint (768px).
 */
export function initNavToggle(): void {
  const toggle = document.getElementById('flint-nav-toggle');
  const menu = document.getElementById('flint-nav-menu');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    const isOpen = !menu.classList.contains('hidden');
    menu.classList.toggle('hidden', isOpen);
    toggle.setAttribute('aria-expanded', String(!isOpen));
  });

  // Close mobile menu when resizing past the md breakpoint
  const mq = window.matchMedia('(min-width: 768px)');
  const onBreakpoint = (e: MediaQueryList | MediaQueryListEvent): void => {
    if ('matches' in e && e.matches) {
      menu.classList.add('hidden');
      toggle.setAttribute('aria-expanded', 'false');
    }
  };
  mq.addEventListener('change', onBreakpoint);
}
