/**
 * RaffleSeller Schema (E-007) — Junction M:N (Raffle ↔ Seller)
 *
 * Explicit admin-driven association: a seller can only operate on a raffle
 * if there is a `raffle_sellers` row linking them. The seller portal
 * (`/v/{token}`) filters by this table; `claimTicket` re-checks it as
 * defense-in-depth.
 *
 * ON DELETE behavior:
 *   - raffle physically deleted → CASCADE drops assignments (consistent)
 *   - seller physically deleted → CASCADE drops assignments (consistent)
 *   - raffle/seller SOFT-deleted (deletedAt) → assignments REMAIN (the
 *     admin UI filters them out, but historical sales context survives)
 *
 * No `modifiedAt`/`modifiedBy`: assignments are immutable rows —
 * un-assigning is `DELETE`, re-assigning is `INSERT`. Editing makes no
 * sense (the M:N pair IS the row).
 *
 * @see project/planning/06_DATA_MODEL.md §E-007
 * @see project/planning/05_BUSINESS_RULES.md (BR-016 assigned-only sales)
 */

import { pgTable, primaryKey, timestamp, uuid, index } from 'drizzle-orm/pg-core';

import { raffles } from './raffles';
import { sellers } from './sellers';

export const raffleSellers = pgTable(
  'raffle_sellers',
  {
    raffleId: uuid('raffle_id')
      .notNull()
      .references(() => raffles.id, { onDelete: 'cascade' }),

    sellerId: uuid('seller_id')
      .notNull()
      .references(() => sellers.id, { onDelete: 'cascade' }),

    /** When the admin created the assignment. */
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),

    /** Admin user id (nullable until real auth lands; URL-secret admin = null). */
    createdBy: uuid('created_by'),
  },
  (t) => [
    primaryKey({ columns: [t.raffleId, t.sellerId] }),
    /** "What raffles is Diego assigned to?" — seller portal lookup. */
    index('raffle_sellers_seller_idx').on(t.sellerId),
  ]
);

export type RaffleSeller = typeof raffleSellers.$inferSelect;
export type NewRaffleSeller = typeof raffleSellers.$inferInsert;
