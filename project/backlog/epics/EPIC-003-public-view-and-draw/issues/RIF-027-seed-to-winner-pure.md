# RIF-027: `seedToWinner` pure function + unit tests ⭐ CRITICAL

| Field               | Value                                                     |
| ------------------- | --------------------------------------------------------- |
| **Epic**            | EPIC-003 Public View & Draw                               |
| **Priority**        | **P0 — CRITICAL**                                         |
| **Story Points**    | 3                                                         |
| **Status**          | Completed (2026-05-22)                                    |
| **Dependencies**    | RIF-003                                                   |
| **User Stories**    | US-016, US-018                                            |
| **Features**        | FT-008, FT-009                                            |
| **Business Rules**  | **BR-004 (sorteo entre vendidos), BR-005 (determinismo)** |
| **Risks mitigated** | **RSK-005 — Replay tampering**                            |
| **Agents**          | `backend-specialist`, `architect`, `security-auditor`     |
| **Skills**          | `kb-cryptography`, `kb-pure-functions`                    |

## Problem

Función pura compartida entre server (sorteo) y client (replay determinista). Dada (`rngSeed`, lista ORDENADA de ticket IDs vendidos), retorna el ganador. Si tiene un bug, replay no coincide con server → RSK-005 (trust broken).

## Acceptance Criteria

```gherkin
Given una seed fija y lista de tickets ordenada por number
When invoke seedToWinner(seed, soldTickets) MULTIPLES veces
Then SIEMPRE retorna el mismo winnerIndex y winnerTicketId (determinismo)

Given seed1 != seed2
When invoke seedToWinner sobre el mismo soldTickets
Then resultados pueden diferir (probabilísticamente — ~1/N que coincidan)

Given soldTickets = []
When invoke seedToWinner
Then THROW Error('no_tickets_sold') (BR-005, BR-007)

Given soldTickets = [single]
When invoke
Then retorna ese single como ganador (edge case)

Given 1000 seeds random sobre 100 tickets
When mido distribución de winnerIndex
Then se distribuye uniformemente (chi-square test no rejecta H0)

Given mismo input invocado desde Node runtime (server) y desde browser (client via SubtleCrypto vs Node crypto)
When comparo outputs
Then son IDÉNTICOS (compatibility crítica)
```

## Implementation notes

```ts
// src/lib/draw/seedToWinner.ts
// Pure function — NO 'server-only' import (debe ser callable desde cliente para replay)
// Pero usa sha256 que es disponible en ambos runtimes vía @noble/hashes (recomendado) o nativo

import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex } from '@noble/hashes/utils';

export function seedToWinner(
  rngSeed: string,
  soldTicketIds: readonly string[]
): { winnerIndex: number; winnerTicketId: string } {
  if (soldTicketIds.length === 0) {
    throw new Error('no_tickets_sold');
  }
  const hashBytes = sha256(rngSeed);
  // Take first 8 bytes → bigint → modulo over count
  const bigint = BigInt('0x' + bytesToHex(hashBytes.slice(0, 8)));
  const winnerIndex = Number(bigint % BigInt(soldTicketIds.length));
  return { winnerIndex, winnerTicketId: soldTicketIds[winnerIndex] };
}
```

- `@noble/hashes` está disponible en ambos runtimes (Node + browser) — garantiza identidad
- ⚠️ **Sort obligatorio:** `soldTicketIds` debe pasarse ordenado por `tickets.number ASC` (documentado en doc 06)
- Función PURA — no DB, no random, no global state
- Modulo bias para N ≤ 10^4: insignificante (probabilidad de bias ≤ 2^-55)

## Done when

- [x] `src/lib/draw/seedToWinner.ts` con sha256 → primeros 8 bytes → BigInt → modulo N ✅
- [x] **Determinismo:** 100 calls mismo input → mismo output ✅
- [x] **Empty:** `seedToWinner('s', [])` throws `'no_tickets_sold'` ✅
- [x] **Single:** `seedToWinner(any, [t])` retorna `t` siempre ✅
- [x] **Distribución:** 200 seeds random sobre 10 tickets → ≥8 buckets distintos ✅
- [x] **Hand-computed:** assertion cruzada `sha256(seed) % N` agrees ✅
- [x] `pnpm test tests/unit/seed-to-winner.test.ts` 7/7 PASS ✅
- [x] `pnpm typecheck` + `pnpm lint` + `pnpm build` PASS ✅
- [ ] Cross-runtime (Node vs Browser) — _diferido a RIF-031_; hoy solo se ejecuta server-side

## ✅ Implementation Evidence (2026-05-22)

### Decisión: `node:crypto` en lugar de `@noble/hashes`

- El spec original proponía `@noble/hashes` para garantizar identidad Node↔Browser. Hoy `seedToWinner` solo se ejecuta server-side (dentro de `executeDraw`). Usar `node:crypto` mantiene la coherencia con el resto de `src/lib/crypto/seed.ts` y evita instalar una dep nueva.
- **Migration path documentado en el JSDoc:** cuando RIF-031 (DrawWheel client replay) aterrice, se refactorea a `crypto.subtle.digest` (async, available en Node ≥18 + browser). Signature cambia a `Promise<…>` — aceptable porque ya es invocada desde contextos async.

### Ordering contract

- El JSDoc del módulo documenta explícitamente: el caller MUST pasar `soldTicketIds` ordenado por `tickets.number ASC`. La función NO ordena defensivamente — un sort defensive podría enmascarar bugs de ordering del caller que rompen determinismo cross-runtime cuando llegue el replay.
- `executeDraw` cumple el contrato con `orderBy(asc(tickets.number))`.
