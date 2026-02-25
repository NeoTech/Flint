# Serverless Forms + Email

**Status:** `[ ] Todo`  
**Complexity:** Low  
**References:** [TODO.md](TODO.md)

Contact forms, lead capture, and transactional email — all via a Cloudflare Worker. No persistent server required.

---

## Recommended Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Email delivery | **Resend** | 3,000 free/month, arbitrary recipients, REST API |
| Bot protection | **Cloudflare Turnstile** | Free, invisible, no UX friction |
| Form submission | **Cloudflare Worker** | Fits existing `functions/` pattern |
| Client interaction | **HTMX** | Form submits without page reload; Worker returns HTML fragment |

---

## Complete Flow

```
Static HTML form (Flint Static content page :::html block)
  → HTMX POST (hx-post="/api/contact")
  → CF Worker /api/contact
      1. Parse FormData
      2. Verify Turnstile token → challenges.cloudflare.com
      3. Sanitise + validate fields
      4. Send email via Resend REST API
      5. Return HTML fragment (HTMX swaps in success/error)
```

---

## Form HTML (`:::html` block in a Flint Static content page)

```html
<form hx-post="/api/contact" hx-target="#form-result" hx-swap="innerHTML"
      hx-indicator="#form-spinner" class="space-y-4 max-w-lg">

  <div>
    <label class="block text-sm font-medium" for="name">Name</label>
    <input id="name" name="name" type="text" required
           class="mt-1 block w-full rounded border-gray-300 shadow-sm" />
  </div>

  <div>
    <label class="block text-sm font-medium" for="email">Email</label>
    <input id="email" name="email" type="email" required
           class="mt-1 block w-full rounded border-gray-300 shadow-sm" />
  </div>

  <div>
    <label class="block text-sm font-medium" for="message">Message</label>
    <textarea id="message" name="message" rows="4" required
              class="mt-1 block w-full rounded border-gray-300 shadow-sm"></textarea>
  </div>

  <!-- Cloudflare Turnstile widget — auto-injects cf-turnstile-response hidden input -->
  <div class="cf-turnstile" data-sitekey="YOUR_TURNSTILE_SITE_KEY"></div>

  <button type="submit"
          class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
    Send message
  </button>
  <span id="form-spinner" class="htmx-indicator ml-2 text-sm text-gray-500">Sending…</span>
</form>

<div id="form-result"></div>

<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
```

---

## Worker Handler (`functions/contact-handler.ts`)

```typescript
interface Env {
  RESEND_API_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  CONTACT_EMAIL: string;        // destination address
  CONTACT_FROM: string;         // e.g. "noreply@yourdomain.com"
}

export async function handleContact(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const body = await request.formData();

  // 1. Verify Turnstile
  const tsToken = body.get("cf-turnstile-response") as string | null;
  if (!tsToken) {
    return htmlResponse('<p class="text-red-600">Missing CAPTCHA token.</p>', 400);
  }
  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  const tsRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: tsToken, remoteip: ip }),
  });
  const ts = await tsRes.json<{ success: boolean }>();
  if (!ts.success) {
    return htmlResponse('<p class="text-red-600">CAPTCHA verification failed. Please try again.</p>', 400);
  }

  // 2. Extract + validate fields
  const name    = (body.get("name")    as string | null)?.trim() ?? "";
  const email   = (body.get("email")   as string | null)?.trim() ?? "";
  const message = (body.get("message") as string | null)?.trim() ?? "";

  if (!name || !email || !message) {
    return htmlResponse('<p class="text-red-600">All fields are required.</p>', 422);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return htmlResponse('<p class="text-red-600">Please enter a valid email address.</p>', 422);
  }

  // 3. Send via Resend
  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from:     env.CONTACT_FROM,
      to:       [env.CONTACT_EMAIL],
      reply_to: email,
      subject:  `New contact from ${name}`,
      html:     `<p><strong>Name:</strong> ${escape(name)}</p>
                 <p><strong>Email:</strong> ${escape(email)}</p>
                 <p><strong>Message:</strong><br>${escape(message).replace(/\n/g, "<br>")}</p>`,
    }),
  });

  if (!emailRes.ok) {
    console.error("Resend error:", await emailRes.text());
    return htmlResponse('<p class="text-red-600">Could not send your message. Please try again later.</p>', 500);
  }

  return htmlResponse(
    `<p class="text-green-600 font-medium">Thanks ${escape(name)}! Your message has been sent.</p>`
  );
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, { status, headers: { "Content-Type": "text/html;charset=UTF-8" } });
}

function escape(str: string): string {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
```

---

## Email Providers

### Resend — Recommended

Pure REST API, works in Workers via `fetch`. Can send to any recipient.

```typescript
await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ from, to, subject, html }),
});
```

**Pricing:**

| Plan | Cost | Emails/month | Daily cap |
|------|------|-------------|-----------|
| Free | $0 | 3,000 | 100/day |
| Pro | $20/month | 50,000 | None |
| Scale | $90/month | 100,000 | None |

**Env vars:** `RESEND_API_KEY`  
**Docs:** https://resend.com/docs/introduction

---

### Postmark — Better deliverability for high volume

Same integration pattern — pure REST API, no SDK needed.

```typescript
await fetch("https://api.postmarkapp.com/email", {
  method: "POST",
  headers: {
    "X-Postmark-Server-Token": env.POSTMARK_SERVER_TOKEN,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  body: JSON.stringify({ From, To, Subject, HtmlBody, TextBody, MessageStream: "outbound" }),
});
```

**Pricing:** Free dev tier: 100 emails/month. Basic: $15/month for 10,000.  
**Env vars:** `POSTMARK_SERVER_TOKEN`  
**Docs:** https://postmarkapp.com/developer/api/overview

---

### Cloudflare Email Routing + Workers — Owner notification only

Uses a `send_email` binding. Can **only send to pre-verified destination addresses** — no arbitrary recipients. Good for notifying the site owner; cannot send confirmation emails to form submitters.

```toml
# wrangler.toml
[[send_email]]
name = "CONTACT_EMAIL"
destination_address = "you@yourdomain.com"
```

**Pricing:** Free (requires CF Email Routing active on domain)  
**Docs:** https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/

---

## Cloudflare Turnstile CAPTCHA

Drop-in bot protection. Non-interactive by default (invisible to good users).

**Client-side:** Add `<script>` and widget `<div>` (shown in form HTML above). The widget auto-injects a `cf-turnstile-response` hidden field.

**Server-side verification:**

```typescript
const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
});
const { success } = await res.json<{ success: boolean }>();
```

Token characteristics: max 2,048 chars, valid for 300 seconds, single-use.

**Pricing:** Free (up to 20 widgets, unlimited challenges)  
**Env vars:** `TURNSTILE_SECRET_KEY` (server), `TURNSTILE_SITE_KEY` (client, public)  
**Docs:** https://developers.cloudflare.com/turnstile/

---

## Form-to-Storage Integrations

Instead of (or in addition to) email, pipe submissions to a data store.

### Airtable

```typescript
await fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/Submissions`, {
  method: "POST",
  headers: { Authorization: `Bearer ${env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ fields: { Name: name, Email: email, Message: message } }),
});
```

**Free tier:** 1,000 records/base · **Env vars:** `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`

### Notion

```typescript
await fetch("https://api.notion.com/v1/pages", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${env.NOTION_API_KEY}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28",
  },
  body: JSON.stringify({
    parent: { database_id: env.NOTION_DATABASE_ID },
    properties: {
      Name:    { title: [{ text: { content: name } }] },
      Email:   { email },
      Message: { rich_text: [{ text: { content: message } }] },
    },
  }),
});
```

**Env vars:** `NOTION_API_KEY`, `NOTION_DATABASE_ID`

### Pipedream / Zapier Webhook (no-code)

```typescript
await fetch(env.PIPEDREAM_WEBHOOK_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name, email, message, timestamp: Date.now() }),
});
```

Route from Pipedream/Zapier/Make to any destination (Google Sheets, Slack, HubSpot, etc.) with zero auth code in the Worker.

**Free tier:** Pipedream 10,000 events/month · **Env vars:** `PIPEDREAM_WEBHOOK_URL`

---

## Env Vars Summary

```env
# Required
RESEND_API_KEY=              # From resend.com dashboard
TURNSTILE_SECRET_KEY=        # From Cloudflare dashboard → Turnstile → widget
TURNSTILE_SITE_KEY=          # Public key — safe to embed in HTML
CONTACT_EMAIL=you@example.com
CONTACT_FROM=noreply@yourdomain.com

# Optional — if using Airtable
AIRTABLE_API_KEY=
AIRTABLE_BASE_ID=

# Optional — if using Notion
NOTION_API_KEY=
NOTION_DATABASE_ID=

# Optional — no-code webhook
PIPEDREAM_WEBHOOK_URL=
```

---

## Implementation Plan

1. Create `functions/contact-handler.ts` — Bun HTTP server handler (code above)
2. Create `functions/contact-cloudflare.ts` — Cloudflare Workers adapter (same pattern as `checkout-cloudflare.ts`)
3. Add env vars to `.env` (local dev) and Cloudflare Workers dashboard (production)
4. Create `content/contact.md` — Flint Static content page with `:::html` form block
5. Deploy alongside other Workers: update `bun run deploy:checkout:cloudflare` or add a `deploy:contact:cloudflare` script
6. Write tests: `functions/contact-handler.test.ts`
