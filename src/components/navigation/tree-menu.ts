import { Component, type ComponentProps } from '../component.js';
import type { PageNode } from '../../core/hierarchy.js';

export interface TreeMenuProps extends ComponentProps {
  tree: PageNode | null;
  currentUri: string;
  useHtmx?: boolean;
}

/**
 * TreeMenu component - renders hierarchical navigation
 */
export class TreeMenu extends Component<TreeMenuProps> {
  render(): string {
    const { tree, currentUri, useHtmx = true } = this.props;

    if (!tree) {
      return '';
    }

    const menuHtml = this.renderNode(tree, currentUri, useHtmx, 0);

    return `<nav class="tree-menu bg-white rounded-lg shadow-sm border border-gray-200 p-4" aria-label="Site navigation">
  ${menuHtml}
</nav>`;
  }

  private renderNode(node: PageNode, currentUri: string, useHtmx: boolean, depth: number): string {
    const isActive = node.shortUri === currentUri;
    const isExpanded = this.isInPath(node, currentUri);
    const hasChildren = node.children && node.children.length > 0;

    const indentClass = depth > 0 ? `ml-${Math.min(depth * 4, 12)}` : '';
    const activeClass = isActive 
      ? 'bg-blue-50 text-blue-700 font-medium border-l-4 border-blue-500' 
      : 'text-gray-700 hover:bg-gray-50 hover:text-blue-600';
    
    const sectionClass = node.type === 'section' ? 'font-semibold text-gray-900' : '';

    const htmxAttrs = useHtmx 
      ? 'hx-boost="true" hx-target="#app" hx-swap="innerHTML"' 
      : '';

    let html = `
    <div class="tree-node ${indentClass}" data-uri="${node.shortUri}" data-expanded="${isExpanded}">
      <a href="/${node.shortUri === 'root' ? '' : node.shortUri}" 
         class="block px-3 py-2 rounded-md text-sm transition-colors ${activeClass} ${sectionClass}"
         ${isActive ? 'aria-current="page"' : ''}
         ${htmxAttrs}>
        ${node.title || node.shortUri}
      </a>`;

    if (hasChildren) {
      const displayStyle = isExpanded ? 'block' : 'none';
      html += `
      <div class="children ml-2 mt-1 space-y-1" style="display: ${displayStyle}">
        ${node.children!.map(child => this.renderNode(child, currentUri, useHtmx, depth + 1)).join('')}
      </div>`;
    }

    html += '</div>';
    return html;
  }

  private isInPath(node: PageNode, targetUri: string): boolean {
    if (node.shortUri === targetUri) {
      return true;
    }

    if (node.children) {
      for (const child of node.children) {
        if (this.isInPath(child, targetUri)) {
          return true;
        }
      }
    }

    return false;
  }
}
