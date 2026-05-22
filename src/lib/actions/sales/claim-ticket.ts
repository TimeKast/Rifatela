'use server';

/**
 * claimTicket — RIF-021 ⭐ CRITICAL (BR-002, ADR-001)
 *
 * The single most important server action of the product. Mints the
 * "zero double-sale" invariant via a SINGLE-STATEMENT atomic conditional
 * UPDATE:
 *
 *     UPDATE tickets
 *        SET status='sold', buyer_id=?, seller_id=?, sold_at=NOW()
 *      WHERE id=? AND status='available'
 *      RETURNING *
 *
 *   - rowCount = 1 → sale closed by THIS request.
 *   - rowCount = 0 → ticket already sold (race lost) → user-facing
 *     "ya vendido" error. The buyer row inserted earlier is intentionally
 *     left in place — buyers are cheap and orphan buyers are harmless.
 *
 * ⛔ Anti-patterns explicitly rejected (see RIF-021):
 *   - SELECT then UPDATE (race window)
 *   - `SELECT … FOR UPDATE` (Neon HTTP / pg-pool fragility, doc 08)
 *   - explicit transaction (not portable across drivers; not needed)
 *
 * Raffle state check (status='open' and not archived) runs BEFORE the
 * atomic UPDATE — cheap optimistic short-circuit. The atomic UPDATE
 * remains the authoritative gate, status check is UX courtesy.
 *
 * @see project/planning/05_BUSINESS_RULES.md (BR-001, BR-002)
 * @see project/planning/07_ARCHITECTURE.md (ADR-001 Concurrency model)
 * @see project/planning/13_RISK_REGISTER.md (RSK-001 doble venta)
 * @see project/backlog/epics/EPIC-002-core-loop/issues/RIF-021-claim-ticket-action.md
 */

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { withSellerToken } from '@/lib/actions/helpers';
import { ActionError } from '@/lib/actions/types';
import { db } from '@/lib/db/drizzle';
import { raffleSellers, raffles, tickets } from '@/lib/db/schema';

const ClaimTicketSchema = z.object({
  ticketId: z.string().uuid('ID de ticket inválido'),
  buyerId: z.string().uuid('ID de comprador inválido'),
});

export interface ClaimTicketResult {
  ticketId: string;
  number: number;
  raffleId: string;
}

export async function claimTicket(sellerToken: string, _prevState: unknown, formData: FormData) {
  return withSellerToken<z.infer<typeof ClaimTicketSchema>, ClaimTicketResult>(
    { schema: ClaimTicketSchema },
    sellerToken,
    formData,
    async (data, sellerId) => {
      // 1. Cheap state probe: fetch the ticket's raffle to verify it's still
      //    open and not archived. This is a UX short-circuit — the atomic
      //    UPDATE below is the real gate.
      const [probe] = await db
        .select({
          ticketId: tickets.id,
          status: tickets.status,
          raffleStatus: raffles.status,
          raffleDeletedAt: raffles.deletedAt,
        })
        .from(tickets)
        .innerJoin(raffles, eq(raffles.id, tickets.raffleId))
        .where(eq(tickets.id, data.ticketId))
        .limit(1);

      if (!probe) {
        throw new ActionError('El boleto no existe.');
      }
      if (probe.raffleStatus !== 'open' || probe.raffleDeletedAt !== null) {
        throw new ActionError('La rifa ya no está abierta.');
      }
      if (probe.status === 'sold') {
        // Optimistic short-circuit — final auth is the atomic UPDATE.
        throw new ActionError('El boleto ya fue vendido.');
      }

      // 1.b Defense-in-depth: BR-016 — the seller must be assigned to the
      //     raffle. The seller token already validated this seller is real
      //     and active (via withSellerToken), but it doesn't know which
      //     raffle they're authorized to operate on. Without this check,
      //     a seller with a valid token could POST a ticketId belonging to
      //     a raffle they were never assigned to.
      const ticketRaffleId = await db
        .select({ raffleId: tickets.raffleId })
        .from(tickets)
        .where(eq(tickets.id, data.ticketId))
        .limit(1);
      const raffleIdForTicket = ticketRaffleId[0]?.raffleId;
      if (raffleIdForTicket) {
        const [assignment] = await db
          .select({ raffleId: raffleSellers.raffleId })
          .from(raffleSellers)
          .where(
            and(eq(raffleSellers.raffleId, raffleIdForTicket), eq(raffleSellers.sellerId, sellerId))
          )
          .limit(1);
        if (!assignment) {
          throw new ActionError('No estás asignado a esta rifa.');
        }
      }

      // 2. ATOMIC UPDATE — BR-002, ADR-001.
      //    The `status='available'` predicate is the race-condition gate.
      const claimed = await db
        .update(tickets)
        .set({
          status: 'sold',
          buyerId: data.buyerId,
          sellerId,
          soldAt: new Date(),
          modifiedAt: new Date(),
        })
        .where(and(eq(tickets.id, data.ticketId), eq(tickets.status, 'available')))
        .returning({ id: tickets.id, number: tickets.number, raffleId: tickets.raffleId });

      if (claimed.length === 0) {
        // Lost the race — another seller closed the sale between our
        // probe and our UPDATE. Surface the same user-facing error as
        // the probe-time check.
        throw new ActionError('El boleto ya fue vendido.');
      }

      // 3. Skip revalidatePath — /v/{token} is force-dynamic and the
      //    public /r/{slug} page refetches on its next visit. A full
      //    page-cache invalidation here is unnecessary for MVP.

      const claimedRow = claimed[0]!;
      return {
        ticketId: claimedRow.id,
        number: claimedRow.number,
        raffleId: claimedRow.raffleId,
      };
    }
  );
}
