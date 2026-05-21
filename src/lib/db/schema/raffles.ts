/**
 * Raffles Schema (E-001)
 *
 * Core entity: a raffle has a closed set of N tickets, a draw date,
 * a prize, and a verifiable RNG seed (commit-reveal scheme).
 *
 * @see project/planning/06_DATA_MODEL.md §E-001
 * @see project/planning/05_BUSINESS_RULES.md (BR-003, BR-005, BR-006, BR-010, BR-015)
 */

import {
  pgTable,
  pgEnum,
  text,
  integer,
  timestamp,
  uuid,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { auditFields } from '@/lib/db/helpers/audit-fields';
import { softDeleteFields } from '@/lib/db/helpers/soft-delete';

/**
 * Raffle lifecycle states.
 *
 * - `draft`  — reserved for post-MVP preview flow (not used in MVP; raffles are born `open`).
 * - `open`   — accepting ticket sales; countdown active.
 * - `drawn`  — winner persisted; immutable (BR-010).
 *
 * `archived_at` (from softDeleteFields) is ORTHOGONAL to status — a raffle can
 * be archived in any status (BR-014, BR-015).
 */
export const raffleStatusEnum = pgEnum('raffle_status', ['draft', 'open', 'drawn']);

export const raffles = pgTable(
  'raffles',
  {
    /** Unique identifier (UUID v4). */
    id: uuid('id').primaryKey().defaultRandom(),

    /** Human-readable name (3-120 chars, validated app-side). */
    name: text('name').notNull(),

    /** Total tickets in the closed set (1..10000 validated app-side). */
    maxTickets: integer('max_tickets').notNull(),

    /** When the draw is scheduled to occur (timezone-aware). */
    drawDate: timestamp('draw_date', { mode: 'date', withTimezone: true }).notNull(),

    /** Lifecycle status. Defaults to 'open' in MVP. */
    status: raffleStatusEnum('status').notNull().default('open'),

    /**
     * Winner ticket ID, persisted at draw time. NULL pre-draw.
     * FK constraint added via migration to avoid circular ref to tickets.
     */
    winnerTicketId: uuid('winner_ticket_id'),

    /**
     * RNG seed used by `seedToWinner()`. NULL until draw — revealed publicly
     * at draw time so visitors can verify sha256(rngSeed) === seedCommit.
     */
    rngSeed: text('rng_seed'),

    /**
     * Commit hash sha256(rngSeed) published from `status='open'`.
     * Backbone of the commit-reveal verification scheme (BR-006).
     */
    seedCommit: text('seed_commit').notNull(),

    /** When the draw was executed. NULL pre-draw. */
    drawnAt: timestamp('drawn_at', { mode: 'date', withTimezone: true }),

    /**
     * URL-safe public identifier for shareable links (`/r/{publicSlug}`).
     * Generated server-side as `nanoid(10)`. Not secret — public by design.
     */
    publicSlug: text('public_slug').notNull().unique(),

    ...softDeleteFields,
    ...auditFields,
  },
  (t) => [
    uniqueIndex('raffles_public_slug_idx').on(t.publicSlug),
    index('raffles_status_deleted_created_idx').on(t.status, t.deletedAt, t.createdAt),
    index('raffles_draw_date_idx').on(t.drawDate),
  ]
);

/** Inferred row type for SELECT queries. */
export type Raffle = typeof raffles.$inferSelect;
/** Inferred row type for INSERT statements. */
export type NewRaffle = typeof raffles.$inferInsert;
