/**
 * AdminAction Schema (E-006)
 *
 * Lightweight audit log of admin operations with effect on sensitive data:
 * revert a sale (BR-011), rotate a seller token (BR-012), archive a raffle
 * or seller, edit a raffle. Purpose: forensics for disputes and rollback
 * understanding.
 *
 * The shape of `details` (jsonb) varies per `action_type` — see doc 06 for
 * the required keys per variant.
 *
 * @see project/planning/06_DATA_MODEL.md §E-006
 */

import { pgTable, pgEnum, jsonb, timestamp, uuid, index } from 'drizzle-orm/pg-core';
import { raffles } from './raffles';
import { tickets } from './tickets';
import { sellers } from './sellers';

export const adminActionTypeEnum = pgEnum('admin_action_type', [
  'revert_sale',
  'rotate_seller_token',
  'archive_raffle',
  'archive_seller',
  'edit_raffle',
]);

export const adminActions = pgTable(
  'admin_actions',
  {
    /** Unique identifier (UUID v4). */
    id: uuid('id').primaryKey().defaultRandom(),

    /** Discriminator for `details` shape and log filtering. */
    actionType: adminActionTypeEnum('action_type').notNull(),

    /** Related raffle (where applicable). NULL for actions that don't touch a raffle. */
    raffleId: uuid('raffle_id').references(() => raffles.id, { onDelete: 'set null' }),

    /** Related ticket (e.g. for revert_sale). */
    ticketId: uuid('ticket_id').references(() => tickets.id, { onDelete: 'set null' }),

    /** Related seller (e.g. for rotate_seller_token, archive_seller). */
    sellerId: uuid('seller_id').references(() => sellers.id, { onDelete: 'set null' }),

    /**
     * Action-specific payload. Shape varies per `actionType`:
     * - `revert_sale`        → { reason?, prevBuyerId, prevSellerId }
     * - `rotate_seller_token`→ { oldTokenHash }  (NEVER plain old token)
     * - `archive_raffle`     → { reason? }
     * - `archive_seller`     → { reason? }
     * - `edit_raffle`        → { changes: { field: { from, to } } }
     */
    details: jsonb('details').notNull().default({}),

    /** When the admin executed this action. */
    createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /** "Últimas acciones del admin" UI. */
    index('admin_actions_created_idx').on(t.createdAt),
    /** Per-raffle history (SCR-003 admin detail). */
    index('admin_actions_raffle_idx').on(t.raffleId),
  ]
);

export type AdminAction = typeof adminActions.$inferSelect;
export type NewAdminAction = typeof adminActions.$inferInsert;
