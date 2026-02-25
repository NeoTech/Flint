# File Uploads & Media Management

**Status:** `[ ] Todo`  
**Complexity:** Low (UploadThing / build-time sharp) → Medium (R2 + presigned URL)  
**References:** [TODO.md](TODO.md)

Image and file uploads, responsive image generation, and video delivery for Flint Static sites and the Manager UI.

---

## Recommended Architecture

| Use case | Solution | Complexity |
|----------|----------|-----------|
| Static product/blog images | `sharp` at build time → WebP/AVIF in `static/` | 🟢 Low |
| Manager UI media uploads | R2 presigned PUT URL → Worker metadata in D1 | 🟡 Medium |
| Dynamic image resizing | CF Images Transform (`cdn-cgi/image/`) | 🟢 Low |
| Video | Cloudflare Stream | 🟡 Medium |
| Quick developer DX | UploadThing | 🟢 Low |

---

## 1. Cloudflare R2 — Recommended Storage Backend

S3-compatible object storage with **zero egress fees**. The most natural fit for a Cloudflare-native stack.

**Pricing:**

| Dimension | Free Tier | Paid |
|-----------|----------|------|
| Storage | 10 GB-month/month | $0.015/GB-month |
| Class A ops (PUT, LIST) | 1M requests/month | $4.50/million |
| Class B ops (GET, HEAD) | 10M requests/month | $0.36/million |
| Egress | Free | Free |

### Option A — Native Worker binding (simplest)

```toml
# wrangler.toml
[[r2_buckets]]
binding = "MEDIA_BUCKET"
bucket_name = "flint-media"
```

```typescript
// Worker
await env.MEDIA_BUCKET.put("uploads/photo.jpg", request.body, {
  httpMetadata: { contentType: "image/jpeg" },
});
const obj = await env.MEDIA_BUCKET.get("uploads/photo.jpg");
return new Response(obj?.body);
```

No env vars needed — binding-based access only.

### Option B — Presigned PUT URL (browser uploads directly to R2)

Best for the Manager UI: browser uploads bypass the Worker entirely, reducing Worker bandwidth costs.

```typescript
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const S3 = new S3Client({
  region: "auto",
  endpoint: `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

// Worker route: POST /api/upload/init → returns presigned URL
const key   = `uploads/${crypto.randomUUID()}.jpg`;
const putUrl = await getSignedUrl(
  S3,
  new PutObjectCommand({ Bucket: "flint-media", Key: key, ContentType: "image/jpeg" }),
  { expiresIn: 300 }   // 5 minutes
);
return Response.json({ uploadUrl: putUrl, key });
```

> ⚠️ Presigned URLs only work with the S3 API domain (`*.r2.cloudflarestorage.com`). Must enable CORS on the bucket for browser direct uploads. Use `PUT`, not `POST` (multipart uploads not supported).

### Public reads

Attach a custom domain from your Cloudflare zone to the bucket (R2 → Settings → Custom Domains). The R2 `r2.dev` subdomain is rate-limited and dev-only. Custom domain gives you Cloudflare CDN caching on top of R2 for free.

**Env vars (for presigned URLs only):**

```env
R2_ACCESS_KEY_ID=          # R2 API token Access Key ID
R2_SECRET_ACCESS_KEY=      # R2 API token Secret Access Key  
CF_ACCOUNT_ID=             # Cloudflare account ID
```

**Docs:** https://developers.cloudflare.com/r2/

---

## 2. Browser Direct Upload Flow (R2 + D1 + Worker)

Complete pattern for the Manager UI or a content editor:

```
Browser
  1. POST /api/upload/init → { uploadUrl, fileId, key }
  2. PUT <binary> directly to R2 (presigned URL, bypasses Worker)
  3. POST /api/upload/complete { fileId, key } → { publicUrl }

Worker
  Step 1: generate R2 presigned URL, return to browser
  Step 3: save metadata to D1 media table, return public CDN URL
```

**D1 media table:**

```sql
CREATE TABLE media (
  id         TEXT PRIMARY KEY,
  key        TEXT NOT NULL,             -- R2 object key
  public_url TEXT NOT NULL,             -- https://media.example.com/uploads/...
  mime_type  TEXT,
  size_bytes INTEGER,
  uploaded_by TEXT,
  uploaded_at INTEGER DEFAULT (unixepoch())
);
```

Static pages reference `public_url` in Markdown frontmatter (`Image: https://media.example.com/uploads/hero.jpg`) or via the Manager products editor.

---

## 3. Cloudflare Images — On-demand Transform

Resize, convert format (WebP/AVIF), and serve images from Cloudflare's CDN without a build step.

**Enable:** Cloudflare dashboard → Zone → Speed → Optimization → Image Resizing → On

**URL transform (no Worker needed):**

```
https://yourdomain.com/cdn-cgi/image/width=800,format=auto,quality=85/static/hero.jpg
```

**Worker transform (programmatic):**

```typescript
const imageResp = await fetch(
  `https://your-bucket.yourdomain.com${url.pathname}`,
  {
    cf: {
      image: {
        width: 800,
        fit: "scale-down",
        format: accept.includes("avif") ? "avif"
              : accept.includes("webp") ? "webp"
              : "jpeg",
        quality: 85,
      },
    } as any,
  }
);
return imageResp;
```

**Pricing:** Free tier: 5,000 unique transforms/month. Beyond: $0.50/1,000 unique transforms. "Unique" = one distinct `(image + params)` combo per calendar month — cached transforms are never rebilled.

**No env vars** — enabled as a zone setting in the dashboard.  
**Docs:** https://developers.cloudflare.com/images/

---

## 4. `sharp` — Build-time Image Optimization

Generate responsive WebP/AVIF images at build time. Bun-compatible (`libvips` Node-API v9).

```bash
bun add sharp
bun add -d @types/sharp
```

**Build script (`scripts/optimize-images.ts`):**

```typescript
import sharp from "sharp";
import { readdir, mkdir } from "fs/promises";

const INPUT  = "static/products/original";
const OUTPUT = "static/products";
const SIZES  = [400, 800, 1200] as const;

await mkdir(OUTPUT, { recursive: true });

for (const file of await readdir(INPUT)) {
  if (!/\.(jpe?g|png|webp)$/i.test(file)) continue;
  const stem = file.replace(/\.[^.]+$/, "");

  for (const w of SIZES) {
    await sharp(`${INPUT}/${file}`)
      .resize(w, null, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(`${OUTPUT}/${stem}-${w}w.webp`);
  }

  // Modern formats for browsers that support them
  await sharp(`${INPUT}/${file}`)
    .resize(800, null, { fit: "inside" })
    .avif({ quality: 60 })
    .toFile(`${OUTPUT}/${stem}-800w.avif`);
}
```

**Usage in Flint Static templates or `:::html` blocks:**

```html
<picture>
  <source srcset="/products/hero-800w.avif" type="image/avif">
  <source srcset="/products/hero-1200w.webp 1200w, /products/hero-800w.webp 800w, /products/hero-400w.webp 400w"
          type="image/webp" sizes="(max-width: 800px) 100vw, 800px">
  <img src="/products/hero-800w.webp" width="800" loading="lazy" alt="Product image">
</picture>
```

**Complexity:** 🟢 Low · **Free, MIT** · https://sharp.pixelplumbing.com/

---

## 5. UploadThing — Quick DX Alternative

Full-stack file upload service. TypeScript-first, WinterCG-compatible (Bun + CF Workers).

```bash
bun add uploadthing
```

**Define upload routes:**

```typescript
import { createUploadthing, type FileRouter } from "uploadthing/server";
const f = createUploadthing();

export const uploadRouter = {
  imageUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      const user = await authenticate(req);
      if (!user) throw new Error("Unauthorized");
      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // file.url = CDN URL; save to D1 here
      console.log(`Uploaded: ${file.url} by ${metadata.userId}`);
    }),
} satisfies FileRouter;
```

**Pricing:** Free: 2 GB storage. $10/month: 100 GB. $25/month: 250 GB + usage-based.  
**Env vars:** `UPLOADTHING_TOKEN`  
**Docs:** https://docs.uploadthing.com/

**Tradeoff vs R2:** Much simpler setup but files on UploadThing's CDN (not your R2). Good for prototyping; prefer R2 for production ownership.

---

## 6. Cloudflare Stream — Video

Upload-once, encode-and-serve video via HLS/DASH. Global CDN delivery.

**Pricing:** No free tier. $5/1,000 minutes stored (prepaid) + $1/1,000 minutes delivered.

**Direct Creator Upload (for Manager UI):**

```typescript
// Worker generates a one-time TUS upload URL
const res = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/stream?direct_user=true`,
  {
    method: "POST",
    headers: {
      Authorization:       `Bearer ${env.CF_STREAM_TOKEN}`,
      "Tus-Resumable":     "1.0.0",
      "Upload-Length":     request.headers.get("Upload-Length") ?? "0",
      "Upload-Metadata":   `maxDurationSeconds ${btoa("600")}`,
    },
  }
);
const uploadURL = res.headers.get("location");
const videoId   = res.headers.get("stream-media-id");
return Response.json({ uploadURL, videoId });
```

**Embed in a Flint Static page:**

```html
<!-- Iframe embed (simplest) -->
<iframe src="https://iframe.cloudflarestream.com/VIDEO_ID"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
        allowfullscreen loading="lazy">
</iframe>

<!-- Thumbnail -->
<img src="https://customer-SUBDOMAIN.cloudflarestream.com/VIDEO_ID/thumbnails/thumbnail.jpg?time=5s&width=800"
     loading="lazy">
```

**Env vars:** `CF_ACCOUNT_ID`, `CF_STREAM_TOKEN`, `CF_STREAM_SUBDOMAIN`  
**Docs:** https://developers.cloudflare.com/stream/

---

## Env Vars Summary

```env
# R2 (presigned URL path only — native binding needs no env vars)
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
CF_ACCOUNT_ID=

# Cloudflare Images storage (Mode B — upload to CF Images)
CF_IMAGES_TOKEN=

# UploadThing (if using instead of R2)
UPLOADTHING_TOKEN=

# Cloudflare Stream (video)
CF_STREAM_TOKEN=
CF_STREAM_SUBDOMAIN=    # "customer-xxxx" from stream.cloudflare.com
```

---

## Implementation Plan

### Phase A — Build-time images (no new infrastructure)

1. Add `bun add sharp` to project
2. Create `scripts/optimize-images.ts`
3. Add `"optimize-images": "bun scripts/optimize-images.ts"` to `package.json` scripts
4. Add call at the end of `scripts/build.ts` (or as a pre-build step)
5. Add `static/products/original/.gitkeep` — originals live here, outputs go to `static/products/`
6. Update product content pages to use `<picture>` elements

### Phase B — R2 upload (Manager UI media)

1. Create R2 bucket in Cloudflare dashboard
2. Add R2 binding to `wrangler.toml` for the checkout/media Worker
3. Create D1 `media` table (see schema above)
4. Create `functions/media-handler.ts` — `POST /upload/init` and `POST /upload/complete` routes
5. Create `functions/media-cloudflare.ts` — Workers adapter
6. Add upload UI to Manager (`manager/src/ui/media.ts` + `manager/src/api/media.ts`)
7. Set R2 CORS config for browser direct uploads (via dashboard or API)
8. Attach custom domain to R2 bucket for public CDN URLs
