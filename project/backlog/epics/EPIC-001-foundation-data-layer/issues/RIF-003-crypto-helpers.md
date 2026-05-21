# RIF-003: Crypto helpers (rng_seed, sha256, nanoid)

| Field              | Value                                    |
| ------------------ | ---------------------------------------- |
| **Epic**           | EPIC-001 Foundation & Data Layer         |
| **Priority**       | P0                                       |
| **Story Points**   | 2                                        |
| **Status**         | To Do                                    |
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

- [ ] Helpers en `src/lib/crypto/seed.ts` con `import 'server-only'`
- [ ] Unit tests para cada helper (determinismo de sha256, format de seed, longitud de tokens)
- [ ] Documentado en `09_GLOSSARY.md` cross-ref (ya existe)
- [ ] `pnpm verify` pasa
