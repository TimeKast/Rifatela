# RIF-002: Bulk insert N tickets on raffle creation

| Field              | Value                            |
| ------------------ | -------------------------------- |
| **Epic**           | EPIC-001 Foundation & Data Layer |
| **Priority**       | P0                               |
| **Story Points**   | 3                                |
| **Status**         | To Do                            |
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

- [ ] Function exportada desde `src/lib/raffles/bulk-tickets.ts`
- [ ] Unit test con maxTickets = 1, 100, 10000
- [ ] Unit test con maxTickets = 0 → error
- [ ] Unit test con maxTickets = 10001 → error
- [ ] `pnpm verify` pasa
