/**
 * Tests for ui/products.ts — visual + YAML editor for products.yaml.
 *
 * Validates:
 *   - fetch-on-load pattern (no broken SSR JSON embedding)
 *   - Visual tab / YAML tab structure
 *   - Force Sync button present
 *   - Unified Save dispatches based on active tab
 *   - HTMX mode strips the shell wrapper
 */
import { describe, it, expect, mock } from 'bun:test';

// ---- mock registry (full surface) -------------------------------------------

mock.module('../registry.js', () => ({
  getSite: (id: string) => id === 'test' ? { id: 'test', name: 'Test Site', path: '/tmp/test-site' } : null,
  resolveSitePath: (site: { path: string }) => site.path,
  loadRegistry: () => [],
  saveRegistry: () => {},
  upsertSite: () => {},
  removeSite: () => {},
}));

const { renderProducts } = await import('./products.js');

// ── helper ────────────────────────────────────────────────────────────────────

function render(id = 'test', htmx = false): string {
  return renderProducts(id, htmx);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('renderProducts — unknown site', () => {
  it('returns site-not-found message', () => {
    const html = render('no-such-site');
    expect(html).toContain('Site not found');
    expect(html).toContain('no-such-site');
  });
});

describe('renderProducts — fetch-on-load (not SSR JSON embed)', () => {
  it('does NOT embed products via JSON.parse in a script tag', () => {
    const html = render();
    // Old broken pattern: JSON.parse('...&quot;...')
    expect(html).not.toContain("JSON.parse('");
  });

  it('fetches parsed products from /products/parsed on load', () => {
    const html = render();
    // URL is built via concatenation: '/sites/' + SITE_ID + '/products/parsed'
    expect(html).toContain("'/products/parsed'");
    expect(html).toContain('SITE_ID');
  });

  it('shows loading spinner initially', () => {
    const html = render();
    expect(html).toContain('id="products-loading"');
  });
});

describe('renderProducts — Visual tab', () => {
  it('contains panel-visual div', () => {
    const html = render();
    expect(html).toContain('id="panel-visual"');
  });

  it('contains tab button with id tab-visual', () => {
    const html = render();
    expect(html).toContain('id="tab-visual"');
  });

  it('contains addProduct function', () => {
    const html = render();
    expect(html).toContain('function addProduct()');
  });

  it('renders the card grid container', () => {
    const html = render();
    expect(html).toContain('id="products-grid"');
  });

  it('has unified handleSave that dispatches by tab', () => {
    const html = render();
    expect(html).toContain('function handleSave(');
    expect(html).toContain("activeTab === 'yaml'");
  });

  it('saves visual data to /products/parsed (PUT)', () => {
    const html = render();
    expect(html).toContain('/products/parsed');
    expect(html).toContain("method: 'PUT'");
  });
});

describe('renderProducts — YAML tab', () => {
  it('contains panel-yaml div', () => {
    const html = render();
    expect(html).toContain('id="panel-yaml"');
  });

  it('contains tab button with id tab-yaml', () => {
    const html = render();
    expect(html).toContain('id="tab-yaml"');
  });

  it('renders the yaml-editor textarea', () => {
    const html = render();
    expect(html).toContain('id="yaml-editor"');
  });

  it('fetches raw YAML from /products/raw', () => {
    const html = render();
    expect(html).toContain('/products/raw');
  });

  it('saves raw YAML to /products (PUT) — not /parsed', () => {
    const html = render();
    expect(html).toContain('function saveYaml(');
    // saveYaml posts to /products (not /products/parsed)
    expect(html).toContain("siteId + '/products'");
  });

  it('contains switchTab function', () => {
    const html = render();
    expect(html).toContain('function switchTab(');
  });
});

describe('renderProducts — toolbar actions', () => {
  it('has Run Generate button', () => {
    const html = render();
    expect(html).toContain('Run Generate');
    expect(html).toContain("runGenerate('test')");
  });

  it('has Sync Stripe button', () => {
    const html = render();
    expect(html).toContain('Sync Stripe');
  });

  it('has Force Sync button', () => {
    const html = render();
    expect(html).toContain('Force Sync');
    // Force sync passes true as second arg
    expect(html).toContain("runSync('test', true)");
  });

  it('Force Sync route is derived by appending /force conditionally', () => {
    const html = render();
    // runSync builds the URL: '/products/sync' + (force ? '/force' : '')
    expect(html).toContain("'/force'");
    expect(html).toContain('/products/sync');
  });

  it('has Save button calling handleSave', () => {
    const html = render();
    expect(html).toContain("handleSave('test')");
  });
});

describe('renderProducts — HTMX mode', () => {
  it('omits <!DOCTYPE html> in HTMX mode', () => {
    const html = render('test', true);
    expect(html).not.toContain('<!DOCTYPE');
  });

  it('omits <html> wrapper in HTMX mode', () => {
    const html = render('test', true);
    expect(html).not.toContain('<html');
  });

  it('still contains the product panel structure in HTMX mode', () => {
    const html = render('test', true);
    expect(html).toContain('id="products-loading"');
    expect(html).toContain('id="panel-visual"');
    expect(html).toContain('id="panel-yaml"');
  });

  it('full-page mode includes a proper HTML wrapper', () => {
    const html = render('test', false);
    // Real shell produces a full HTML document
    expect(html).toContain('<!DOCTYPE');
    expect(html).toContain('<html');
  });
});

describe('renderProducts — build log', () => {
  it('renders build log container', () => {
    const html = render();
    expect(html).toContain('id="build-log"');
  });

  it('has streamBuildLog function', () => {
    const html = render();
    expect(html).toContain('function streamBuildLog(');
  });
});
