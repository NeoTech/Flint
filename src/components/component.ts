/**
 * Base props interface for all components
 */
export interface ComponentProps {
  id?: string;
  className?: string;
}

/**
 * Abstract base class for all components
 * Provides common utility methods and enforces render interface
 */
export abstract class Component<T extends ComponentProps = ComponentProps> {
  readonly props: T;

  constructor(props: T) {
    this.props = props;
  }

  /**
   * Render the component to HTML string
   * Must be implemented by subclasses
   */
  abstract render(): string;

  /**
   * Escape HTML entities to prevent XSS
   */
  protected escapeHtml(text: string): string {
    const div = typeof document !== 'undefined' ? document.createElement('div') : null;
    if (div) {
      div.textContent = text;
      return div.innerHTML;
    }
    // Server-side fallback
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Join class names, filtering out falsy values
   */
  protected classNames(...classes: (string | boolean | undefined | null)[]): string {
    return classes.filter(Boolean).join(' ');
  }

  /**
   * Static render method for convenience
   * Creates instance and renders immediately
   */
  static render<P extends ComponentProps>(
    this: new (props: P) => Component<P>,
    props: P
  ): string {
    return new this(props).render();
  }
}
