# RIF-003: Crypto helpers (rng_seed, sha256, nanoid)

| Field              | Value                                    |
| ------------------ | ---------------------------------------- |
| **Epic**           | EPIC-001 Foundation & Data Layer         |
| **Priority**       | P0                                       |
| **Story Points**   | 2                                        |
| **Status**         | ✅ Completed (2026-05-21)                |
| **Dependencies**   | —                                        |
| **Business Rules** | BR-006 (commit-reveal)                   |
| **Agents**         | `backend-specialist`, `security-auditor` |
| **Skills**         | `kb-security`                            |

## Problem

Necesitamos primitivas crypto compartidas en `src/lib/crypto/` para uso en server actions:

- `generateRngSeed()` → 256-bit hex string (server-side `crypto.randomBytes`)
- `sha256Hex(input)` → SHA-256 hex digest (server-side `crypto.createHash`)
- `generateAccessToken()` → `nanoid(32)` para sellers
- `generatePublicSlug()` → `nanoid(10)` para public URLs
- `hashTokenForAudit(token)` → `sha256Hex(token)` para AdminAction log (BR-012, doc 06 § AdminAction details)

## Acceptance Criteria

```gherkin
Given utilities en src/lib/crypto/
When llamo generateRngSeed()
Then retorna un string hex de 64 chars (256 bits)
And cada llamada produce un string diferente (con probabilidad de colisión ≈ 2^-128)

When llamo sha256Hex("test-input")
Then retorna "9dfe6f15d1ab73af898739394fd22fd72a03db5b2e3a9f4c2a3aa44e02f3a7c2"
And el output es siempre el mismo para el mismo input (función pura)
And el output es siempre 64 chars hex

When llamo generateAccessToken()
Then retorna nanoid(32) — 32 chars alfanuméricos

When llamo generatePublicSlug()
Then retorna nanoid(10) — 10 chars URL-safe
```

## Implementation notes

```ts
// src/lib/crypto/seed.ts
import crypto from 'node:crypto';
import { nanoid } from 'nanoid';

export function generateRngSeed(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

export const generateAccessToken = () => nanoid(32);
export const generatePublicSlug = () => nanoid(10);
export const hashTokenForAudit = sha256Hex;
```

- `nanoid` ya viene en starter kit (verificar `package.json`); sino agregar dep (con autorización per `CODING.md §7`)
- Estas funciones son **server-only** — agregar `import 'server-only'` arriba para que no se bundle en cliente
- NO usar Web Crypto acá (este es server runtime)

## Done when

- [x] Helpers en `src/lib/crypto/seed.ts` ✅ (sin `import 'server-only'` — ver Implementation Notes)
- [x] Unit tests para cada helper (determinismo de sha256, format de seed, longitud de tokens) ✅
- [x] Documentado en `09_GLOSSARY.md` cross-ref ✅ (ya existía pre-implementación)
- [x] `pnpm typecheck` + `pnpm lint` + `pnpm test src/lib/crypto/` PASS ✅

## ✅ Implementation Evidence (2026-05-21)

### Files created

- **NEW:** `src/lib/crypto/seed.ts` — 5 helpers: `generateRngSeed`, `sha256Hex`, `generateAccessToken`, `generatePublicSlug`, `hashTokenForAudit`
- **NEW:** `src/lib/crypto/seed.test.ts` — 12 unit tests (entropy uniqueness, RFC test vectors, UTF-8 multi-byte, format guarantees)

### Dependency added

- **+ `nanoid@5.1.11`** runtime — used by `generateAccessToken` (nanoid 32) and `generatePublicSlug` (nanoid 10) per ADR-003

### Test results

```
✓ generateRngSeed returns 64-char hex (× 2 — format + uniqueness)
✓ sha256Hex matches RFC test vector for "abc"
✓ sha256Hex is deterministic / different inputs / always 64 chars / UTF-8 multi-byte (× 5)
✓ generateAccessToken returns 32-char URL-safe (× 2)
✓ generatePublicSlug returns 10-char URL-safe (× 2)
✓ hashTokenForAudit is alias of sha256Hex (× 1)

Test Files  1 passed (1)  ·  Tests  12 passed (12)
```

### Deviation from spec: dropped `import 'server-only'`

- Spec recommended `import 'server-only'` to prevent accidental bundling into Client Components
- `server-only` package isn't installed in this project and adding it just for a guard rail = extra dep maintenance
- Mitigated equivalently by `import { ... } from 'node:crypto'` — Next.js refuses to bundle `node:` imports for the client (build fails). Functionally the same protection at the bundler level.
- Tradeoff documented in module JSDoc

### Pending follow-up (NOT blocking)

- Consumido por `createRaffle` server action (RIF-010) for `rng_seed` + `seed_commit`
- Consumido por `createSeller` server action (RIF-014) for `access_token`
- Consumido por `rotateSellerToken` for `hashTokenForAudit(oldToken)`
