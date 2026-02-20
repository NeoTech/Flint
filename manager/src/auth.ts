/**
 * Auth middleware — Bearer token + session cookie + URL token strategy.
 *
 * The manager is protected by a single shared secret set in
 * MANAGER_API_KEY in the manager's own .env file.
 *
 * Three ways to authenticate:
 *   1. Authorization: Bearer <token>  (API clients, curl, etc.)
 *   2. X-Manager-Token cookie         (set after login form POST)
 *   3. ?token=<token> query param     (launch links — sets cookie + redirects)
 *
 * The login form at GET /login posts to POST /login, which sets
 * the cookie and redirects to /.
 *
 * Activity tracking:
 *   recordActivity() is called on every authenticated request.
 *   getLastActive() returns the ISO timestamp — used by GET /_health so a
 *   container orchestrator can park idle instances.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANAGER_ROOT = join(__dirname, '..');
const COOKIE_NAME = 'X-Manager-Token';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/** Load MANAGER_API_KEY from process.env or manager/.env */
function loadApiKey(): string {
  if (process.env.MANAGER_API_KEY) return process.env.MANAGER_API_KEY;
  const envPath = join(MANAGER_ROOT, '.env');
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('MANAGER_API_KEY=')) {
        return trimmed.slice('MANAGER_API_KEY='.length).trim();
      }
    }
  }
  return '';
}

/** Returns true if the request carries a valid auth token. */
export function isAuthenticated(req: Request): boolean {
  const key = loadApiKey();
  if (!key) return false; // key is always set by server.ts — this is a safety net

  // 1. Bearer token header
  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim() === key;
  }

  // 2. Cookie
  const cookieHeader = req.headers.get('Cookie') ?? '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k.trim(), v.join('=').trim()];
    })
  );
  return cookies[COOKIE_NAME] === key;
}

/**
 * Check whether the URL contains a valid ?token= parameter.
 * Returns the clean redirect URL (token stripped) if valid, null if not.
 */
export function checkUrlToken(req: Request): string | null {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token) return null;
  const key = loadApiKey();
  if (!key || token !== key) return null;
  // Build redirect target: same path + remaining params (token removed)
  url.searchParams.delete('token');
  const target = url.pathname + (url.search || '') + (url.hash || '');
  return target || '/';
}

/** Build a Set-Cookie header value for the session token. */
export function buildSessionCookie(secure: boolean = false): string {
  const key = loadApiKey();
  const parts = [
    `${COOKIE_NAME}=${key}`,
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

/** Return a 302 redirect to the login page. */
export function redirectToLogin(returnTo?: string): Response {
  const dest = returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : '/login';
  return new Response(null, {
    status: 302,
    headers: { Location: dest },
  });
}

/** Return a 401 JSON response for API calls. */
export function unauthorizedJson(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Build a Set-Cookie header that clears the session (logout). */
export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

// ---- Activity tracking -------------------------------------------------------
// Updated on every authenticated request; read by GET /_health so the
// container orchestrator can detect idle instances and park them.

let _lastActive: Date = new Date();

export function recordActivity(): void {
  _lastActive = new Date();
}

export function getLastActive(): Date {
  return _lastActive;
}
