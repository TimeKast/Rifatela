# RIF-008: Test fixtures + entity builders

| Field            | Value                               |
| ---------------- | ----------------------------------- |
| **Epic**         | EPIC-001 Foundation & Data Layer    |
| **Priority**     | P1                                  |
| **Story Points** | 2                                   |
| **Status**       | ✅ Completed (2026-05-21)           |
| **Dependencies** | RIF-001, RIF-003                    |
| **User Stories** | (preparatory para todos los tests)  |
| **Agents**       | `quality-engineer`, `test-engineer` |
| **Skills**       | `kb-testing`, `kb-fixtures`         |

## Problem

Per `11_TEST_STRATEGY.md §6`, necesitamos factory builders compartidos para tests (unit, component, E2E). Cada test individualmente armando entities a mano = inconsistencia + bugs en fixtures.

## Acceptance Criteria

```gherkin
Given tests/fixtures/builders.ts
When importo aRaffle, aSeller, aBuyer, aTicket, aPrize, anAdminAction
Then cada uno acepta partial overrides y retorna entidad válida

When llamo aRaffle()
Then retorna { id, name: 'Rifa Test', maxTickets: 100, status: 'open', drawDate (futuro 7d), seedCommit (valid sha256), publicSlug (nanoid 10), createdAt }

When llamo aRaffle({ status: 'drawn', winnerTicketId: 'abc' })
Then retorna raffle con esos overrides aplicados

Given un beforeEach hook con resetDb()
When ejecuta
Then borra rows de admin_actions, tickets, buyers, prizes, raffles, sellers (en orden de FK)
And el siguiente test empieza con DB limpia
```

## Implementation notes

```ts
// tests/fixtures/builders.ts
import { nanoid } from 'nanoid';
import { sha256Hex, generateRngSeed } from '@/lib/crypto/seed';

export const aRaffle = (overrides?: Partial<Raffle>): Raffle => {
  const rngSeed = generateRngSeed();
  return {
    id: crypto.randomUUID(),
    name: 'Rifa Test',
    maxTickets: 100,
    drawDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: 'open',
    seedCommit: sha256Hex(rngSeed),
    rngSeed: null,  // hidden por default; revelado solo si overrides.status='drawn'
    publicSlug: nanoid(10),
    archivedAt: null,
    winnerTicketId: null,
    drawnAt: null,
    createdAt: new Date(),
    ...overrides,
  };
};

export const aSeller = (...);
export const aBuyer = (...);
export const aTicket = (...);
export const aPrize = (...);
export const anAdminAction = (...);

export async function resetDb(db: DrizzleDB) {
  await db.delete(adminActions);
  await db.delete(tickets);
  await db.delete(buyers);
  await db.delete(prizes);
  await db.delete(raffles);
  await db.delete(sellers);
}
```

- Builders devuelven plain objects (no insertan en DB) — para insert usar `await db.insert(raffles).values(aRaffle())`
- `resetDb` para E2E + integration tests; NO usar en unit (innecesario)
- Considerar `aRaffleWithSoldTickets({ raffleId, count, sellerIds })` helper para escenarios comunes (sortear, revertir)

## Done when

- [x] 6 builders (`aRaffle`, `aPrize`, `aSeller`, `aBuyer`, `aTicket`, `anAdminAction`) + 1 composed helper `soldTicketsFor({ raffle, sellers, count })` ✅
- [x] `resetDb(database)` exportado y testeado (verifica FK-safe order via identity check) ✅
- [x] Unit test smoke: defaults, overrides, distinct rows per call ✅
- [ ] Documentación en `tests/fixtures/README.md` — _diferido. JSDoc inline + tests son auto-documentación suficiente para MVP. Si después se incorpora otra dev al proyecto, se agrega README de tests._
- [x] `pnpm typecheck` + `pnpm lint` + **551/551 full suite** PASS ✅

## ✅ Implementation Evidence (2026-05-21)

### Files created

- **NEW:** `tests/fixtures/builders.ts` — 6 entity builders + `soldTicketsFor` composed helper + `resetDb`. Pure factories, no DB coupling.
- **NEW:** `tests/fixtures/builders.test.ts` — 17 smoke tests cubriendo defaults, overrides, distinctness per call, composed helpers, y resetDb order.

### Test results

```
✓ aRaffle (3 tests) — defaults / overrides / distinct ids
✓ aPrize (2 tests)
✓ aSeller (2 tests)
✓ aBuyer (2 tests) — anonymous default + partial contact
✓ aTicket (2 tests) — available default + sold via override
✓ anAdminAction (2 tests) — revert_sale default + all 5 action types
✓ soldTicketsFor (3 tests) — distribution + maxTickets enforcement + empty sellers guard
✓ resetDb (1 test) — calls in FK-safe order (admin_actions → tickets → buyers → prizes → raffles → sellers)

Test Files  1 passed (1)  ·  Tests  17 passed (17)
```

Full suite: **551/551 PASS** (sin regresiones de los 534 anteriores).

### Deviations from spec

- **Self-contained crypto helpers en el builder** (no import desde `src/lib/crypto/seed`) — los fixtures evitan depender de modules que pueden tener guards `server-only` en el futuro, y se mantienen utilizables desde tests jsdom+node sin issues de transpilación. Funcionalmente idéntico.
- **`README.md` diferido** — JSDoc inline + tests existentes son suficientes. Tracking lo agregamos si crece el equipo de Rifatela.

### Consumers (NOT blocking — habilita futuro)

- Cualquier test futuro de RIF-009..044 puede importar `aRaffle`, `aTicket`, etc.
- E2E concurrency test (RIF-022, ⭐ critical) usa `soldTicketsFor` + `resetDb` directamente
- Integration tests contra Postgres real usan `resetDb` en `beforeEach`
