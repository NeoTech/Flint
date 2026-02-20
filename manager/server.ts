/**
 * Flint Manager — Bun HTTP server entry point.
 *
 * Start:  bun server.ts        (production)
 *         bun --hot server.ts  (dev with hot reload)
 *
 * Config:
 *   MANAGER_PORT     — port to listen on (default: 4000)
 *   MANAGER_API_KEY  — bearer token for auth (see .env.example)
 *                      If unset a key is auto-generated on first boot
 *                      and saved to manager/.env
 */
import { randomBytes } from 'crypto';
import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { handleRequest } from './src/router.js';
import { createLogger } from './src/lib/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLACEHOLDER = 'change-me-to-a-strong-random-secret';
const ENV_PATH = join(__dirname, '.env');

/**
 * Ensure MANAGER_API_KEY is set.
 * Priority: process.env → manager/.env → auto-generate (writes to .env).
 */
function resolveApiKey(): string {
  // 1. Already in environment and not the placeholder
  if (process.env.MANAGER_API_KEY && process.env.MANAGER_API_KEY !== PLACEHOLDER) {
    return process.env.MANAGER_API_KEY;
  }

  // 2. Read from .env file
  if (existsSync(ENV_PATH)) {
    const lines = readFileSync(ENV_PATH, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('MANAGER_API_KEY=')) {
        const val = trimmed.slice('MANAGER_API_KEY='.length).trim();
        if (val && val !== PLACEHOLDER) {
          process.env.MANAGER_API_KEY = val;
          return val;
        }
      }
    }
  }

  // 3. Auto-generate and persist
  const generated = randomBytes(32).toString('hex');
  const line = `MANAGER_API_KEY=${generated}\n`;

  if (existsSync(ENV_PATH)) {
    const current = readFileSync(ENV_PATH, 'utf-8');
    if (current.includes('MANAGER_API_KEY=')) {
      // Replace stale placeholder line
      writeFileSync(ENV_PATH, current.replace(/MANAGER_API_KEY=.*\n?/, line));
    } else {
      appendFileSync(ENV_PATH, '\n' + line);
    }
  } else {
    writeFileSync(ENV_PATH, line);
  }

  process.env.MANAGER_API_KEY = generated;

  const port = process.env.MANAGER_PORT ?? '8080';
  console.log('\n┌──────────────────────────────────────────────────────────────┐');
  console.log('│  ⚠  No MANAGER_API_KEY found — generated a new key           │');
  console.log('│                                                                │');
  console.log(`│  Key: ${generated}  │`);
  console.log('│                                                                │');
  console.log('│  Saved to manager/.env — this message won\'t repeat.           │');
  console.log(`│  Login → http://localhost:${port}/login                         │`);
  console.log('└──────────────────────────────────────────────────────────────┘\n');

  return generated;
}

resolveApiKey();

const PORT = parseInt(process.env.MANAGER_PORT ?? '8080', 10);
const LOG_DIR = process.env.MANAGER_LOG_DIR ?? '';

const logger = createLogger({ logDir: LOG_DIR || undefined });

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const t0 = performance.now();
    const url = new URL(req.url);
    let response: Response;
    try {
      response = await handleRequest(req);
    } catch (err) {
      console.error('[manager] Unhandled error:', err);
      response = new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }
    logger.logRequest(req, url, response, performance.now() - t0);
    return response;
  },
});

console.log(`⚡ Flint Manager running at http://localhost:${server.port}`);
