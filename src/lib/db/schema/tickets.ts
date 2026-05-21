/**
 * Tickets Schema (E-005)
 *
 * The heart of concurrency. A raffle creates `max_tickets` rows up-front
 * (bulk insert at raffle creation, see RIF-002). Each ticket has a unique
 * (raffle_id, number) combination — DB constraint enforces BR-001.
 *
 * Sale assignment goes through `claimTicket` server action with single-statement
 * atomic conditional UPDATE (BR-002, ADR-001):
 *
 *   UPDATE tickets SET status='sold', buyer_id=?, seller_id=?, sold_at=NOW()
 *    WHERE id=? AND status='available' RETURNING *
 *
 * If rowCount=0 → race lost → 409 Conflict.
 *
 * @see project/planning/06_DATA_MODEL.md §E-005
 * @see project/planning/05_BUSINESS_RULES.md (BR-001, BR-002, BR-011)
 */

import { pgTable, pgEnum, integer, timestamp, uuid, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { raffles } from './raffles';
import { buyers } from './buyers';
import { sellers } from './sellers';
import { auditFields } from '@/lib/db/helpers/audit-fields';

export const ticketStatusEnum = pgEnum('ticket_status', ['available', 'sold']);

export const tickets = pgTable(
  'tickets',
  {
    /** Unique identifier (UUID v4). */
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * Owning raffle. Cascade-deleted with the raffle (only possible when
     * raffle has no sold tickets — BR-014).
     */
    raffleId: uuid('raffle_id')
      .notNull()
      .references(() => raffles.id, { onDelete: 'cascade' }),

    /** Ticket number within the raffle (1..raffle.max_tickets). */
    number: integer('number').notNull(),

    /** Sale status. Atomic transition `available → sold` via BR-002 pattern. */
    status: ticketStatusEnum('status').notNull().default('available'),

    /** Buyer that owns this ticket. NULL when status='available'. */
    buyerId: uuid('buyer_id').references(() => buyers.id, { onDelete: 'set null' }),

    /** Seller that closed the sale. NULL when status='available'. */
    sellerId: uuid('seller_id').references(() => sellers.id, { onDelete: 'set null' }),

    /** Sale timestamp. NULL when status='available'. */
    soldAt: timestamp('sold_at', { mode: 'date', withTimezone: true }),

    ...auditFields,
  },
  (t) => [
    /** BR-001: one (raffle, number) pair can only be sold once (DB-enforced). */
    uniqueIndex('tickets_raffle_number_idx').on(t.raffleId, t.number),
    /** Grilla pública/vendor queries: filter disponibles vs vendidos. */
    index('tickets_raffle_status_idx').on(t.raffleId, t.status),
    /** Métricas por vendedor (FT-012). Partial index — solo cuenta filas vendidas. */
    index('tickets_seller_sold_idx')
      .on(t.sellerId)
      .where(sql`${t.status} = 'sold'`),
    /** "Tickets del buyer X" — útil para forensics + post-MVP "mis tickets". */
    index('tickets_buyer_idx').on(t.buyerId),
  ]
);

export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
