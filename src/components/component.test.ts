import { describe, it, expect } from 'bun:test';
import { Component, type ComponentProps } from './component.js';

// Test component implementation
interface TestProps extends ComponentProps {
  title: string;
  items?: string[];
}

class TestComponent extends Component<TestProps> {
  render(): string {
    const items = this.props.items?.map((item: string) => `<li>${item}</li>`).join('') ?? '';
    return `
      <div class="test-component" id="${this.props.id}">
        <h2>${this.props.title}</h2>
        ${items ? `<ul>${items}</ul>` : ''}
      </div>
    `;
  }
  
  // Expose protected methods for testing
  escapeHtml(text: string): string {
    return super.escapeHtml(text);
  }
  
  classNames(...classes: (string | boolean | undefined | null)[]): string {
    return super.classNames(...classes);
  }
}

describe('Component', () => {
  describe('base functionality', () => {
    it('should render with required props', () => {
      const component = new TestComponent({ id: 'test-1', title: 'Hello' });
      const html = component.render();

      expect(html).toContain('id="test-1"');
      expect(html).toContain('<h2>Hello</h2>');
    });

    it('should render with optional props', () => {
      const component = new TestComponent({
        id: 'test-2',
        title: 'List',
        items: ['a', 'b', 'c'],
      });
      const html = component.render();

      expect(html).toContain('<li>a</li>');
      expect(html).toContain('<li>b</li>');
      expect(html).toContain('<li>c</li>');
    });

    it('should provide access to props', () => {
      const props = { id: 'test', title: 'Test' };
      const component = new TestComponent(props);

      expect(component.props.id).toBe('test');
      expect(component.props.title).toBe('Test');
    });
  });

  describe('utility methods', () => {
    it('should escape HTML entities', () => {
      const component = new TestComponent({ id: 'test', title: 'Test' });
      const unsafe = '<script>alert("xss")</script>';
      const escaped = component.escapeHtml(unsafe);

      // In browser environment, quotes may not be escaped
      expect(escaped).toContain('&lt;script&gt;');
      expect(escaped).toContain('&lt;/script&gt;');
      expect(escaped).not.toContain('<script>');
    });

    it('should join class names', () => {
      const component = new TestComponent({ id: 'test', title: 'Test' });
      const classes = component.classNames('base', 'active', undefined, 'large');

      expect(classes).toBe('base active large');
    });

    it('should handle conditional class names', () => {
      const component = new TestComponent({ id: 'test', title: 'Test' });
      const classes = component.classNames(
        'base',
        false && 'hidden',
        true && 'visible'
      );

      expect(classes).toBe('base visible');
    });
  });

  describe('static render method', () => {
    it('should render component class directly', () => {
      const html = TestComponent.render({
        id: 'static-test',
        title: 'Static Render',
      });

      expect(html).toContain('id="static-test"');
      expect(html).toContain('Static Render');
    });
  });
});
