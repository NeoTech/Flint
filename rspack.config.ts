import { defineConfig } from '@rspack/cli';
import { rspack } from '@rspack/core';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import { getKeyDefines } from './scripts/obfuscate-key.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
const basePath = process.env.BASE_PATH || '';

// Resolve the active theme's CSS, falling back to the default theme
const _theme = (process.env.THEME || '').trim();
function resolveThemeCss(): string {
  if (_theme && _theme !== 'default') {
    const themed = path.resolve(__dirname, `themes/${_theme}/styles/main.css`);
    if (existsSync(themed)) return themed;
  }
  return path.resolve(__dirname, 'themes/default/styles/main.css');
}
const resolvedThemeCss = resolveThemeCss();

function readDotEnv(): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(path.join(__dirname, '.env'), 'utf-8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#') && l.includes('='))
        .map((l) => {
          const idx = l.indexOf('=');
          return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()] as [string, string];
        }),
    );
  } catch {
    return {};
  }
}

function getEnvVar(key: string, fallback: string): string {
  const env = readDotEnv();
  return process.env[key] || env[key] || fallback;
}

export default defineConfig({
  entry: {
    main: './src/index.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'assets/[name].js',
    publicPath: basePath ? `${basePath}/` : '/',
    clean: false, // Don't clean - static builder outputs to dist too
  },
  resolve: {
    alias: {
      'flint-theme-styles': resolvedThemeCss,
    },
    extensions: ['.ts', '.js'],
    extensionAlias: {
      '.js': ['.ts', '.js'],
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: [/node_modules/],
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: {
              syntax: 'typescript',
            },
            target: 'es2022',
          },
        },
        type: 'javascript/auto',
      },
      {
        test: /\.css$/,
        use: [
          // Extract CSS to files instead of injecting
          rspack.CssExtractRspackPlugin.loader,
          'css-loader',
          {
            loader: 'postcss-loader',
          },
        ],
      },
    ],
  },
  plugins: [
    // Extract CSS to separate files
    new rspack.CssExtractRspackPlugin({
      filename: 'assets/[name].css',
    }),
    new rspack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      __THEME__: JSON.stringify(_theme || 'default'),
      __CHECKOUT_MODE__: JSON.stringify(getEnvVar('CHECKOUT_MODE', 'payment-links')),
      __CHECKOUT_ENDPOINT__: JSON.stringify(getEnvVar('CHECKOUT_ENDPOINT', 'http://localhost:3001')),
      __BASE_PATH__: JSON.stringify(getEnvVar('BASE_PATH', '')),
      ...getKeyDefines(),
    }),
    // Copy static files if they exist
    new rspack.CopyRspackPlugin({
      patterns: [
        { from: 'static', to: 'static', noErrorOnMissing: true },
      ],
    }),
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
      serveIndex: true,
    },
    compress: true,
    port: 3000,
    hot: true,
    open: false, // Don't auto-open when using ngrok
    // Allow ngrok and other tunnel services
    allowedHosts: 'all',
    // Trust ngrok's proxy headers
    webSocketServer: {
      options: {
        // Allow WebSocket connections from any origin (needed for HMR through ngrok)
        origin: '*',
      },
    },
    // Configure client-side WebSocket for HMR through ngrok
    client: {
      webSocketURL: 'auto://0.0.0.0:0/ws', // Auto-detect host from browser
    },
    historyApiFallback: {
      rewrites: [
        { from: /^\/$/, to: '/index.html' },
        { from: /^\/about\/?$/, to: '/about/index.html' },
        { from: /^\/blog\/(.*)$/, to: '/blog/$1/index.html' },
      ],
    },
  },
  mode: isProduction ? 'production' : 'development',
  devtool: isProduction ? 'source-map' : 'eval-source-map',
});
