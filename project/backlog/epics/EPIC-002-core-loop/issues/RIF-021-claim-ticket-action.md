# RIF-021: Server action `claimTicket` ⭐ CRITICAL (BR-002)

| Field               | Value                                                 |
| ------------------- | ----------------------------------------------------- |
| **Epic**            | EPIC-002 Core Loop                                    |
| **Priority**        | **P0 — CRITICAL**                                     |
| **Story Points**    | 5                                                     |
| **Dependencies**    | RIF-001, RIF-004                                      |
| **User Stories**    | US-010, US-012                                        |
| **Features**        | FT-005, FT-006                                        |
| **Business Rules**  | **BR-001, BR-002** (atomic conditional UPDATE)        |
| **ADR**             | **ADR-001 — Concurrency model**                       |
| **Risks mitigated** | **RSK-001 — Doble venta**                             |
| **Agents**          | `backend-specialist`, `security-auditor`, `architect` |
| **Skills**          | `kb-server-actions`, `kb-concurrency`                 |
| **API Contract**    | `claimTicket(input)` doc 08                           |

## Problem

La server action más crítica del producto. Implementa el invariant central "zero doble-venta" via atomic conditional UPDATE single-statement. Si esta action tiene un bug, el producto entero pierde credibilidad.

## Acceptance Criteria

```gherkin
Given un ticket con id=T y status='available', raffle status='open'
When un vendedor invoca claimTicket({ sellerToken, ticketId: T, buyerId: B })
Then ejecuta el SINGLE-STATEMENT atomic UPDATE:
  UPDATE tickets
     SET status='sold', buyer_id=B, seller_id=S, sold_at=NOW()
   WHERE id=T AND status='available'
   RETURNING *
And si rowCount==1: retorna { ok: true, data: { ticket, ticketDigitalUrl } }
And si rowCount==0: retorna { ok: false, code: 'ticket_already_sold' }
And NUNCA hay SELECT antes del UPDATE (race condition)
And NUNCA hay TX explícita (Neon HTTP driver constraint)

Given el raffle pasó a status='drawn' o archived_at != NULL mid-flow
When el vendedor intenta claim
Then la action verifica raffle status ANTES del atomic UPDATE
And si raffle no está 'open' → { ok: false, code: 'raffle_immutable' }

Given concurrency test (E2E-002b — joya de la corona)
When 2 vendedores hacen Promise.all sobre el mismo ticketId
Then exactamente UNO obtiene { ok: true }, el otro { ok: false, code: 'ticket_already_sold' }
And DB query confirma: count(tickets WHERE id=T AND status='sold') == 1
And ambos buyer entries persisten (no se borran)

Given sellerToken inválido o seller archivado
When invoca claimTicket
Then { ok: false, code: 'unauthorized' }

Given unit test con mock DB returning rowCount=0
When ejecuto la action
Then 'ticket_already_sold' response

Given unit test con mock DB returning rowCount=1
When ejecuto la action
Then 'ok: true' con el ticket
```

## Implementation notes ⚠️ READ DOC 07 ADR-001 + DOC 06 § "Algoritmo" + DOC 08 § "claimTicket"

```ts
// src/lib/actions/sales/claim-ticket.ts
const ClaimTicketSchema = z.object({
  sellerToken: z.string().length(32),
  ticketId: z.string().uuid(),
  buyerId: z.string().uuid(),
});

export const claimTicket = (input: unknown) =>
  withSellerToken({ schema: ClaimTicketSchema }, input, async (data, sellerId) => {
    // 1. Validate raffle state (cheap check, optimistic)
    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, data.ticketId),
      with: { raffle: true },
    });
    if (!ticket) return fail('not_found');
    if (ticket.raffle.status !== 'open' || ticket.raffle.archivedAt) {
      return fail('raffle_immutable');
    }

    // 2. ATOMIC UPDATE — BR-002, ADR-001
    const claimed = await db
      .update(tickets)
      .set({
        status: 'sold',
        buyerId: data.buyerId,
        sellerId,
        soldAt: new Date(),
      })
      .where(
        and(
          eq(tickets.id, data.ticketId),
          eq(tickets.status, 'available') // ← LA condición crítica
        )
      )
      .returning();

    if (claimed.length === 0) {
      return fail('ticket_already_sold'); // ← race condition lost
    }

    // 3. Revalidate
    revalidatePath(`/r/${ticket.raffle.publicSlug}`);
    revalidatePath(`/v/${data.sellerToken}`);

    return ok({
      ticket: claimed[0],
      ticketDigitalUrl: `/v/${data.sellerToken}/ticket/${claimed[0].id}`,
    });
  });
```

### ⛔ Anti-patterns prohibidos (auto-reject en code review)

```ts
// ❌ NUNCA — race condition garantizada
const t = await db.query.tickets.findFirst({ where: eq(tickets.id, ticketId) });
if (t.status === 'sold') return fail();
await db.update(tickets).set({ status: 'sold' });

// ❌ NUNCA — SELECT FOR UPDATE no funciona en Neon HTTP driver sin TX
const t = await db.execute(sql`SELECT * FROM tickets WHERE id=${id} FOR UPDATE`);

// ❌ NUNCA — guarda buyer ANTES de validar disponibilidad y luego retry
//   (genera buyers fantasma cada vez que pierde el race)
//   Solución actual SI guarda buyer antes pero es aceptable porque buyers son cheap
```

## Done when

- [ ] Action implementada con SINGLE-STATEMENT UPDATE conditional
- [ ] Code review confirma cero SELECT-then-UPDATE patterns
- [ ] Unit test con mock rowCount=0 → ticket_already_sold
- [ ] Unit test con mock rowCount=1 → ok response
- [ ] Unit test: raffle drawn mid-flow → raffle_immutable
- [ ] **E2E-002b concurrency race PASA en CI** (cubierto en RIF-022)
- [ ] Code review by security-auditor (RSK-001 mitigation)
- [ ] `pnpm verify` pasa
