# RIF-028: `verifyDraw` SHA-256 Web Crypto + unit tests

| Field              | Value                                     |
| ------------------ | ----------------------------------------- |
| **Epic**           | EPIC-003 Public View & Draw               |
| **Priority**       | P0                                        |
| **Story Points**   | 2                                         |
| **Dependencies**   | RIF-003                                   |
| **User Stories**   | US-025                                    |
| **Features**       | FT-013                                    |
| **Business Rules** | BR-006 (commit-reveal)                    |
| **Agents**         | `frontend-specialist`, `security-auditor` |
| **Skills**         | `kb-web-crypto`                           |

## Problem

Función client-side que el visitante usa para verificar el commit. Recalcula `sha256(rngSeed)` con Web Crypto API y compara con `seedCommit` publicado. Si matchea → trust validado.

## Acceptance Criteria

```gherkin
Given seedCommit y rngSeed donde sha256(rngSeed) === seedCommit
When invoke verifyDraw(seedCommit, rngSeed) en browser
Then retorna { valid: true, computedHash: seedCommit }

Given seedCommit y rngSeed donde sha256(rngSeed) !== seedCommit (tamper)
When invoke
Then retorna { valid: false, computedHash: <hash calculado> }

Given función debe correr 100% en cliente (Web Crypto API)
When invoke
Then NO requiere fetch ni server roundtrip
And usa crypto.subtle.digest('SHA-256', ...)

Given unit test con seed/commit conocidos
When ejecuto
Then assertions sobre valid + computedHash match esperado

Given cross-browser test (Chrome, Safari, Firefox)
When ejecuto el flujo
Then Web Crypto disponible en los 3 (es estándar moderno)
```

## Implementation notes

```ts
// src/lib/draw/verifyDraw.ts
// Client-side function — usable desde RSC también si se ejecuta server-side (Node 19+ tiene Web Crypto)

export async function verifyDraw(
  publishedSeedCommit: string,
  revealedSeed: string
): Promise<{ valid: boolean; computedHash: string }> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(revealedSeed));
  const computedHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return {
    valid: computedHash === publishedSeedCommit,
    computedHash,
  };
}
```

- Web Crypto API es estándar y disponible en todos los browsers modernos + Node 19+
- Uso `TextEncoder` para UTF-8 encoding (crítico para consistency con server)
- Hex output debe ser lowercase (consistency con `sha256Hex` del RIF-003)

## Done when

- [ ] Function exportada
- [ ] Unit tests: matching + non-matching + edge cases (empty seed, etc.)
- [ ] Cross-runtime test: client (jsdom) y server (Node) producen mismo hash
- [ ] `pnpm verify` pasa
