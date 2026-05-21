/**
 * Sellers Schema (E-003)
 *
 * Sellers are admin-managed entities with a secret access token used as
 * URL-secret auth (ADR-003). No password, no email — token in path identifies.
 *
 * @see project/planning/06_DATA_MODEL.md §E-003
 * @see project/planning/05_BUSINESS_RULES.md (BR-012 rotation, BR-013 archive)
 */

import { pgTable, text, uuid, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { auditFields } from '@/lib/db/helpers/audit-fields';
import { softDeleteFields } from '@/lib/db/helpers/soft-delete';

export const sellers = pgTable(
  'sellers',
  {
    /** Unique identifier (UUID v4). */
    id: uuid('id').primaryKey().defaultRandom(),

    /** Display name (3-80 chars, validated app-side). */
    name: text('name').notNull(),

    /**
     * URL-secret token (nanoid 32, ~191 bits of entropy). The seller's
     * access URL is `/v/{accessToken}`. Token rotation (BR-012) replaces
     * this value; the old token instantly invalidates (no token grace list).
     *
     * SECURITY: never log; never expose in API responses after creation/rotation.
     */
    accessToken: text('access_token').notNull().unique(),

    ...softDeleteFields,
    ...auditFields,
  },
  (t) => [
    uniqueIndex('sellers_access_token_idx').on(t.accessToken),
    index('sellers_deleted_created_idx').on(t.deletedAt, t.createdAt),
  ]
);

export type Seller = typeof sellers.$inferSelect;
export type NewSeller = typeof sellers.$inferInsert;
