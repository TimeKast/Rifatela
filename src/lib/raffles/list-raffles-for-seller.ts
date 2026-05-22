/**
 * List Raffles For Seller (RIF-NEW seller-raffle assignment)
 *
 * Returns the OPEN, non-archived raffles that an admin has assigned to a
 * given seller via the `raffle_sellers` junction table (E-007). Used by
 * `/v/{token}` to decide which raffles the seller can operate on.
 *
 * Shape kept minimal — the seller portal only needs id/name/maxTickets
 * for header + grid rendering. Sold-count is computed at page level from
 * the ticket grid, so we don't aggregate here.
 *
 * @see project/planning/06_DATA_MODEL.md (E-007 RaffleSeller)
 */

import { and, desc, eq, isNull } from 'drizzle-orm';

import { db } from '@/lib/db/drizzle';
import { raffleSellers, raffles } from '@/lib/db/schema';

export interface SellerRaffle {
  id: string;
  name: string;
  maxTickets: number;
  drawDate: Date;
}

export async function listRafflesForSeller(sellerId: string): Promise<SellerRaffle[]> {
  return db
    .select({
      id: raffles.id,
      name: raffles.name,
      maxTickets: raffles.maxTickets,
      drawDate: raffles.drawDate,
    })
    .from(raffleSellers)
    .innerJoin(raffles, eq(raffles.id, raffleSellers.raffleId))
    .where(
      and(
        eq(raffleSellers.sellerId, sellerId),
        eq(raffles.status, 'open'),
        isNull(raffles.deletedAt)
      )
    )
    .orderBy(desc(raffles.createdAt));
}
