import type { PageMetadata } from './page-metadata.js';

export interface PageNode extends PageMetadata {
  children?: PageNode[];
}

export interface BreadcrumbItem {
  shortUri: string;
  title: string;
}

/**
 * Build hierarchical tree from flat pages
 */
export function buildPageHierarchy(pages: PageNode[]): PageNode | null {
  if (pages.length === 0) return null;
  
  // Create lookup map
  const pageMap = new Map<string, PageNode>();
  const childrenMap = new Map<string, PageNode[]>();
  
  // Initialize maps
  for (const page of pages) {
    pageMap.set(page.shortUri, { ...page, children: [] });
    childrenMap.set(page.shortUri, []);
  }
  
  // Validate all parents exist (handle null as root)
  const missingParents: string[] = [];
  for (const page of pages) {
    const parentRef = page.parent === null || page.parent === undefined ? 'root' : page.parent;
    if (parentRef !== 'root' && !pageMap.has(parentRef)) {
      missingParents.push(`${page.shortUri} -> ${parentRef}`);
    }
  }
  
  if (missingParents.length > 0) {
    throw new Error(`Orphaned pages detected: ${missingParents.join(', ')}`);
  }
  
  // Build parent-child relationships
  let rootCount = 0;
  let rootNode: PageNode | null = null;
  
  for (const page of pages) {
    const node = pageMap.get(page.shortUri);
    if (!node) continue;
    // Only treat as root if parent is null, undefined, or empty string
    // A page with parent: 'root' is a child of the root page, not a root itself
    const isRoot = page.parent === null || page.parent === undefined || page.parent === '';
    
    if (isRoot) {
      rootCount++;
      rootNode = node;
    } else {
      const siblings = childrenMap.get(page.parent) || [];
      siblings.push(node);
      childrenMap.set(page.parent, siblings);
    }
  }
  
  // Check for multiple roots
  if (rootCount > 1) {
    throw new Error('Multiple root pages detected. Only one page should have Parent: root or no Parent.');
  }
  
  if (!rootNode) {
    throw new Error('No root page found. One page must have Parent: root or no Parent.');
  }
  
  // Attach children to their parents
  for (const [parentUri, children] of childrenMap) {
    const parent = pageMap.get(parentUri);
    if (parent) {
      parent.children = children;
    }
  }
  
  // Detect circular references
  detectCircularReferences(rootNode, new Set());
  
  return rootNode;
}

/**
 * Detect circular references in tree
 */
function detectCircularReferences(node: PageNode, visited: Set<string>): void {
  if (visited.has(node.shortUri)) {
    throw new Error(`Circular reference detected involving: ${node.shortUri}`);
  }
  
  visited.add(node.shortUri);
  
  if (node.children) {
    for (const child of node.children) {
      detectCircularReferences(child, new Set(visited));
    }
  }
}

/**
 * Generate breadcrumbs from root to current page
 */
export function generateBreadcrumbs(tree: PageNode | null, targetUri: string): BreadcrumbItem[] {
  if (!tree) return [];
  
  const path = findPathToNode(tree, targetUri);
  
  if (!path) {
    throw new Error(`Page not found: ${targetUri}`);
  }
  
  return path.map(node => ({
    shortUri: node.shortUri,
    title: node.title || node.shortUri,
  }));
}

/**
 * Find path from root to target node
 */
function findPathToNode(node: PageNode, targetUri: string, path: PageNode[] = []): PageNode[] | null {
  const currentPath = [...path, node];
  
  if (node.shortUri === targetUri) {
    return currentPath;
  }
  
  if (node.children) {
    for (const child of node.children) {
      const result = findPathToNode(child, targetUri, currentPath);
      if (result) return result;
    }
  }
  
  return null;
}

/**
 * Find page by Short-URI in tree
 */
export function findPageByShortUri(tree: PageNode | null, shortUri: string): PageNode | null {
  if (!tree) return null;
  if (tree.shortUri === shortUri) return tree;
  
  if (tree.children) {
    for (const child of tree.children) {
      const found = findPageByShortUri(child, shortUri);
      if (found) return found;
    }
  }
  
  return null;
}

/**
 * Get direct children of a page
 */
export function getChildren(tree: PageNode | null, parentUri: string): PageNode[] {
  if (!tree) return [];
  
  const parent = findPageByShortUri(tree, parentUri);
  return parent?.children || [];
}

/**
 * Flatten tree to array
 */
export function flattenTree(tree: PageNode | null): PageNode[] {
  if (!tree) return [];
  
  const result: PageNode[] = [tree];
  
  if (tree.children) {
    for (const child of tree.children) {
      result.push(...flattenTree(child));
    }
  }
  
  return result;
}
