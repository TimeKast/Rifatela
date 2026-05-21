# RIF-029: Server action `executeDraw` (BR-005, BR-006)

| Field              | Value                              |
| ------------------ | ---------------------------------- |
| **Epic**           | EPIC-003 Public View & Draw        |
| **Priority**       | P0                                 |
| **Story Points**   | 5                                  |
| **Dependencies**   | RIF-001, RIF-027 (seedToWinner)    |
| **User Stories**   | US-016, US-017                     |
| **Features**       | FT-008                             |
| **Business Rules** | **BR-004, BR-005, BR-006, BR-010** |
| **ADR**            | ADR-002 (Replay + Commit-Reveal)   |
| **Agents**         | `backend-specialist`, `architect`  |
| **Skills**         | `kb-server-actions`                |
| **API Contract**   | `executeDraw(input)` doc 08        |

## Problem

Server action admin-only que ejecuta el sorteo. Valida preconditions (BR-005), invoca `seedToWinner` con datos de DB, revela `rngSeed` en el UPDATE, persiste `winnerTicketId` + `drawnAt` + `status='drawn'`. Atomic single-statement.

## Acceptance Criteria

```gherkin
Given raffle status='open', draw_date <= now(), 5 tickets vendidos
When admin invoca executeDraw({ raffleId })
Then:
  - Server lee rngSeed de DB (interno, no se expone hasta este momento)
  - Lee soldTicketIds ORDER BY number ASC
  - Invoca seedToWinner(rngSeed, soldTicketIds)
  - Atomic UPDATE: SET status='drawn', winnerTicketId, drawnAt=NOW() WHERE id=? AND status='open'
  - Si rowCount==1 → response incluye winnerTicketId, winnerNumber, winnerBuyer (nombre completo), rngSeed (revelado), drawnAt
  - Si rowCount==0 → fail('already_drawn')
And revalidatePath('/admin', '/r/{publicSlug}')

Given draw_date NO llegado
When invoco executeDraw
Then fail('draw_date_not_reached')

Given 0 tickets vendidos
When invoco
Then fail('no_tickets_sold')

Given status='drawn' ya
When invoco
Then fail('already_drawn')

Given caller no admin
When invoco
Then fail('forbidden')

Given unit test con seed mockeable
When ejecuto la action sobre una rifa con 5 tickets vendidos
Then winnerTicketId == seedToWinner(seed, soldTicketIds).winnerTicketId
And rng_seed YES en la response (revealed)

Given E2E-003 corre
When admin ejecuta sorteo + visitante verifica
Then ✅ sha256(rng_seed) === seed_commit (commit-reveal valid)
```

## Implementation notes

```ts
// src/lib/actions/raffles/execute-draw.ts
import { seedToWinner } from '@/lib/draw/seedToWinner';

export const executeDraw = (input: unknown) =>
  withAuth(
    { resource: 'raffles', action: 'draw', schema: ExecuteDrawSchema, revalidate: '/admin' },
    input,
    async (data) => {
      // 1. Read raffle (need rng_seed, status, draw_date)
      const raffle = await db.query.raffles.findFirst({ where: eq(raffles.id, data.raffleId) });
      if (!raffle) return fail('not_found');
      if (raffle.status === 'drawn') return fail('already_drawn');
      if (raffle.status !== 'open') return fail('raffle_immutable');
      if (raffle.drawDate > new Date()) return fail('draw_date_not_reached');

      // 2. Read sold tickets ORDER BY number (BR-004)
      const sold = await db.query.tickets.findMany({
        where: and(eq(tickets.raffleId, data.raffleId), eq(tickets.status, 'sold')),
        orderBy: asc(tickets.number),
        with: { buyer: true },
      });
      if (sold.length === 0) return fail('no_tickets_sold');

      // 3. Compute winner
      const { winnerTicketId } = seedToWinner(
        raffle.rngSeed!,
        sold.map((t) => t.id)
      );
      const winner = sold.find((t) => t.id === winnerTicketId)!;

      // 4. ATOMIC UPDATE (defensive against re-execution)
      const updated = await db
        .update(raffles)
        .set({ status: 'drawn', winnerTicketId, drawnAt: new Date() })
        .where(and(eq(raffles.id, raffle.id), eq(raffles.status, 'open')))
        .returning();
      if (updated.length === 0) return fail('already_drawn');

      revalidatePath(`/r/${raffle.publicSlug}`);

      return {
        winnerTicketId,
        winnerNumber: winner.number,
        winnerBuyer: { id: winner.buyer!.id, name: winner.buyer!.name },
        rngSeed: raffle.rngSeed, // ← revealed in this response
        drawnAt: updated[0].drawnAt,
      };
    }
  );
```

- ⚠️ `rngSeed` se incluye en response **solo en este momento** (al sortear). Lecturas posteriores (vía RSC pages) lo retornan también porque `status='drawn'`.
- Atomic UPDATE protege contra doble-ejecución concurrent (improbable pero defensive — BR-005)

## Done when

- [ ] Action implementada con todas las preconditions
- [ ] Unit tests: cada precondition path + happy path
- [ ] Unit test: rng_seed expuesto solo en response post-sorteo
- [ ] E2E-003 cubre flow end-to-end
- [ ] Code review by architect (ADR-002 compliance)
- [ ] `pnpm verify` pasa
