import { expect } from 'vitest';

// Custom matchers for HTML testing
expect.extend({
  toContainTag(received: string, tag: string) {
    const pass = received.includes(`<${tag}`) || received.includes(`</${tag}>`);
    return {
      pass,
      message: () => `expected ${received} to contain <${tag}> tag`,
    };
  },
  toHaveAttribute(received: string, attr: string, value?: string) {
    const attrPattern = value 
      ? new RegExp(`${attr}=["']${value}["']`)
      : new RegExp(`${attr}=`);
    const pass = attrPattern.test(received);
    return {
      pass,
      message: () => `expected element to have attribute ${attr}${value ? `="${value}"` : ''}`,
    };
  },
});

// Extend vitest types
declare module 'vitest' {
  interface Assertion<T = any> {
    toContainTag(tag: string): T;
    toHaveAttribute(attr: string, value?: string): T;
  }
}
