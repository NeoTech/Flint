import { Component, type ComponentProps } from './component.js';

export interface LayoutProps extends ComponentProps {
  title: string;
  description?: string;
  children: string;
  lang?: string;
  cssFiles?: string[];
  jsFiles?: string[];
}

/**
 * Layout component - provides the base HTML structure for all pages
 * Includes HTMX, Tailwind CSS, and meta tags
 */
export class Layout extends Component<LayoutProps> {
  render(): string {
    const {
      title,
      description,
      children,
      lang = 'en',
      cssFiles = [],
      jsFiles = [],
    } = this.props;

    const cssLinks = cssFiles
      .map(file => `    <link rel="stylesheet" href="${file}">`)
      .join('\n');

    const jsScripts = jsFiles
      .map(file => `    <script src="${file}"></script>`)
      .join('\n');

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${description ? `<meta name="description" content="${description}">` : ''}
    <title>${title}</title>
    <link rel="stylesheet" href="/assets/main.css">
${cssLinks}
${jsScripts}
</head>
<body class="min-h-screen bg-gray-50">
    <div id="app" class="flex flex-col min-h-screen">
        ${children}
    </div>
    <script src="/assets/main.js"></script>
</body>
</html>`;
  }
}
