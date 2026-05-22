'use server';

/**
 * executeDraw — RIF-029 ⭐ CRITICAL (BR-005, BR-006, BR-010)
 *
 * Admin-only server action that executes the raffle draw. This is an
 * IRREVERSIBLE state transition (`open` → `drawn`, BR-010) and the
 * authoritative moment of the commit-reveal scheme (BR-006) — the
 * server reveals `rng_seed` at the same time it persists the winner.
 *
 * Preconditions (all checked before any mutation):
 *   1. raffle exists and is not soft-deleted
 *   2. raffle.status === 'open'
 *   3. raffle.drawDate has been reached
 *   4. at least one ticket is sold (BR-004 + BR-007: a sold-empty draw
 *      is undefined; we reject instead of inventing a "no winner" state)
 *
 * Atomic UPDATE with `WHERE status='open'` predicate as the gate against
 * concurrent re-execution. rowCount=0 means another admin tab already
 * drew this raffle between our SELECT and our UPDATE.
 *
 * Audit logging: NOT recorded in `admin_actions` for MVP — the draw is
 * self-evident in `raffles.drawnAt + status='drawn' + winnerTicketId`,
 * and the enum doesn't currently include an `execute_draw` value (adding
 * it would require a separate migration). The transition is visible in
 * `raffles.modifiedAt` and the revealed `rng_seed`.
 *
 * @see project/planning/05_BUSINESS_RULES.md (BR-004, BR-005, BR-006, BR-010)
 * @see project/planning/07_ARCHITECTURE.md (ADR-002 Replay + Commit-Reveal)
 * @see project/backlog/epics/EPIC-003-public-view-and-draw/issues/RIF-029-execute-draw-action.md
 */

import { and, asc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { withAdminToken } from '@/lib/actions/helpers';
import { ActionError } from '@/lib/actions/types';
import { db } from '@/lib/db/drizzle';
import { buyers, raffles, tickets } from '@/lib/db/schema';
import { seedToWinner } from '@/lib/draw/seedToWinner';

const ExecuteDrawSchema = z.object({
  raffleId: z.string().uuid('ID de rifa inválido'),
});

export interface ExecuteDrawResult {
  raffleId: string;
  publicSlug: string;
  winnerTicketId: string;
  winnerNumber: number;
  /** Buyer name (full — BR-009 exception per DD-010). Null if anonymous. */
  winnerBuyerName: string | null;
  /** Revealed for the first time in this response (BR-006). */
  rngSeed: string;
  drawnAt: Date;
}

export async function executeDraw(adminToken: string, _prevState: unknown, formData: FormData) {
  return withAdminToken<z.infer<typeof ExecuteDrawSchema>, ExecuteDrawResult>(
    { schema: ExecuteDrawSchema, revalidate: '/admin/[token]/raffles/[id]' },
    adminToken,
    formData,
    async (data) => {
      // 1. Load raffle. Need rngSeed (server-side only until this moment),
      //    status, drawDate, publicSlug (for revalidation of /r/{slug}).
      const [raffle] = await db
        .select({
          id: raffles.id,
          status: raffles.status,
          drawDate: raffles.drawDate,
          deletedAt: raffles.deletedAt,
          rngSeed: raffles.rngSeed,
          publicSlug: raffles.publicSlug,
        })
        .from(raffles)
        .where(eq(raffles.id, data.raffleId))
        .limit(1);

      if (!raffle || raffle.deletedAt !== null) {
        throw new ActionError('La rifa no existe.');
      }
      if (raffle.status === 'drawn') {
        throw new ActionError('Esta rifa ya fue sorteada.');
      }
      if (raffle.status !== 'open') {
        throw new ActionError('La rifa no está abierta para sortear.');
      }
      if (raffle.drawDate.getTime() > Date.now()) {
        throw new ActionError('Aún no llegó la fecha del sorteo.');
      }
      if (!raffle.rngSeed) {
        // Should never happen — rngSeed is required at raffle creation.
        // Defensive: surface as a user error rather than crashing.
        throw new ActionError('La rifa no tiene semilla configurada.');
      }

      // 2. Load sold tickets ordered by number ASC (the ordering contract
      //    seedToWinner depends on — see BR-004).
      const sold = await db
        .select({
          id: tickets.id,
          number: tickets.number,
          buyerName: buyers.name,
        })
        .from(tickets)
        .leftJoin(buyers, eq(tickets.buyerId, buyers.id))
        .where(and(eq(tickets.raffleId, data.raffleId), eq(tickets.status, 'sold')))
        .orderBy(asc(tickets.number));

      if (sold.length === 0) {
        throw new ActionError('No se puede sortear: nadie compró boletos.');
      }

      // 3. Deterministically pick the winner.
      const { winnerTicketId } = seedToWinner(
        raffle.rngSeed,
        sold.map((t) => t.id)
      );
      const winner = sold.find((t) => t.id === winnerTicketId);
      if (!winner) {
        // Impossible in practice — winnerTicketId came from the same array.
        throw new ActionError('Error interno al calcular el ganador.');
      }

      // 4. Atomic UPDATE — `status='open'` predicate guards against
      //    concurrent re-execution (another admin tab drew it first).
      const drawnAt = new Date();
      const updated = await db
        .update(raffles)
        .set({
          status: 'drawn',
          winnerTicketId,
          drawnAt,
          modifiedAt: drawnAt,
        })
        .where(
          and(eq(raffles.id, raffle.id), eq(raffles.status, 'open'), isNull(raffles.deletedAt))
        )
        .returning({ id: raffles.id });

      if (updated.length === 0) {
        throw new ActionError('La rifa ya fue sorteada en otra ventana.');
      }

      return {
        raffleId: raffle.id,
        publicSlug: raffle.publicSlug,
        winnerTicketId,
        winnerNumber: winner.number,
        winnerBuyerName: winner.buyerName,
        rngSeed: raffle.rngSeed,
        drawnAt,
      };
    }
  );
}
