# RIF-035: Admin revierte venta (FT-011)

| Field              | Value                                            |
| ------------------ | ------------------------------------------------ |
| **Epic**           | EPIC-004 Admin Tools & Polish                    |
| **Priority**       | P0                                               |
| **Story Points**   | 5                                                |
| **Dependencies**   | RIF-001, RIF-012, RIF-019 (admin-detail variant) |
| **User Stories**   | US-020, US-021                                   |
| **Features**       | FT-011                                           |
| **Business Rules** | **BR-010, BR-011**                               |
| **Components**     | CMP-009 ConfirmDialog                            |
| **Agents**         | `backend-specialist`, `frontend-specialist`      |
| **Skills**         | `kb-server-actions`                              |
| **API Contract**   | `revertSale(input)` doc 08                       |

## Problem

Admin puede liberar un ticket vendido por error (FLW-006). Solo admin (BR-011), solo pre-sorteo (BR-010). Persiste AdminAction con razón opcional + datos previos para forensics.

## Acceptance Criteria

```gherkin
Given ticket #47 vendido (status='sold', buyer_id, seller_id) en raffle status='open'
When admin click "Revertir" en SCR-003 tabla de tickets
Then aparece ConfirmDialog destructive "¿Revertir venta del #47?"
And input opcional "Razón (opcional)"

When admin confirma con razón "Diego se equivocó"
Then se invoca revertSale({ ticketId, reason })
And la action:
  - Atomic UPDATE: SET status='available', buyer_id=NULL, seller_id=NULL, sold_at=NULL WHERE id=?
  - INSERT AdminAction(action_type='revert_sale', ticket_id, raffle_id, details={ reason, prevBuyerId, prevSellerId })
And el ticket #47 vuelve a 'available' en la grilla
And revalidatePath de detail page y vista pública
And toast "Venta revertida"

Given raffle con status='drawn'
When admin intenta revertir
Then la action retorna { ok: false, code: 'raffle_immutable' } (BR-010)
And UI muestra error

Given caller no admin (e.g. vendedor con sellerToken)
When invoca revertSale programmatically
Then la action retorna { ok: false, code: 'forbidden' } (BR-011)
And vendedor en SCR-006 NO ve botón "Revertir" (US-021)

Given Buyer "Marta" que tenía solo este ticket #47
When admin revierte
Then Buyer Marta NO se borra (puede reutilizarse en otras rifas)

Given E2E-004
When ejecuto flow completo
Then admin revierte → grilla pública actualiza → AdminAction visible en historial
```

## Implementation notes

```ts
// src/lib/actions/sales/revert-sale.ts
const RevertSaleSchema = z.object({
  ticketId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export const revertSale = (input: unknown) =>
  withAuth(
    { resource: 'tickets', action: 'revert', schema: RevertSaleSchema },
    input,
    async (data) => {
      // 1. Load ticket + raffle status
      const ticket = await db.query.tickets.findFirst({
        where: eq(tickets.id, data.ticketId),
        with: { raffle: true },
      });
      if (!ticket) return fail('not_found');
      if (ticket.raffle.status === 'drawn') return fail('raffle_immutable');

      const { buyerId: prevBuyerId, sellerId: prevSellerId } = ticket;

      // 2. Atomic UPDATE
      await db
        .update(tickets)
        .set({ status: 'available', buyerId: null, sellerId: null, soldAt: null })
        .where(eq(tickets.id, data.ticketId));

      // 3. Log
      await db.insert(adminActions).values({
        actionType: 'revert_sale',
        ticketId: data.ticketId,
        raffleId: ticket.raffleId,
        details: { reason: data.reason, prevBuyerId, prevSellerId },
      });

      revalidatePath(`/admin/[token]/raffles/${ticket.raffleId}`);
      revalidatePath(`/r/${ticket.raffle.publicSlug}`);

      return { ok: true, data: { ticketId: data.ticketId } };
    }
  );
```

- UI: dialog destructive en CMP-009 + reason input opcional
- Vendedor SCR-006: NO render "revertir" button (US-021)

## Done when

- [ ] Action `revertSale` implementada
- [ ] UI integrada en SCR-003 con ConfirmDialog
- [ ] Unit test: revert sobre open OK, drawn fail
- [ ] Unit test: vendedor con sellerToken intentando revertSale → 403
- [ ] **E2E-004 pasa** (CI gate)
- [ ] `pnpm verify` pasa
