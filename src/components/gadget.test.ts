import { describe, it, expect } from 'vitest';
import { Gadget } from './gadget.js';

describe('Gadget', () => {
  it('should render a container div with id "gadget-box"', () => {
    const html = Gadget.render({});

    expect(html).toContain('id="gadget-box"');
    expect(html).toContain('<div');
  });

  it('should render a randomize button', () => {
    const html = Gadget.render({});

    expect(html).toContain('<button');
    expect(html).toContain('Randomize');
  });

  it('should include inline JavaScript for randomization', () => {
    const html = Gadget.render({});

    expect(html).toContain('<script>');
    expect(html).toContain('</script>');
    expect(html).toContain('randomizeGadget');
  });

  it('should contain a colors array in the script', () => {
    const html = Gadget.render({});

    expect(html).toContain('colors');
    expect(html).toContain('phrases');
  });

  it('should accept a custom className', () => {
    const html = Gadget.render({ className: 'my-extra' });

    expect(html).toContain('my-extra');
  });

  it('should render a text element inside the box', () => {
    const html = Gadget.render({});

    expect(html).toContain('id="gadget-text"');
  });

  it('should use onclick to trigger randomization', () => {
    const html = Gadget.render({});

    expect(html).toContain('onclick="randomizeGadget()"');
  });

  it('should render with a default initial background color', () => {
    const html = Gadget.render({});

    expect(html).toContain('background-color');
  });
});
