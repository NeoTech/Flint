import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { TagRegistry } from './tag-registry.js';
import type { TemplateContext } from './template-registry.js';

/** Minimal context factory. */
function makeCtx(overrides: Partial<TemplateContext> = {}): TemplateContext {
  return {
    title: 'Test',
    content: '<p>hi</p>',
    description: '',
    keywords: '',
    basePath: '',
    navigation: [],
    siteLabels: [],
    frontmatter: {},
    cssFiles: [],
    jsFiles: [],
    author: '',
    date: null,
    category: '',
    labels: [],
    type: 'page',
    ...overrides,
  };
}

describe('TagRegistry', () => {
  let reg: TagRegistry;

  beforeEach(() => {
    reg = new TagRegistry();
  });

  // -------------------------------------------------------------------------
  // register + resolve — exact tag
  // -------------------------------------------------------------------------

  describe('register / resolve — exact', () => {
    it('resolves a registered exact tag', () => {
      reg.register([{
        tag: 'my-widget',
        label: 'My Widget',
        icon: '🧩',
        description: 'A widget',
        resolve: () => '<div>widget</div>',
      }]);
      expect(reg.resolve('my-widget', makeCtx())).toBe('<div>widget</div>');
    });

    it('passes ctx and tagName to the resolver', () => {
      reg.register([{
        tag: 'echo-title',
        label: 'Echo',
        icon: '📢',
        description: '',
        resolve: (ctx, tagName) => `${tagName}:${ctx.title}`,
      }]);
      expect(reg.resolve('echo-title', makeCtx({ title: 'Hello' }))).toBe('echo-title:Hello');
    });

    it('returns null for an unregistered tag', () => {
      expect(reg.resolve('not-there', makeCtx())).toBeNull();
    });

    it('overwrites an earlier registration with the same tag name', () => {
      reg.register([{ tag: 't', label: '', icon: '', description: '', resolve: () => 'v1' }]);
      reg.register([{ tag: 't', label: '', icon: '', description: '', resolve: () => 'v2' }]);
      expect(reg.resolve('t', makeCtx())).toBe('v2');
    });
  });

  // -------------------------------------------------------------------------
  // register + resolve — wildcard matchTag
  // -------------------------------------------------------------------------

  describe('register / resolve — wildcard', () => {
    it('resolves via matchTag when no exact match exists', () => {
      reg.register([{
        matchTag: (n) => n.startsWith('icon:'),
        label: 'Icon',
        icon: '🖼️',
        description: '',
        resolve: (_, tagName) => `<i data-icon="${tagName.slice(5)}"></i>`,
      }]);
      expect(reg.resolve('icon:star', makeCtx())).toBe('<i data-icon="star"></i>');
      expect(reg.resolve('icon:heart', makeCtx())).toBe('<i data-icon="heart"></i>');
    });

    it('exact match wins over wildcard for the same tag', () => {
      reg.register([
        { tag: 'icon:star', label: '', icon: '', description: '', resolve: () => '<exact/>' },
        { matchTag: (n) => n.startsWith('icon:'), label: '', icon: '', description: '', resolve: () => '<wildcard/>' },
      ]);
      expect(reg.resolve('icon:star', makeCtx())).toBe('<exact/>');
    });

    it('returns null when no exact or wildcard match', () => {
      reg.register([{
        matchTag: (n) => n.startsWith('icon:'),
        label: '',
        icon: '',
        description: '',
        resolve: () => 'icon',
      }]);
      expect(reg.resolve('widget', makeCtx())).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // clear
  // -------------------------------------------------------------------------

  describe('clear', () => {
    it('removes all registered tags', () => {
      reg.register([{ tag: 'foo', label: '', icon: '', description: '', resolve: () => 'x' }]);
      reg.clear();
      expect(reg.resolve('foo', makeCtx())).toBeNull();
    });

    it('removes wildcards too', () => {
      reg.register([{ matchTag: () => true, label: '', icon: '', description: '', resolve: () => 'x' }]);
      reg.clear();
      expect(reg.resolve('anything', makeCtx())).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // all
  // -------------------------------------------------------------------------

  describe('all', () => {
    it('returns all registered defs', () => {
      reg.register([
        { tag: 'a', label: 'A', icon: '', description: '', resolve: () => '' },
        { tag: 'b', label: 'B', icon: '', description: '', resolve: () => '' },
      ]);
      const tags = reg.all().map(d => d.tag);
      expect(tags).toContain('a');
      expect(tags).toContain('b');
    });

    it('returns empty array when nothing is registered', () => {
      expect(reg.all()).toHaveLength(0);
    });

    it('includes wildcard defs (no tag property)', () => {
      reg.register([{ matchTag: () => true, label: 'W', icon: '', description: '', resolve: () => '' }]);
      expect(reg.all()).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // discover
  // -------------------------------------------------------------------------

  describe('discover', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), 'tag-registry-test-'));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('discovers tagDefs from a component file', async () => {
      writeFileSync(join(tmpDir, 'widget.ts'), `
export const tagDefs = [{
  tag: 'my-discovered-widget',
  label: 'Discovered Widget',
  icon: '🔍',
  description: 'auto-discovered',
  resolve: () => '<div class="discovered">widget</div>',
}];
`);

      await reg.discover(tmpDir);
      const result = reg.resolve('my-discovered-widget', makeCtx());
      expect(result).toContain('discovered');
    });

    it('ignores files without a tagDefs export', async () => {
      writeFileSync(join(tmpDir, 'no-defs.ts'), `
export const someOtherExport = 42;
`);
      await reg.discover(tmpDir);
      expect(reg.all()).toHaveLength(0);
    });

    it('ignores .test.ts files', async () => {
      writeFileSync(join(tmpDir, 'widget.test.ts'), `
export const tagDefs = [{ tag: 'should-not-register', label: '', icon: '', description: '', resolve: () => '' }];
`);
      await reg.discover(tmpDir);
      expect(reg.resolve('should-not-register', makeCtx())).toBeNull();
    });

    it('discovers tagDefs from multiple files', async () => {
      writeFileSync(join(tmpDir, 'a.ts'), `
export const tagDefs = [{ tag: 'tag-a', label: 'A', icon: '🅰️', description: '', resolve: () => '<a/>' }];
`);
      writeFileSync(join(tmpDir, 'b.ts'), `
export const tagDefs = [{ tag: 'tag-b', label: 'B', icon: '🅱️', description: '', resolve: () => '<b/>' }];
`);
      await reg.discover(tmpDir);
      expect(reg.resolve('tag-a', makeCtx())).toBe('<a/>');
      expect(reg.resolve('tag-b', makeCtx())).toBe('<b/>');
    });

    it('discovers wildcard matchTag entries', async () => {
      writeFileSync(join(tmpDir, 'icon.ts'), `
export const tagDefs = [{
  matchTag: (n) => n.startsWith('icon:'),
  label: 'Icon',
  icon: '🖼️',
  description: '',
  resolve: (ctx, tagName) => '<i>' + tagName + '</i>',
}];
`);
      await reg.discover(tmpDir);
      expect(reg.resolve('icon:star', makeCtx())).toBe('<i>icon:star</i>');
    });

    it('clears previous registrations before discovering', async () => {
      // Register a tag manually first
      reg.register([{ tag: 'pre-existing', label: '', icon: '', description: '', resolve: () => 'old' }]);

      // Discover from an empty-ish dir (no tagDefs files)
      writeFileSync(join(tmpDir, 'empty.ts'), `export const x = 1;`);
      await reg.discover(tmpDir);

      // pre-existing should be gone
      expect(reg.resolve('pre-existing', makeCtx())).toBeNull();
    });
  });
});
