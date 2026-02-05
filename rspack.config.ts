import { defineConfig } from '@rspack/cli';
import { rspack } from '@rspack/core';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

export default defineConfig({
  entry: {
    main: './src/index.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'assets/[name].js',
    clean: false, // Don't clean - static builder outputs to dist too
  },
  resolve: {
    extensions: ['.ts', '.js'],
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
