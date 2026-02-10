# Template Examples

## Default Page (`templates/default.html`)

Standard page with navigation, centered content, and label footer.

```html
{{head}}
<body class="min-h-screen bg-gray-50">
    <div id="app" class="flex flex-col min-h-screen overflow-x-hidden">
        {{#if navigation}}{{navigation}}{{/if}}
        <main class="flex-grow max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
            <div class="overflow-hidden">
                {{content}}
            </div>
        </main>
        {{#if label-footer}}{{label-footer}}{{/if}}
    </div>
    {{foot-scripts}}
</body>
</html>
```

## Blog Post (`templates/blog-post.html`)

Article layout with byline header wrapped in `<article>` with prose styling.

```html
{{head}}
<body class="min-h-screen bg-gray-50">
    <div id="app" class="flex flex-col min-h-screen overflow-x-hidden">
        {{#if navigation}}{{navigation}}{{/if}}
        <main class="flex-grow max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
          <article class="prose prose-lg max-w-none">
            {{blog-header}}
            <div class="post-content">
              {{content}}
            </div>
          </article>
        </main>
        {{#if label-footer}}{{label-footer}}{{/if}}
    </div>
    {{foot-scripts}}
</body>
</html>
```

## Shop (`templates/shop.html`)

Shop layout with cart widget positioned top-right.

```html
{{head}}
<body class="min-h-screen bg-gray-50">
    <div id="app" class="flex flex-col min-h-screen overflow-x-hidden">
        {{#if navigation}}{{navigation}}{{/if}}
        <div class="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-4 flex justify-end">
            {{cart}}
        </div>
        <main class="flex-grow max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4">
            <div class="overflow-hidden">
                {{content}}
            </div>
        </main>
        {{#if label-footer}}{{label-footer}}{{/if}}
    </div>
    {{foot-scripts}}
</body>
</html>
```

## Sidebar Layout (example for new template)

Two-column layout with sidebar navigation. Not in codebase — illustrates the pattern.

```html
{{head}}
<body class="min-h-screen bg-gray-50">
    <div id="app" class="flex flex-col min-h-screen overflow-x-hidden">
        {{#if navigation}}{{navigation}}{{/if}}
        <div class="flex-grow max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
            <div class="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-8">
                <aside class="hidden md:block">
                    {{#if sidebar}}{{sidebar}}{{/if}}
                </aside>
                <main>
                    {{content}}
                </main>
            </div>
        </div>
        {{#if label-footer}}{{label-footer}}{{/if}}
    </div>
    {{foot-scripts}}
</body>
</html>
```

## Agent Info (`templates/agent-info.html`)

Two-column layout with content + data-driven skill cards on left, sticky sidebar on right. Demonstrates frontmatter-driven component tags.

```html
{{head}}
<body class="min-h-screen bg-gray-50">
    <div id="app" class="flex flex-col min-h-screen overflow-x-hidden">
        {{#if navigation}}{{navigation}}{{/if}}
        <div class="flex-grow max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
            <div class="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
                <main class="overflow-hidden">
                    {{content}}
                    {{skill-cards}}
                </main>
                <aside class="hidden lg:block">
                    <!-- Static sidebar content -->
                </aside>
            </div>
        </div>
        {{#if label-footer}}{{label-footer}}{{/if}}
    </div>
    {{foot-scripts}}
</body>
</html>
```

Note: `{{skill-cards}}` reads the `Skills` array from the page's frontmatter. It renders nothing if the frontmatter key is missing — no `{{#if}}` guard needed but recommended for clarity.
