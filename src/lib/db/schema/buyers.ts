/**
 * Buyers Schema (E-004)
 *
 * Each Buyer represents one customer registered by a seller. All contact
 * fields are OPTIONAL (BR-008) — anonymous buyers are explicitly allowed.
 * Identity is by `id`, not by contact info.
 *
 * Privacy: phone/email NEVER appear in public views (BR-009 — only initials
 * of `name` are exposed publicly, falling back to "Anónimo" when name is null).
 *
 * @see project/planning/06_DATA_MODEL.md §E-004
 */

import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { auditFields } from '@/lib/db/helpers/audit-fields';

export const buyers = pgTable('buyers', {
  /** Unique identifier (UUID v4). */
  id: uuid('id').primaryKey().defaultRandom(),

  /** Display name (optional — BR-008). Used for initials in public views (BR-009). */
  name: text('name'),

  /** Phone number (optional, no format validation — LATAM formats vary). PII: never expose publicly. */
  phone: text('phone'),

  /** Email (optional, format-validated app-side when present). PII: never expose publicly. */
  email: text('email'),

  ...auditFields,
});

export type Buyer = typeof buyers.$inferSelect;
export type NewBuyer = typeof buyers.$inferInsert;
