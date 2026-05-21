# RIF-008: Test fixtures + entity builders

| Field            | Value                               |
| ---------------- | ----------------------------------- |
| **Epic**         | EPIC-001 Foundation & Data Layer    |
| **Priority**     | P1                                  |
| **Story Points** | 2                                   |
| **Status**       | To Do                               |
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

- [ ] 6 builders + 1-2 composed helpers
- [ ] `resetDb()` exportado y testeado
- [ ] Unit test smoke: `aRaffle().name === 'Rifa Test'` y override funciona
- [ ] Documentación en `tests/fixtures/README.md` con ejemplos de uso
- [ ] `pnpm verify` pasa
