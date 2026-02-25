# User Registration + Database

**Status:** `[ ] Todo`  
**Complexity:** Low (D1 + PBKDF2) → Medium (Neon/Postgres)  
**References:** [TODO.md](TODO.md) · [authn-authz.md](authn-authz.md)

Add a user registration and login system. All database options target the Cloudflare Workers runtime — no TCP, no native Node modules.

---

## Recommended Stack: D1 + PBKDF2 + `jose`

**Cloudflare D1** (managed SQLite at the edge) + **PBKDF2** via `crypto.subtle` (WebCrypto, built into the Workers runtime) + **`jose`** for JWT issuance.

This combination has zero external dependencies, zero new vendor accounts, and the lowest operational overhead.

---

## Database Options

### 1. Cloudflare D1 — Recommended

Managed SQLite-compatible database. Accessed via a **Workers binding** — no connection string, no secrets to manage.

**Setup in `wrangler.toml`:**

```toml
[[d1_databases]]
binding = "DB"
database_name = "flint-users"
database_id = "<uuid from wrangler d1 create flint-users>"
```

**Query in Worker:**

```typescript
const user = await env.DB
  .prepare("SELECT id, password FROM users WHERE email = ?")
  .bind(email)
  .first<{ id: string; password: string }>();
```

**Schema:**

```sql
CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email      TEXT NOT NULL UNIQUE,
  password   TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX idx_users_email ON users(email);
```

Apply schema:

```bash
wrangler d1 execute flint-users --remote --file=./schema.sql
```

**Migrations:** Use `wrangler d1 execute` with versioned SQL files, or [Drizzle ORM](https://orm.drizzle.team/docs/get-started/cloudflare-d1) for type-safe schema management.

**Pricing:**

| Metric | Free (daily) | Paid (monthly) |
|--------|-------------|----------------|
| Rows read | 5M/day | 25B included + $0.001/M |
| Rows written | 100K/day | 50M included + $1.00/M |
| Storage | 5 GB total | 5 GB + $0.75/GB-mo |

**Env vars:** None — D1 uses a binding, not a connection string.  
**Complexity:** 🟢 Low  
**Docs:** https://developers.cloudflare.com/d1/

---

### 2. Turso (libSQL) — Edge SQLite with external account

Same SQLite semantics as D1, but hosted externally. Access via HTTP transport in Workers.

```typescript
import { createClient } from "@libsql/client/http";   // use /http not default

const turso = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});
const result = await turso.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [email] });
```

**Env vars:** `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`  
**Free tier:** 500M reads/mo, 10M writes/mo, 5 GB, 100 databases  
**Complexity:** 🟡 Medium (external account + secrets)  
**Docs:** https://docs.turso.tech/sdk/ts/quickstart

---

### 3. Neon (serverless Postgres) — Full Postgres power

Serverless Postgres that scales to zero. Use the `@neondatabase/serverless` HTTP driver in Workers.

```typescript
import { neon } from "@neondatabase/serverless";

const sql = neon(env.DATABASE_URL);
const [user] = await sql`SELECT id, password FROM users WHERE email = ${email}`;
```

Or with Cloudflare Hyperdrive (lower latency via connection pooling):

```toml
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "<hyperdrive-config-id>"
```

**Env vars:** `DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb`  
**Free tier:** 100 CU-hrs/project/month, 0.5 GB storage  
**Complexity:** 🟡 Medium–High  
**Docs:** https://neon.com/docs/serverless/serverless-driver  
**Workers guide:** https://neon.com/docs/guides/cloudflare-workers

---

### 4. Cloudflare KV — Sessions only, not user records

KV is eventually consistent and lacks transactions — unsuitable for storing user registration records. Use it for:
- Session tokens (short-lived, read-heavy)
- Rate limit counters
- Magic link tokens (see [authn-authz.md](authn-authz.md))

**Not recommended for:** email + hashed password storage (race conditions on registration, no query capability).

---

## Password Hashing in Workers

bcrypt and argon2 are **not available** natively in the Workers runtime (no native C bindings). Use **PBKDF2 via `crypto.subtle`** — WebCrypto standard, built into the V8 runtime, zero dependencies.

```typescript
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const hashBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, hash: "SHA-256", iterations: 600_000 },
    keyMaterial,
    256
  );
  const hex = (buf: ArrayBuffer) =>
    [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2$600000$${hex(salt.buffer)}$${hex(hashBits)}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [, iters, saltHex, hashHex] = stored.split("$");
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(h => parseInt(h, 16)));
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const hashBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, hash: "SHA-256", iterations: Number(iters) },
    keyMaterial, 256
  );
  const candidate = [...new Uint8Array(hashBits)].map(b => b.toString(16).padStart(2, "0")).join("");
  // Use constant-time comparison
  let match = true;
  for (let i = 0; i < candidate.length; i++) {
    if (candidate[i] !== hashHex[i]) match = false;
  }
  return match && candidate.length === hashHex.length;
}
```

OWASP 2023 recommendation: 600,000 iterations for PBKDF2-SHA256.

---

## JWT Issuance

Install `jose` (pure JS, edge-compatible):

```bash
bun add jose
```

```typescript
import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(env.JWT_SECRET);

// Issue token on login
const token = await new SignJWT({ sub: userId, email })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("7d")
  .sign(secret);

// Verify on protected routes
const { payload } = await jwtVerify(token, secret);
```

**Env vars:** `JWT_SECRET` (generate: `openssl rand -hex 32`)

---

## Complete Registration Flow

```
POST /register { email, password }

1. Validate: email format, password length (min 8)
2. Check for existing user:
     env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first()
   → 409 Conflict if found
3. Hash password:
     const hash = await hashPassword(password)   // PBKDF2 via crypto.subtle
4. Insert user:
     env.DB.prepare("INSERT INTO users (id, email, password) VALUES (?, ?, ?)")
            .bind(crypto.randomUUID(), email, hash).run()
5. Issue JWT and set cookie:
     const token = await new SignJWT({ sub: userId }).setExpirationTime("7d").sign(secret)
     Set-Cookie: session=<token>; HttpOnly; Secure; SameSite=Strict; Max-Age=604800
6. Return 201 Created
```

---

## Implementation Plan

1. Create D1 database: `wrangler d1 create flint-users`
2. Apply schema: `wrangler d1 execute flint-users --remote --file=./functions/schema.sql`
3. Add D1 binding and JWT secret to `wrangler.toml`
4. Create `functions/registration-handler.ts` — Bun HTTP server with `/register`, `/login`, `/logout` routes
5. Create `functions/registration-cloudflare.ts` — Workers adapter
6. Create content pages: `content/auth/register.md`, `content/auth/login.md` (with `:::html` form blocks)
7. Write tests: `functions/registration-handler.test.ts`

---

## Env Vars Summary

```env
# Required
JWT_SECRET=           # generate: openssl rand -hex 32
# D1 database uses wrangler.toml binding — no env var needed

# Only if using Turso instead of D1
TURSO_DATABASE_URL=libsql://<db>-<org>.turso.io
TURSO_AUTH_TOKEN=

# Only if using Neon instead of D1
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb
```
