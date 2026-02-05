// Main entry point for the application
// This file is bundled by Rspack and includes HTMX

import 'htmx.org';
import './styles/main.css';

// Make htmx available globally
declare global {
  interface Window {
    htmx: typeof import('htmx.org');
  }
}

// Initialize HTMX
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Static site loaded with HTMX');
  
  // Configure HTMX defaults
  if (window.htmx) {
    window.htmx.config.defaultSwapStyle = 'innerHTML';
    window.htmx.config.defaultSwapDelay = 0;
  }
});

// Export for module usage
export {};
