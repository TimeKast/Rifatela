'use server';

/**
 * Raffle ↔ Seller Assignment Actions
 *
 * Two admin actions over the `raffle_sellers` junction (E-007):
 *
 *   - `assignSellerToRaffle(raffleId, sellerId)`
 *       Idempotent INSERT … ON CONFLICT DO NOTHING. No-op if already
 *       assigned. Fails if raffle or seller is soft-deleted.
 *
 *   - `unassignSellerFromRaffle(raffleId, sellerId)`
 *       Idempotent DELETE. No-op if there was no assignment.
 *
 * Both are gated by `withAdminToken`. Both revalidate the raffle detail
 * page so the AssignedSellersManager re-renders with the new list.
 *
 * @see project/planning/06_DATA_MODEL.md (E-007 RaffleSeller)
 * @see project/planning/05_BUSINESS_RULES.md (BR-016 assigned-only sales)
 */

import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { withAdminToken } from '@/lib/actions/helpers';
import { ActionError } from '@/lib/actions/types';
import { db } from '@/lib/db/drizzle';
import { raffleSellers, raffles, sellers } from '@/lib/db/schema';

// ─────────────────────────────────────────────────────────────────────────────
// assignSellerToRaffle
// ─────────────────────────────────────────────────────────────────────────────

const AssignSellerSchema = z.object({
  raffleId: z.string().uuid('ID de rifa inválido'),
  sellerId: z.string().uuid('ID de vendedor inválido'),
});

export interface AssignSellerResult {
  raffleId: string;
  sellerId: string;
  /** False when the row already existed (idempotent no-op). */
  inserted: boolean;
}

export async function assignSellerToRaffle(
  adminToken: string,
  _prevState: unknown,
  formData: FormData
) {
  return withAdminToken<z.infer<typeof AssignSellerSchema>, AssignSellerResult>(
    { schema: AssignSellerSchema, revalidate: '/admin/[token]/raffles/[id]' },
    adminToken,
    formData,
    async (data) => {
      // Validate raffle and seller exist + are active.
      const [raffle] = await db
        .select({ id: raffles.id })
        .from(raffles)
        .where(and(eq(raffles.id, data.raffleId), isNull(raffles.deletedAt)))
        .limit(1);
      if (!raffle) {
        throw new ActionError('La rifa no existe o está archivada.');
      }

      const [seller] = await db
        .select({ id: sellers.id })
        .from(sellers)
        .where(and(eq(sellers.id, data.sellerId), isNull(sellers.deletedAt)))
        .limit(1);
      if (!seller) {
        throw new ActionError('El vendedor no existe o está archivado.');
      }

      const inserted = await db
        .insert(raffleSellers)
        .values({ raffleId: data.raffleId, sellerId: data.sellerId })
        .onConflictDoNothing()
        .returning({ raffleId: raffleSellers.raffleId });

      return {
        raffleId: data.raffleId,
        sellerId: data.sellerId,
        inserted: inserted.length > 0,
      };
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// unassignSellerFromRaffle
// ─────────────────────────────────────────────────────────────────────────────

const UnassignSellerSchema = z.object({
  raffleId: z.string().uuid('ID de rifa inválido'),
  sellerId: z.string().uuid('ID de vendedor inválido'),
});

export interface UnassignSellerResult {
  raffleId: string;
  sellerId: string;
  /** False when there was no assignment to remove (idempotent no-op). */
  removed: boolean;
}

export async function unassignSellerFromRaffle(
  adminToken: string,
  _prevState: unknown,
  formData: FormData
) {
  return withAdminToken<z.infer<typeof UnassignSellerSchema>, UnassignSellerResult>(
    { schema: UnassignSellerSchema, revalidate: '/admin/[token]/raffles/[id]' },
    adminToken,
    formData,
    async (data) => {
      const deleted = await db
        .delete(raffleSellers)
        .where(
          and(eq(raffleSellers.raffleId, data.raffleId), eq(raffleSellers.sellerId, data.sellerId))
        )
        .returning({ raffleId: raffleSellers.raffleId });

      return {
        raffleId: data.raffleId,
        sellerId: data.sellerId,
        removed: deleted.length > 0,
      };
    }
  );
}
