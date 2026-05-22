/**
 * Get Seller By Token (RIF-017)
 *
 * Resolves a `/v/{accessToken}` URL secret into the active seller row.
 * Returns `null` for both
 *   - token doesn't match any seller, and
 *   - token matches an archived seller (BR-013)
 * by design — surfacing the difference would help attackers distinguish
 * "invalid" from "revoked" tokens. RSC pages render `notFound()` either way.
 *
 * @see project/planning/05_BUSINESS_RULES.md (BR-013)
 * @see project/planning/07_ARCHITECTURE.md (ADR-003)
 * @see project/backlog/epics/EPIC-002-core-loop/issues/RIF-017-seller-middleware-panel.md
 */

import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/lib/db/drizzle';
import { sellers, type Seller } from '@/lib/db/schema';

export type SellerPublic = Pick<Seller, 'id' | 'name'>;

export async function getSellerByToken(accessToken: string): Promise<SellerPublic | null> {
  if (!accessToken) return null;

  const [seller] = await db
    .select({ id: sellers.id, name: sellers.name })
    .from(sellers)
    .where(and(eq(sellers.accessToken, accessToken), isNull(sellers.deletedAt)))
    .limit(1);

  return seller ?? null;
}
