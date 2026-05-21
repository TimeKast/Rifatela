# RIF-002: Bulk insert N tickets on raffle creation

| Field              | Value                            |
| ------------------ | -------------------------------- |
| **Epic**           | EPIC-001 Foundation & Data Layer |
| **Priority**       | P0                               |
| **Story Points**   | 3                                |
| **Status**         | ✅ Completed (2026-05-21)        |
| **Dependencies**   | RIF-001                          |
| **User Stories**   | (preparatory para US-001)        |
| **Business Rules** | BR-001 (uniqueness)              |
| **Agents**         | `backend-specialist`             |
| **Skills**         | `sk-db`, `kb-drizzle`            |

## Problem

Al crear una rifa con `max_tickets=N`, hay que insertar N rows en `tickets` con `status='available'` y numbers `1..N`. Single-row inserts en loop sería ineficiente; usamos bulk insert. Esto es helper que será consumido por la server action `createRaffle` (RIF-010).

## Acceptance Criteria

```gherkin
Given una rifa recién creada con id=R y max_tickets=100
When invoco bulkInsertTicketsForRaffle(R, 100)
Then se insertan 100 tickets en una sola query
And cada ticket tiene raffle_id=R, status='available', buyer_id=null, seller_id=null
And los numbers van de 1 a 100 consecutivos
And la unique constraint (raffle_id, number) no se viola

Given max_tickets > 10000
When invoco la función
Then falla con validation error (límite MVP)

Given max_tickets <= 0
When invoco la función
Then falla con validation error
```

## Implementation notes

```ts
// src/lib/raffles/bulk-tickets.ts
export async function bulkInsertTicketsForRaffle(
  db: DrizzleDB,
  raffleId: string,
  maxTickets: number
): Promise<void> {
  if (maxTickets < 1 || maxTickets > 10_000) {
    throw new ValidationError('max_tickets out of range');
  }
  const rows = Array.from({ length: maxTickets }, (_, i) => ({
    raffleId,
    number: i + 1,
    status: 'available' as const,
  }));
  await db.insert(tickets).values(rows);
}
```

- Postgres soporta bulk insert nativo, sin batch necesario para N≤10k
- Test: assertion sobre count + uniqueness post-insert

## Done when

- [x] Function exportada desde `src/lib/raffles/bulk-tickets.ts` ✅
- [x] Unit test con maxTickets = 1, 100, 10000 ✅
- [x] Unit test con maxTickets = 0 → error ✅
- [x] Unit test con maxTickets = 10001 → error ✅
- [x] `pnpm typecheck` + `pnpm lint` + `pnpm test src/lib/raffles/` PASS ✅

## ✅ Implementation Evidence (2026-05-21)

### Files created

- **NEW:** `src/lib/raffles/bulk-tickets.ts` — `bulkInsertTicketsForRaffle(database, raffleId, maxTickets)`. Single-statement bulk INSERT. Throws built-in `RangeError` cuando `maxTickets` está fuera de `[1, 10000]` o no es integer.
- **NEW:** `src/lib/raffles/bulk-tickets.test.ts` — 7 unit tests con mock DB chainable.

### Test results

```
✓ inserts 1 ticket with number=1 and status=available
✓ inserts 100 tickets with consecutive numbers 1..100
✓ inserts 10000 tickets at the upper bound
✓ throws RangeError when maxTickets is 0 and does NOT touch the DB
✓ throws RangeError when maxTickets is 10001 (above upper bound)
✓ throws RangeError when maxTickets is negative
✓ throws RangeError when maxTickets is a float (non-integer)

Test Files  1 passed (1)  ·  Tests  7 passed (7)
```

### Deviations from spec

- Built-in `RangeError` en lugar de `ValidationError` custom — API tighter, semántico correcto. Server actions futuras envuelven en su error envelope per `08_API_CONTRACTS.md`.
- Defensa extra: rechaza no-integer (float) además de range — `Number.isInteger()` check.

### Pending follow-up (NOT blocking)

- Consumido por `createRaffle` server action (RIF-010, EPIC-002)
- Integration test contra Postgres real diferido a RIF-008 (test fixtures + DB seeds)
