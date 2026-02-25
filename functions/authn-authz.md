# Authentication & Authorization

**Status:** `[ ] Todo`  
**Complexity:** Low (Cloudflare Access) → High (custom)  
**References:** [TODO.md](TODO.md)

Add authentication to protect Flint Static pages, member areas, or the Manager UI.

---

## Options

### 1. Cloudflare Access (Zero Trust) — Recommended for internal/team use

Cloudflare Access sits **in front of your entire Pages domain** as a reverse proxy. Every HTTP request passes through an IdP login (Google, GitHub, Azure AD, OTP email, etc.) before reaching your site. No code changes to `dist/`.

**How it works:**
1. In [Cloudflare One](https://one.dash.cloudflare.com/) → Access → Applications → Add Self-hosted
2. Set the protected hostname (e.g. `manager.example.com`)
3. Add Access Policies (email allowlist, GitHub org, etc.)
4. Configure an Identity Provider (Google OAuth, GitHub, etc.)

After authentication, Cloudflare issues a **signed RS256 JWT** in two places:
- `Cf-Access-Jwt-Assertion` request header (preferred)
- `CF_Authorization` cookie

**Validate the JWT in a Worker** (never rely solely on the proxy):

```typescript
import { jwtVerify, createRemoteJWKSet } from "jose";

export default {
  async fetch(request: Request, env: Env) {
    const token = request.headers.get("cf-access-jwt-assertion");
    if (!token) return new Response("Forbidden", { status: 403 });

    const JWKS = createRemoteJWKSet(
      new URL(`${env.TEAM_DOMAIN}/cdn-cgi/access/certs`)
    );
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: env.TEAM_DOMAIN,
      audience: env.POLICY_AUD,
    });
    // payload.email is the verified user identity
  },
};
```

**Env vars:**

| Var | Value |
|-----|-------|
| `TEAM_DOMAIN` | `https://<your-team>.cloudflareaccess.com` |
| `POLICY_AUD` | Application Audience tag from CF One dashboard |

**Pricing:**

| Tier | Cost | Users |
|------|------|-------|
| Free | $0 | Up to 50 users |
| Pay-as-you-go | $7/user/month | Unlimited |

**Complexity:** 🟢 Low — infra config only, minimal Worker code  
**Flint Static fit:** Excellent for Manager UI or private team site  
**Docs:** https://developers.cloudflare.com/cloudflare-one/  
**JWT validation:** https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/

---

### 2. Clerk — Recommended for customer-facing apps

Hosted auth with prebuilt sign-in/sign-up UI, OAuth providers, magic links, MFA, passkeys, and B2B organizations. The `@clerk/backend` SDK works in Cloudflare Workers.

**Worker auth middleware:**

```typescript
import { createClerkClient } from "@clerk/backend";

export default {
  async fetch(request: Request, env: Env) {
    const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
    const { isSignedIn } = await clerk.authenticateRequest(request, {
      publishableKey: env.CLERK_PUBLISHABLE_KEY,
    });
    if (!isSignedIn) return new Response("Unauthorized", { status: 401 });
  },
};
```

**Static site integration:** Embed `@clerk/clerk-js` from Clerk's CDN in a Flint Static content page. Clerk JS handles sign-in UI and stores the session JWT in a cookie. The Worker validates it via `@clerk/backend`.

**Env vars:**

| Var | Notes |
|-----|-------|
| `CLERK_PUBLISHABLE_KEY` | `pk_test_…` — safe for frontend |
| `CLERK_SECRET_KEY` | `sk_test_…` — backend only |
| `CLERK_JWT_KEY` | Optional PEM key for networkless verification |

**Pricing:**

| Plan | Cost | Monthly Retained Users |
|------|------|----------------------|
| Hobby | Free | 50,000 MRU |
| Pro | $20/month | 50,000 MRU, $0.02/extra |

**Complexity:** 🟡 Medium — SDK handles heavy lifting; domain/cookie alignment needs planning  
**Docs:** https://clerk.com/docs  
**Workers guide:** https://clerk.com/docs/references/backend/overview

---

### 3. Better Auth — Self-hosted, full control

Migration target from Auth.js/NextAuth. Has a Bun and Cloudflare Workers adapter. Requires a database (Cloudflare D1 is the natural fit — see [user-registration-db.md](user-registration-db.md)).

**Complexity:** 🟡 Medium  
**Docs:** https://better-auth.com

---

### 4. Custom `jose` + Cloudflare KV — Zero vendor lock-in

Build a lightweight stateless JWT auth layer from scratch using the Workers runtime.

**Auth flow:**

```
POST /auth/login { email, password }
  → verify password (PBKDF2 from D1)
  → sign JWT with jose (HS256)
  → Set-Cookie: session=<token>; HttpOnly; Secure; SameSite=Strict
  → 200 OK

GET /protected-page
  → Worker reads cookie
  → jwtVerify(token, secret)
  → serves page or 401
```

**JWT signing/verification:**

```typescript
import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(env.JWT_SECRET);

// Sign
const token = await new SignJWT({ sub: userId, email })
  .setProtectedHeader({ alg: "HS256" })
  .setExpirationTime("7d")
  .sign(secret);

// Verify
const { payload } = await jwtVerify(token, secret);
```

**Session store in KV (for revocation):**

```typescript
await env.SESSIONS.put(`session:${sessionId}`, userId, { expirationTtl: 604800 });
const uid = await env.SESSIONS.get(`session:${sessionId}`);
if (!uid) return new Response("Unauthorized", { status: 401 });
```

**Env vars:** `JWT_SECRET` (generate: `openssl rand -hex 32`)  
**KV bindings:** `SESSIONS` namespace in `wrangler.toml`

**Complexity:** 🟡 Medium (stateless) → 🔴 High (full user management)  
**`jose` docs:** https://github.com/panva/jose  
**KV API:** https://developers.cloudflare.com/kv/api/

---

### 5. Magic Links via Resend + KV — Passwordless

No passwords. User provides email → gets a time-limited link → clicks it → authenticated.

**Flow:**

```
POST /auth/login { email }
  → Worker: generate crypto-random token
  → KV.put("magic:abc123", email, { expirationTtl: 900 })   // 15 min TTL
  → Resend: send email with /auth/verify?token=abc123
  → Return "check your email" HTML

GET /auth/verify?token=abc123
  → email = await KV.get("magic:abc123")
  → KV.delete("magic:abc123")   // single use
  → Issue session JWT → Set-Cookie → redirect to app
```

**Resend call:**

```typescript
import { Resend } from "resend";
const resend = new Resend(env.RESEND_API_KEY);
await resend.emails.send({
  from: "no-reply@yourdomain.com",
  to: email,
  subject: "Sign in to Flint",
  html: `<a href="${verifyUrl}">Click to sign in</a> (expires in 15 min)`,
});
```

**Env vars:** `RESEND_API_KEY`, `JWT_SECRET`, `BASE_URL`  
**Resend free tier:** 3,000 emails/month, 100/day cap  
**Complexity:** 🟢 Low-Medium  
**Docs:** https://resend.com/docs/introduction

---

## Comparison

| Option | Best for | Complexity | Free tier | Custom sign-up |
|--------|---------|-----------|----------|---------------|
| Cloudflare Access | Internal tools, team sites | 🟢 Low | 50 users | No |
| Clerk | Consumer apps, B2B | 🟡 Medium | 50k MRU | Yes |
| Better Auth | Full control, framework-like | 🟡 Medium | Self-hosted | Yes |
| `jose` + KV | No vendor lock-in | 🟡 Medium | Workers KV | Yes |
| Magic links (Resend) | Passwordless consumer | 🟢 Low-Medium | 3k emails/mo | Email only |

---

## Implementation Plan

All auth patterns follow the existing `functions/` adapter pattern:

1. Create `functions/auth-handler.ts` — Bun HTTP server (local dev)
2. Create `functions/auth-cloudflare.ts` — Cloudflare Workers adapter
3. Add KV namespace binding to `wrangler.toml` if using sessions
4. Add env vars to `.env` (local dev) and Cloudflare dashboard (production)
5. Create sign-in content page: `content/auth/sign-in.md` with `:::html` form block
6. Write tests: `functions/auth-handler.test.ts`
