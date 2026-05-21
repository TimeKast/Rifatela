# RIF-022: E2E-002b concurrency race test ⭐ CRITICAL (CI GATE)

| Field               | Value                               |
| ------------------- | ----------------------------------- |
| **Epic**            | EPIC-002 Core Loop                  |
| **Priority**        | **P0 — CRITICAL**                   |
| **Story Points**    | 5                                   |
| **Dependencies**    | RIF-021, RIF-008                    |
| **User Stories**    | US-012                              |
| **Features**        | FT-006                              |
| **Business Rules**  | **BR-001, BR-002**                  |
| **Risks mitigated** | **RSK-001 — Doble venta**           |
| **E2E ID**          | **E2E-002b** (doc 12)               |
| **Agents**          | `quality-engineer`, `test-engineer` |
| **Skills**          | `kb-e2e`, `kb-playwright`           |

## Problem

Test E2E con concurrencia real que valida el invariant central "zero doble-venta" (BR-001 + BR-002). Si este test no existe o no pasa, el producto no debe desplegarse. Es la **joya de la corona** del test suite (per doc 11 §4).

## Acceptance Criteria

```gherkin
Given un raffle creado con maxTickets=1 (1 solo ticket disponible)
And 2 vendedores activos: Diego (sellerA), María (sellerB)
And 2 buyers creados (uno por vendedor): Buyer A, Buyer B
When ambos vendedores hacen Promise.all sobre claimTicket({ ticketId: T1, buyerId: ... }) al MISMO momento
Then:
  - Exactamente 1 promesa resuelve con { ok: true, data: { ticket: ... } }
  - La otra promesa resuelve con { ok: false, code: 'ticket_already_sold' }
  - DB: count(tickets WHERE number=1 AND status='sold' AND raffle_id=R) == 1 (NO 2)
  - DB: count(tickets WHERE number=1 AND buyer_id NOT NULL) == 1
  - DB: count(buyers) == 2 (ambos buyers persisten, no se borraron)

Given el test corre en CI
When falla
Then el deploy queda BLOQUEADO automáticamente

Given el test corre 100 veces consecutivamente
When mido la flakiness
Then 100% de los runs pasan (no es flaky test)
```

## Implementation notes

```ts
// tests/e2e/concurrency.spec.ts
import { test, expect } from '@playwright/test';
import { resetDb, aRaffle, aSeller, aBuyer } from '../fixtures/builders';

test.describe('@critical — BR-002 concurrency', () => {
  test('E2E-002b: dos vendedores tocan el mismo ticket', async ({ browser }) => {
    await resetDb(db);

    // Setup: 1 raffle con 1 ticket, 2 vendedores
    const raffle = await db
      .insert(raffles)
      .values(aRaffle({ maxTickets: 1 }))
      .returning();
    await bulkInsertTicketsForRaffle(db, raffle[0].id, 1);
    const ticket = (await db.select().from(tickets).where(eq(tickets.raffleId, raffle[0].id)))[0];
    const [sellerA, sellerB] = await db
      .insert(sellers)
      .values([aSeller({ name: 'Diego' }), aSeller({ name: 'María' })])
      .returning();

    // 2 buyers separados
    const [buyerA, buyerB] = await db
      .insert(buyers)
      .values([aBuyer({ name: 'A' }), aBuyer({ name: 'B' })])
      .returning();

    // Concurrent claim
    const [resA, resB] = await Promise.all([
      claimTicket({ sellerToken: sellerA.accessToken, ticketId: ticket.id, buyerId: buyerA.id }),
      claimTicket({ sellerToken: sellerB.accessToken, ticketId: ticket.id, buyerId: buyerB.id }),
    ]);

    // Exactly one succeeds
    const successes = [resA, resB].filter((r) => r.ok);
    const failures = [resA, resB].filter((r) => !r.ok);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0].code).toBe('ticket_already_sold');

    // DB invariants
    const finalTicket = await db.query.tickets.findFirst({ where: eq(tickets.id, ticket.id) });
    expect(finalTicket?.status).toBe('sold');
    expect(finalTicket?.buyerId).toBeTruthy(); // uno solo ganó
  });
});
```

- Test runner: Playwright (E2E suite) o Vitest integration test (más rápido, depende del setup)
- Test paralelo: usar `Promise.all` real, no `await ... ; await ...`
- Setup robusto: `resetDb` antes de cada test
- Skip en CI si DB no está disponible es **PROHIBIDO** — fix CI no skip
- Test debe correr en cada PR (CI gate)

### Variante UI (Playwright pure)

También considerar variante con 2 browser contexts haciendo clicks reales (per doc 12 E2E-002b). Pero la integración action-level es más rápida y suficiente como gate.

## Done when

- [ ] Test escrito y pasa local
- [ ] CI config: este test corre en cada PR como bloqueante
- [ ] Test pasa 100 runs consecutivos sin flakiness
- [ ] Code review by quality-engineer + architect
- [ ] Tag `@critical` en Playwright config
