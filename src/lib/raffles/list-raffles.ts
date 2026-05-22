/**
 * List Raffles for Admin Dashboard (RIF-009)
 *
 * Returns raffles enriched with aggregated metrics required by SCR-001:
 *   - `soldCount`     : tickets sold (status='sold')
 *   - `sellersCount`  : distinct sellers with at least one sale
 *
 * Uses Postgres FILTER clause via Drizzle `sql` template — runs as a
 * single GROUP BY query (no N+1, no in-JS aggregation over 10k-ticket
 * sets). Soft-deleted raffles are filtered out by default; pass
 * `includeArchived: true` to include them (admin toggle in dashboard).
 *
 * @see project/backlog/epics/EPIC-002-core-loop/issues/RIF-009-admin-dashboard-listing.md
 * @see project/planning/06_DATA_MODEL.md (E-001 Raffle, E-005 Ticket)
 */

import { desc, eq, isNull, sql } from 'drizzle-orm';

import { db } from '@/lib/db/drizzle';
import { raffles, tickets } from '@/lib/db/schema';

/**
 * Shape returned to the dashboard RSC. Stable contract — extending this
 * is fine, removing/renaming fields requires updating the page render.
 */
export interface RaffleListEntry {
  id: string;
  name: string;
  status: 'draft' | 'open' | 'drawn';
  maxTickets: number;
  drawDate: Date;
  deletedAt: Date | null;
  publicSlug: string;
  createdAt: Date;
  /** Count of tickets with status='sold' for this raffle. */
  soldCount: number;
  /** Count of distinct sellers with at least one sold ticket. */
  sellersCount: number;
}

export interface ListRafflesOptions {
  /**
   * Include raffles with `deleted_at IS NOT NULL` (soft-archived).
   * Default `false` keeps the dashboard focused on active raffles.
   */
  includeArchived?: boolean;
}

export async function listRaffles(options: ListRafflesOptions = {}): Promise<RaffleListEntry[]> {
  const includeArchived = options.includeArchived ?? false;

  const rows = await db
    .select({
      id: raffles.id,
      name: raffles.name,
      status: raffles.status,
      maxTickets: raffles.maxTickets,
      drawDate: raffles.drawDate,
      deletedAt: raffles.deletedAt,
      publicSlug: raffles.publicSlug,
      createdAt: raffles.createdAt,
      // Postgres FILTER (WHERE …) — counted only for rows matching the
      // predicate, NULL-safe when there are no joined tickets.
      soldCount:
        sql<number>`coalesce(count(${tickets.id}) filter (where ${tickets.status} = 'sold'), 0)::int`.as(
          'sold_count'
        ),
      sellersCount:
        sql<number>`coalesce(count(distinct ${tickets.sellerId}) filter (where ${tickets.status} = 'sold'), 0)::int`.as(
          'sellers_count'
        ),
    })
    .from(raffles)
    .leftJoin(tickets, eq(tickets.raffleId, raffles.id))
    .where(includeArchived ? undefined : isNull(raffles.deletedAt))
    .groupBy(raffles.id)
    .orderBy(desc(raffles.createdAt));

  return rows;
}
