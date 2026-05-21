# RIF-005: Vercel Blob upload integration

| Field               | Value                                    |
| ------------------- | ---------------------------------------- |
| **Epic**            | EPIC-001 Foundation & Data Layer         |
| **Priority**        | P0                                       |
| **Story Points**    | 3                                        |
| **Status**          | ✅ Completed (2026-05-21)                |
| **Dependencies**    | —                                        |
| **User Stories**    | (preparatory para US-002)                |
| **Risks mitigated** | RSK-004 (image upload malicious)         |
| **Agents**          | `backend-specialist`, `security-auditor` |
| **Skills**          | `kb-storage`                             |

## Problem

Necesitamos endpoint helper para subir imagen del premio (`Prize.imageUrl`) a Vercel Blob. Debe validar MIME + size + sanitizar filename para mitigar upload abuse (RSK-004).

## Acceptance Criteria

```gherkin
Given un File válido (JPG/PNG/WebP, <5MB)
When invoco uploadPrizeImage(file, raffleId)
Then se sube a Vercel Blob con filename "prizes/{raffleId}-{nanoid(8)}.{ext}"
And retorna { url: string } public

Given un File de tipo image/svg+xml o application/pdf
When invoco la función
Then falla con validation error 'invalid_image_type' (sin tocar Blob)

Given un File de 10MB
When invoco la función
Then falla con 'image_too_large' (sin tocar Blob)

Given un File con nombre "../../../etc/passwd.jpg"
When invoco la función
Then el filename persisted es "prizes/{raffleId}-{nanoid}.jpg" (NO el path original)
```

## Implementation notes

```ts
// src/lib/storage/prize-upload.ts
import { put } from '@vercel/blob';
import { nanoid } from 'nanoid';

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function uploadPrizeImage(file: File, raffleId: string): Promise<{ url: string }> {
  if (!ALLOWED_MIMES.has(file.type)) throw new ValidationError('invalid_image_type');
  if (file.size > MAX_SIZE_BYTES) throw new ValidationError('image_too_large');
  const filename = `prizes/${raffleId}-${nanoid(8)}.${EXT_BY_MIME[file.type]}`;
  const blob = await put(filename, file, { access: 'public' });
  return { url: blob.url };
}
```

- `BLOB_READ_WRITE_TOKEN` env var debe existir en Vercel (no hace falta scaffold local — funciona contra prod blob)
- Sanitización: nombre derivado de raffleId + nanoid, ignora `file.name` completamente
- NO permitir SVG (potencial XSS via script tags embedded)
- Considerar CSP `img-src` policy en doc 07 (ya documentado)

## Done when

- [x] Helper en `src/lib/storage/prize-upload.ts` ✅
- [x] Unit test: valid file → upload + URL retornada ✅
- [x] Unit test: SVG → invalid_image_type ✅
- [x] Unit test: 10MB (MAX+1) → image_too_large ✅
- [x] Unit test: filename mal intencionado → ignorado, usa nombre derivado ✅
- [x] `pnpm typecheck` + `pnpm lint` + 9/9 tests PASS ✅
- [ ] Test manual contra Vercel Blob real — _pendiente cuando se configure `BLOB_READ_WRITE_TOKEN` en Railway_

## ✅ Implementation Evidence (2026-05-21)

### Files created

- **NEW:** `src/lib/storage/prize-upload.ts` — `uploadPrizeImage(file, raffleId)` + `PrizeImageUploadError` (con discriminated `code: 'invalid_image_type' | 'image_too_large' | 'upload_failed'`) + `MAX_PRIZE_IMAGE_BYTES` constant (exportada para usar en form Zod schemas client-side).
- **NEW:** `src/lib/storage/prize-upload.test.ts` — 9 unit tests con mock de `@vercel/blob` `put()`.

### Dependency added

- **+ `@vercel/blob@2.4.0`** runtime — Vercel Blob es accessible desde cualquier host (Railway incluido) vía API token

### Setup operacional pendiente (NO blocker — solo necesario en deploy)

- `BLOB_READ_WRITE_TOKEN` env var en Railway. Para obtenerlo:
  1. Vercel Dashboard (cualquier cuenta) → Create Project (puede ser dummy)
  2. Storage → Create → Blob → New Store
  3. Copy `BLOB_READ_WRITE_TOKEN` del store
  4. Pegar en Railway → Service → Variables
- Sin el token, `put()` falla → wrapper devuelve `upload_failed`. Tests no requieren el token (mock).

### Test results

```
✓ uploads a valid JPEG and returns the public URL
✓ uses .png extension for PNG files
✓ uses .webp extension for WebP files
✓ throws invalid_image_type for SVG (anti-XSS guard) and does NOT call put()
✓ throws invalid_image_type for PDF and does NOT call put()
✓ throws image_too_large at exactly MAX+1 bytes
✓ accepts a file at exactly MAX bytes (boundary)
✓ ignores user-supplied filename — derives a safe one from raffleId + nanoid
✓ wraps upstream put() errors as PrizeImageUploadError("upload_failed")

Test Files  1 passed (1)  ·  Tests  9 passed (9)
```

### Deviation from spec

- Spec dijo "throw ValidationError" — usé clase custom `PrizeImageUploadError` con discriminated `code` field. Más útil para callers: pueden hacer `if (err.code === 'image_too_large')` en lugar de parsear strings.
- Spec dijo Vercel Blob como dep — confirmado y agregado. Decisión del usuario sobre R2 vs Vercel Blob → Vercel Blob.

### Security mitigations (RSK-004)

- ✅ MIME allowlist tight (jpeg/png/webp; sin SVG, sin polyglots)
- ✅ Hard size cap 5MB
- ✅ Filename 100% server-derived (`prizes/{raffleId}-{nanoid(8)}.{ext}`)
- ✅ User-supplied `file.name` ignorado
- ✅ Path traversal sanitization implicit (no concatena nombre raw del user)

### Pending follow-up (NOT blocking)

- Consumido por `createRaffle` server action (RIF-010, EPIC-002)
- CSP `img-src` policy con `*.public.blob.vercel-storage.com` allowlist — RIF-007 middleware
