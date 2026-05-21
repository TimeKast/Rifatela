/**
 * Bulk Ticket Generation
 *
 * Generate exactly `maxTickets` ticket rows for a raffle, all with
 * `status='available'` and numbers 1..maxTickets, in a single bulk INSERT.
 *
 * Invoked once per raffle inside the `createRaffle` server action (RIF-010),
 * after the Raffle and Prize rows are persisted. The DB unique constraint
 * on `(raffle_id, number)` (BR-001) defends against accidental re-runs.
 *
 * @see project/planning/06_DATA_MODEL.md (E-005 Ticket)
 * @see project/planning/05_BUSINESS_RULES.md (BR-001 uniqueness)
 * @see project/backlog/epics/EPIC-001-foundation-data-layer/issues/RIF-002-create-raffle-bulk-tickets.md
 */

import { tickets } from '@/lib/db/schema';
import type { Database } from '@/lib/db/drizzle';

const MIN_TICKETS = 1;
const MAX_TICKETS = 10_000;

/**
 * Insert `maxTickets` available tickets for the given raffle in one query.
 *
 * @param database - Drizzle DB instance (or transaction handle)
 * @param raffleId - UUID of the parent raffle (must already exist)
 * @param maxTickets - Total tickets to create, integer in [1, 10_000]
 *
 * @throws RangeError when `maxTickets` is not an integer in the allowed range.
 *   The DB is NOT touched in this case.
 */
export async function bulkInsertTicketsForRaffle(
  database: Database,
  raffleId: string,
  maxTickets: number
): Promise<void> {
  if (!Number.isInteger(maxTickets) || maxTickets < MIN_TICKETS || maxTickets > MAX_TICKETS) {
    throw new RangeError(
      `bulkInsertTicketsForRaffle: maxTickets must be an integer in [${MIN_TICKETS}, ${MAX_TICKETS}]; got ${maxTickets}`
    );
  }

  const rows = Array.from({ length: maxTickets }, (_, i) => ({
    raffleId,
    number: i + 1,
    status: 'available' as const,
  }));

  await database.insert(tickets).values(rows);
}
