# RIF-005: Vercel Blob upload integration

| Field               | Value                                    |
| ------------------- | ---------------------------------------- |
| **Epic**            | EPIC-001 Foundation & Data Layer         |
| **Priority**        | P0                                       |
| **Story Points**    | 3                                        |
| **Status**          | To Do                                    |
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

- [ ] Helper en `src/lib/storage/prize-upload.ts`
- [ ] Unit test: valid file → upload + URL retornada
- [ ] Unit test: SVG → invalid_image_type
- [ ] Unit test: 10MB → image_too_large
- [ ] Unit test: filename mal intencionado → ignorado, usa nombre derivado
- [ ] Test manual contra Vercel Blob staging (single roundtrip)
