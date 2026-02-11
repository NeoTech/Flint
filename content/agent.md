---
title: Agent & Skills
Short-URI: agent
Template: agent-info
Type: page
Category: Documentation
Order: 6
Labels:
  - agent
  - skills
  - automation
Parent: root
Author: System
Date: 2026-02-10
Description: Meet Flint, the AI build agent, and the skills that power this project
Keywords:
  - agent
  - skills
  - copilot
  - automation
Skills:
  - name: add-content
    icon: 📝
    description: Create or edit content pages — Markdown files with YAML frontmatter for pages, blog posts, section indexes, and products.
    tags: [frontmatter, ":::children", ":::html"]
    color: green
  - name: add-template
    icon: 🏗️
    description: Create or edit page templates — HTML files with tag placeholders that define page structure and layout.
    tags: ["{{head}}", "{{content}}", "{{#if}}"]
    color: blue
  - name: add-component
    icon: ⚙️
    description: Create or edit reusable UI components — TypeScript classes extending Component<T> invoked via template tags.
    tags: ["Component<T>", escapeHtml, tag-engine]
    color: purple
  - name: build-and-test
    icon: 🧪
    description: Build the site, run tests, type-check, and lint. The core development loop for compiling Markdown to HTML.
    tags: [bun run build, bun test, typecheck]
    color: amber
  - name: create-skill
    icon: 📚
    description: Meta-skill for creating new skills. Covers the progressive disclosure pattern, the 200-line SKILL.md rule, and bundled references.
    tags: [SKILL.md, "references/", "<200 lines"]
    color: gray
---

# Skills

Skills are step-by-step procedural guides that live in `.github/skills/`. Each one teaches the agent (or a developer) how to perform a specific task correctly, following the progressive disclosure pattern: a concise SKILL.md under 200 lines plus detailed reference files.

## How They Work Together

The agent and skills form a layered system:

1. **copilot-instructions.md** — The routing document. Points the agent to the right skill or doc for any task.
2. **Skills** — The procedural layer. Each skill is a step-by-step recipe for a specific task, with references for detailed field lists and examples.
3. **Docs** — The deep-dive layer. Architecture, build system, content model, and API reference.