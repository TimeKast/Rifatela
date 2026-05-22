/**
 * Get Raffle Detail (RIF-012)
 *
 * Fetches everything the admin detail page (SCR-003) needs about a single
 * raffle: the raffle row itself, its primary prize, sold-ticket rows
 * (with buyer + seller info via joins), available-ticket count, and the
 * admin action log for the raffle.
 *
 * Three separate queries on purpose:
 *   1. Raffle  → small row, fail-fast if missing.
 *   2. Prize   → 1 row per raffle in MVP.
 *   3. Tickets (sold only) + seller + buyer → bounded by sales count.
 *   4. Available tickets count → integer aggregate, no row fetch.
 *   5. AdminActions for the raffle → small log.
 *
 * We don't use Drizzle's `db.query.X.findFirst({ with })` API because the
 * project hasn't declared `relations()` for the schema, and we want this
 * page to stay simple — explicit SELECT statements with joins.
 *
 * @see project/planning/06_DATA_MODEL.md (E-001..E-006)
 * @see project/backlog/epics/EPIC-002-core-loop/issues/RIF-012-admin-raffle-detail.md
 */

import { count, desc, eq, sql } from 'drizzle-orm';

import { db } from '@/lib/db/drizzle';
import {
  adminActions,
  buyers,
  prizes,
  raffles,
  sellers,
  tickets,
  type AdminAction,
  type Raffle,
} from '@/lib/db/schema';

export interface SoldTicketRow {
  id: string;
  number: number;
  soldAt: Date | null;
  buyer: { id: string; name: string | null } | null;
  seller: { id: string; name: string } | null;
}

export interface PrizeSummary {
  text: string;
  imageUrl: string | null;
}

export interface RaffleDetail {
  raffle: Raffle;
  prize: PrizeSummary | null;
  soldTickets: SoldTicketRow[];
  availableCount: number;
  adminActions: AdminAction[];
}

export async function getRaffleDetail(raffleId: string): Promise<RaffleDetail | null> {
  // 1. Raffle row
  const [raffle] = await db.select().from(raffles).where(eq(raffles.id, raffleId)).limit(1);
  if (!raffle) return null;

  // 2. Prize (position=1 in MVP)
  const [prize] = await db
    .select({ text: prizes.text, imageUrl: prizes.imageUrl })
    .from(prizes)
    .where(eq(prizes.raffleId, raffleId))
    .limit(1);

  // 3. Sold tickets + buyer + seller via leftJoin.
  //    Order by number ASC so the list reads naturally for the admin.
  const soldRows = await db
    .select({
      ticketId: tickets.id,
      number: tickets.number,
      soldAt: tickets.soldAt,
      buyerId: buyers.id,
      buyerName: buyers.name,
      sellerId: sellers.id,
      sellerName: sellers.name,
    })
    .from(tickets)
    .leftJoin(buyers, eq(tickets.buyerId, buyers.id))
    .leftJoin(sellers, eq(tickets.sellerId, sellers.id))
    .where(sql`${tickets.raffleId} = ${raffleId} AND ${tickets.status} = 'sold'`)
    .orderBy(tickets.number);

  const soldTickets: SoldTicketRow[] = soldRows.map((r) => ({
    id: r.ticketId,
    number: r.number,
    soldAt: r.soldAt,
    buyer: r.buyerId ? { id: r.buyerId, name: r.buyerName } : null,
    seller: r.sellerId && r.sellerName ? { id: r.sellerId, name: r.sellerName } : null,
  }));

  // 4. Available-ticket count (integer aggregate).
  const [availableAgg] = await db
    .select({ value: count() })
    .from(tickets)
    .where(sql`${tickets.raffleId} = ${raffleId} AND ${tickets.status} = 'available'`);

  // 5. AdminActions for this raffle (history feed).
  const actionRows = await db
    .select()
    .from(adminActions)
    .where(eq(adminActions.raffleId, raffleId))
    .orderBy(desc(adminActions.createdAt));

  return {
    raffle,
    prize: prize ?? null,
    soldTickets,
    availableCount: availableAgg?.value ?? 0,
    adminActions: actionRows,
  };
}
