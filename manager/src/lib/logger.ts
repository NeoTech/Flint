/**
 * Logger — structured request/response logging for Flint Manager.
 *
 * Writes NDJSON (newline-delimited JSON) to stdout on every request.
 * Optionally appends to a daily rotating log file.
 *
 * Usage in server.ts:
 *   import { createLogger } from './src/lib/logger.js';
 *   const logger = createLogger({ logDir: './logs' });
 *   // wrap the fetch handler:
 *   const response = await handleRequest(req);
 *   logger.logRequest(req, url, response, ms, action);
 *
 * Format (one JSON object per line):
 * {"ts":"2026-02-20T14:32:01.123Z","method":"PUT","path":"/sites/main/env","status":200,"ms":4,"action":"Saved .env for site main"}
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LogEntry {
  ts: string;
  method: string;
  /** URL pathname only — never includes query string to avoid token leakage */
  path: string;
  status: number;
  ms: number;
  action: string;
}

export interface LoggerOptions {
  /** If set, logs are also appended to daily files in this directory. */
  logDir?: string;
  /** How many days of log files to retain. Default: 7 */
  retainDays?: number;
  /** Write to stdout (default true) */
  stdout?: boolean;
}

// ---------------------------------------------------------------------------
// Action derivation — human-readable summary from method + pathname
// ---------------------------------------------------------------------------

/**
 * Derive a human-readable action string from a request's method and path.
 * Never includes sensitive data (no body contents, no query params).
 */
export function deriveAction(method: string, pathname: string): string {
  // Exact matches first
  const exact: Record<string, string> = {
    'GET /':            'Viewed dashboard',
    'GET /login':       'Viewed login page',
    'POST /login':      'Login attempt',
    'GET /api/sites':   'Listed all sites',
    'POST /api/sites':  'Added site',
    'GET /sites/new':   'Viewed add-site form',
  };
  const key = `${method} ${pathname}`;
  if (exact[key]) return exact[key];

  // Pattern matches (checked in order)
  const patterns: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
    [/^DELETE \/api\/sites\/([^/]+)$/,                  m => `Removed site ${m[1]}`],
    [/^GET \/sites\/([^/]+)\/pages\/new$/,              m => `New page form — site ${m[1]}`],
    [/^POST \/sites\/([^/]+)\/pages$/,                  m => `Created page — site ${m[1]}`],
    [/^PATCH \/sites\/([^/]+)\/pages\/reorder$/,        m => `Reordered pages — site ${m[1]}`],
    [/^DELETE \/sites\/([^/]+)\/pages\/(.+)$/,          m => `Deleted page ${m[2]} — site ${m[1]}`],
    [/^PUT \/sites\/([^/]+)\/pages\/(.+)\/parsed$/,     m => `Saved page ${m[2]} — site ${m[1]}`],
    [/^PUT \/sites\/([^/]+)\/pages\/(.+)$/,             m => `Saved page ${m[2]} (raw) — site ${m[1]}`],
    [/^GET \/sites\/([^/]+)\/pages\/(.+)\/parsed$/,     m => `Read page ${m[2]} — site ${m[1]}`],
    [/^GET \/sites\/([^/]+)\/pages\/(.+)$/,             m => `Opened page ${m[2]} — site ${m[1]}`],
    [/^GET \/sites\/([^/]+)\/pages$/,                   m => `Viewed pages — site ${m[1]}`],
    [/^PUT \/sites\/([^/]+)\/products\/parsed$/,        m => `Saved products (parsed) — site ${m[1]}`],
    [/^GET \/sites\/([^/]+)\/products\/parsed$/,        m => `Read products (parsed) — site ${m[1]}`],
    [/^PUT \/sites\/([^/]+)\/products$/,                m => `Saved products.yaml — site ${m[1]}`],
    [/^GET \/sites\/([^/]+)\/products$/,                m => `Read products.yaml — site ${m[1]}`],
    [/^POST \/sites\/([^/]+)\/products\/sync\/force$/,  m => `Synced products (force) — site ${m[1]}`],
    [/^POST \/sites\/([^/]+)\/products\/sync$/,         m => `Synced products — site ${m[1]}`],
    [/^POST \/sites\/([^/]+)\/products\/generate$/,     m => `Generated product pages — site ${m[1]}`],
    [/^POST \/sites\/([^/]+)\/build$/,                  m => `Built site ${m[1]}`],
    [/^GET \/sites\/([^/]+)\/build$/,                   m => `Viewed build — site ${m[1]}`],
    [/^PUT \/sites\/([^/]+)\/env$/,                     m => `Saved .env — site ${m[1]}`],
    [/^GET \/sites\/([^/]+)\/env$/,                     m => `Viewed .env — site ${m[1]}`],
    [/^PUT \/sites\/([^/]+)\/themes\/active$/,          m => `Set active theme — site ${m[1]}`],
    [/^GET \/sites\/([^/]+)\/themes\/active$/,          m => `Read active theme — site ${m[1]}`],
    [/^GET \/sites\/([^/]+)\/themes\/([^/]+)\/templates$/, m => `Listed templates for theme ${m[2]} — site ${m[1]}`],
    [/^GET \/sites\/([^/]+)\/themes$/,                  m => `Viewed themes — site ${m[1]}`],
    [/^GET \/sites\/([^/]+)\/components\/([^/]+)$/,     m => `Viewed component ${m[2]} — site ${m[1]}`],
    [/^GET \/sites\/([^/]+)\/components$/,              m => `Viewed components — site ${m[1]}`],
    [/^GET \/sites\/([^/]+)\/?$/,                       m => `Viewed site ${m[1]}`],
  ];

  for (const [re, fn] of patterns) {
    const m = `${method} ${pathname}`.match(re);
    if (m) return fn(m);
  }

  return `${method} ${pathname}`;
}

// ---------------------------------------------------------------------------
// Logger class
// ---------------------------------------------------------------------------

export class Logger {
  private readonly opts: Required<LoggerOptions>;
  private currentDay = '';
  private currentFile = '';

  constructor(opts: LoggerOptions = {}) {
    this.opts = {
      logDir: opts.logDir ?? '',
      retainDays: opts.retainDays ?? 7,
      stdout: opts.stdout ?? true,
    };
    if (this.opts.logDir && !existsSync(this.opts.logDir)) {
      mkdirSync(this.opts.logDir, { recursive: true });
    }
  }

  log(entry: LogEntry): void {
    const line = JSON.stringify(entry);
    if (this.opts.stdout) process.stdout.write(line + '\n');
    if (this.opts.logDir) this.appendToFile(line);
  }

  /** Convenience method called from the server wrapper. */
  logRequest(req: Request, url: URL, response: Response, ms: number): void {
    this.log({
      ts: new Date().toISOString(),
      method: req.method,
      path: url.pathname, // no query string — prevents token leakage
      status: response.status,
      ms: Math.round(ms),
      action: deriveAction(req.method, url.pathname),
    });
  }

  // ---- file rotation --------------------------------------------------------

  private currentDayTag(): string {
    return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  }

  private appendToFile(line: string): void {
    const day = this.currentDayTag();
    if (day !== this.currentDay) {
      this.currentDay = day;
      this.currentFile = join(this.opts.logDir, `manager-${day}.log`);
      this.pruneOldFiles();
    }
    appendFileSync(this.currentFile, line + '\n', 'utf-8');
  }

  private pruneOldFiles(): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.opts.retainDays);
    const cutoffTag = cutoff.toISOString().slice(0, 10);
    try {
      readdirSync(this.opts.logDir)
        .filter(f => /^manager-\d{4}-\d{2}-\d{2}\.log$/.test(f))
        .filter(f => f.slice(8, 18) < cutoffTag) // compare "YYYY-MM-DD"
        .forEach(f => unlinkSync(join(this.opts.logDir, f)));
    } catch { /* ignore prune errors */ }
  }
}

/** Create a logger instance. Drop-in for the server. */
export function createLogger(opts: LoggerOptions = {}): Logger {
  return new Logger(opts);
}
