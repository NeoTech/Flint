import { Component, type ComponentProps } from './component.js';
import type { TagDef } from '../templates/tag-registry.js';

export interface GadgetProps extends ComponentProps {
  /** Override the initial display text */
  initialText?: string;
}

/**
 * Gadget component — a demonstration widget that randomizes its
 * background color and text when a button is clicked.
 *
 * Uses plain client-side JavaScript (no HTMX fragments needed).
 * Shows how a component can embed interactive behavior while
 * still being rendered server-side as a static HTML string.
 */
export class Gadget extends Component<GadgetProps> {
  render(): string {
    const { className, initialText = 'Click the button!' } = this.props;
    const extraClass = className ? ` ${className}` : '';

    return `<div class="gadget-wrapper${extraClass}">
  <div id="gadget-box" class="rounded-xl shadow-lg p-8 text-center transition-all duration-300 ease-in-out" style="background-color: #6366f1;">
    <p id="gadget-text" class="text-2xl font-bold text-white drop-shadow mb-6">${this.escapeHtml(initialText)}</p>
    <button
      onclick="randomizeGadget()"
      class="px-6 py-2 bg-white text-gray-800 font-semibold rounded-lg shadow hover:shadow-md hover:scale-105 transition-all duration-200 cursor-pointer"
    >🎲 Randomize</button>
  </div>
  <script>
    function randomizeGadget() {
      var colors = [
        '#ef4444', '#f97316', '#eab308', '#22c55e',
        '#06b6d4', '#3b82f6', '#6366f1', '#a855f7',
        '#ec4899', '#14b8a6', '#f43f5e', '#8b5cf6'
      ];
      var phrases = [
        'Components are cool!',
        'HTMX + Components = ❤️',
        'No framework needed!',
        'Pure HTML power!',
        'Static sites rock!',
        'TypeScript FTW!',
        'Tag-based templates!',
        'Markdown is content!',
        'Keep it simple!',
        'Server-rendered magic!'
      ];
      var box = document.getElementById('gadget-box');
      var text = document.getElementById('gadget-text');
      if (box && text) {
        box.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        text.textContent = phrases[Math.floor(Math.random() * phrases.length)];
      }
    }
  </script>
</div>`;
  }
}

export const tagDefs: TagDef[] = [
  {
    tag: 'gadget',
    label: 'Gadget',
    icon: '🎲',
    description: 'Interactive demo widget with randomised colours and phrases.',
    resolve: () => Gadget.render({}),
  },
];
