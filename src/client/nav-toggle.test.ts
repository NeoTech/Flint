import { describe, it, expect, beforeEach } from 'bun:test';
import { initNavToggle } from './nav-toggle.js';

describe('initNavToggle', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <nav>
        <button id="flint-nav-toggle" aria-expanded="false" aria-controls="flint-nav-menu">☰</button>
        <div id="flint-nav-menu" class="hidden">
          <a href="/">Home</a>
        </div>
      </nav>
    `;
  });

  it('should open the menu on first click', () => {
    initNavToggle();
    const toggle = document.getElementById('flint-nav-toggle')!;
    const menu = document.getElementById('flint-nav-menu')!;

    toggle.click();

    expect(menu.classList.contains('hidden')).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('should close the menu on second click', () => {
    initNavToggle();
    const toggle = document.getElementById('flint-nav-toggle')!;
    const menu = document.getElementById('flint-nav-menu')!;

    toggle.click(); // open
    toggle.click(); // close

    expect(menu.classList.contains('hidden')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('should do nothing when elements are missing', () => {
    document.body.innerHTML = '<div>No nav here</div>';
    // Should not throw
    expect(() => initNavToggle()).not.toThrow();
  });
});
