# Themes

Flint Static uses a **build-time overlay** theme system. Themes are resolved once at build time — no runtime overhead.

## Directory structure

```
themes/
  default/           ← built-in base theme (always present)
    templates/       ← all .html templates used by the default site
    styles/
      main.css       ← Tailwind entry point for the default theme
  <name>/            ← your custom theme (any folder name)
    templates/       ← only the .html templates you want to override
    styles/
      main.css       ← full CSS replacement (replaces default, not appended)
```

## Activating a theme

Set `THEME=<name>` in your `.env` file (or in the environment):

```
THEME=dark
```

Then run the normal build:

```bash
bun run build
```

Both the static builder and Rspack bundler pick up `THEME` automatically.

## How the overlay works

1. **Templates**: `themes/default/templates/` is loaded first.  
   If your theme provides a file with the same name, it **overwrites** the default.  
   Files you don't include are inherited unchanged from the default theme.

2. **CSS**: If `themes/<name>/styles/main.css` exists, it **replaces** the default CSS entirely.  
   If it doesn't exist, `themes/default/styles/main.css` is used as the fallback.

## Creating a new theme

```bash
mkdir -p themes/dark/templates themes/dark/styles
```

- Copy any templates you want to customise from `themes/default/templates/` into `themes/dark/templates/` and edit them.
- Copy `themes/default/styles/main.css` into `themes/dark/styles/main.css` and edit it.
- Set `THEME=dark` in `.env` and run `bun run build`.

You only need to include the files that differ from the default. The rest are inherited automatically.
