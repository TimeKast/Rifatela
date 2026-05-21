/**
 * Prizes Schema (E-002)
 *
 * Each raffle has 1..N prizes via `position`. MVP uses exactly 1 (position=1)
 * per raffle; the table shape supports multi-prize (1st/2nd/3rd) without
 * migration when the feature ships (post-MVP, see brief F16 / B7).
 *
 * @see project/planning/06_DATA_MODEL.md §E-002
 */

import { pgTable, text, integer, uuid, uniqueIndex } from 'drizzle-orm/pg-core';
import { raffles } from './raffles';
import { auditFields } from '@/lib/db/helpers/audit-fields';

export const prizes = pgTable(
  'prizes',
  {
    /** Unique identifier (UUID v4). */
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * Owning raffle. Cascade-deleted with the raffle (BR-014 already prevents
     * deleting raffles with sales, so cascade is only hit on raffles without
     * tickets sold — safe).
     */
    raffleId: uuid('raffle_id')
      .notNull()
      .references(() => raffles.id, { onDelete: 'cascade' }),

    /**
     * Prize position. 1 = main prize (MVP always uses this).
     * 2+ reserved for multi-prize raffles (post-MVP).
     */
    position: integer('position').notNull().default(1),

    /** Prize description (3-500 chars, validated app-side). */
    text: text('text').notNull(),

    /**
     * Public URL of the prize image. Hosted on object storage (configured
     * via project's storage backend, e.g. Cloudflare R2 / S3). NULL if no
     * image uploaded.
     */
    imageUrl: text('image_url'),

    ...auditFields,
  },
  (t) => [uniqueIndex('prizes_raffle_position_idx').on(t.raffleId, t.position)]
);

export type Prize = typeof prizes.$inferSelect;
export type NewPrize = typeof prizes.$inferInsert;
