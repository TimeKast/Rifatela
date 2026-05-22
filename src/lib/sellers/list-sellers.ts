/**
 * List Sellers for Admin Sellers Management page (RIF-013)
 *
 * Returns sellers enriched with their total sold-tickets count across all
 * raffles. Active sellers (`deletedAt IS NULL`) and archived sellers are
 * fetched separately so the UI can render them in two clearly-labelled
 * groups.
 *
 * Aggregation via Postgres `count() FILTER (WHERE …)` in a single
 * GROUP BY query — same pattern as `listRaffles` (RIF-009). No N+1.
 *
 * @see project/planning/06_DATA_MODEL.md (E-003 Seller, E-005 Ticket)
 */

import { asc, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';

import { db } from '@/lib/db/drizzle';
import { sellers, tickets } from '@/lib/db/schema';

export interface SellerListEntry {
  id: string;
  name: string;
  accessToken: string;
  deletedAt: Date | null;
  createdAt: Date;
  /** Lifetime sold-ticket count for this seller across all raffles. */
  salesCount: number;
}

export interface ListSellersOptions {
  /** Include archived (soft-deleted) sellers. Default `false`. */
  includeArchived?: boolean;
}

export async function listSellers(options: ListSellersOptions = {}): Promise<SellerListEntry[]> {
  const includeArchived = options.includeArchived ?? false;

  return db
    .select({
      id: sellers.id,
      name: sellers.name,
      accessToken: sellers.accessToken,
      deletedAt: sellers.deletedAt,
      createdAt: sellers.createdAt,
      salesCount:
        sql<number>`coalesce(count(${tickets.id}) filter (where ${tickets.status} = 'sold'), 0)::int`.as(
          'sales_count'
        ),
    })
    .from(sellers)
    .leftJoin(tickets, eq(tickets.sellerId, sellers.id))
    .where(includeArchived ? isNotNull(sellers.deletedAt) : isNull(sellers.deletedAt))
    .groupBy(sellers.id)
    .orderBy(
      // Active list: most-recent first. Archived list: chronological.
      includeArchived ? asc(sellers.createdAt) : desc(sellers.createdAt)
    );
}
