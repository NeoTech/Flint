import { describe, it, expect } from 'bun:test';
import { TreeMenu } from './tree-menu.js';
import type { PageNode } from '../../core/hierarchy.js';

describe('TreeMenu', () => {
  const createMockTree = (): PageNode => ({
    shortUri: 'root',
    title: 'Home',
    type: 'page',
    children: [
      {
        shortUri: 'docs',
        title: 'Documentation',
        type: 'section',
        children: [
          { shortUri: 'getting-started', title: 'Getting Started', type: 'page' },
          { shortUri: 'advanced', title: 'Advanced', type: 'page' },
        ],
      },
      {
        shortUri: 'blog',
        title: 'Blog',
        type: 'section',
        children: [
          { shortUri: 'first-post', title: 'First Post', type: 'post' },
        ],
      },
    ],
  });

  it('should render tree structure', () => {
    const tree = createMockTree();
    const html = TreeMenu.render({ tree, currentUri: 'root' });

    expect(html).toContain('Home');
    expect(html).toContain('Documentation');
    expect(html).toContain('Getting Started');
    expect(html).toContain('Blog');
  });

  it('should mark current page as active', () => {
    const tree = createMockTree();
    const html = TreeMenu.render({ tree, currentUri: 'getting-started' });

    expect(html).toContain('aria-current="page"');
    expect(html).toContain('text-blue-600');
  });

  it('should expand parent of current page', () => {
    const tree = createMockTree();
    const html = TreeMenu.render({ tree, currentUri: 'advanced' });

    expect(html).toContain('data-expanded="true"');
  });

  it('should collapse other branches', () => {
    const tree = createMockTree();
    const html = TreeMenu.render({ tree, currentUri: 'getting-started' });

    expect(html).toContain('data-expanded="false"');
  });

  it('should use HTMX for navigation', () => {
    const tree = createMockTree();
    const html = TreeMenu.render({ tree, currentUri: 'root', useHtmx: true });

    expect(html).toContain('hx-boost="true"');
    expect(html).toContain('hx-target="#app"');
  });

  it('should render without HTMX when disabled', () => {
    const tree = createMockTree();
    const html = TreeMenu.render({ tree, currentUri: 'root', useHtmx: false });

    expect(html).not.toContain('hx-boost');
  });

  it('should handle empty tree', () => {
    const html = TreeMenu.render({ tree: null as unknown as PageNode, currentUri: 'root' });
    expect(html).toBe('');
  });

  it('should render section headers differently', () => {
    const tree = createMockTree();
    const html = TreeMenu.render({ tree, currentUri: 'root' });

    expect(html).toContain('font-semibold');
  });
});
