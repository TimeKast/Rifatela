/**
 * Get Assigned Sellers For A Raffle
 *
 * Used by the admin raffle-detail page (`/admin/{token}/raffles/{id}`) to
 * render the "Vendedores asignados" section: who is currently assigned
 * (with `assignedAt` for the audit trail) and who is available to add
 * (active sellers not yet assigned). Soft-deleted sellers are excluded
 * from BOTH lists — they remain in `raffle_sellers` for historical
 * fidelity but cannot be re-assigned and aren't surfaced for selection.
 *
 * @see project/planning/06_DATA_MODEL.md (E-007 RaffleSeller)
 */

import { and, asc, eq, isNull, notInArray } from 'drizzle-orm';

import { db } from '@/lib/db/drizzle';
import { raffleSellers, sellers } from '@/lib/db/schema';

export interface AssignedSeller {
  id: string;
  name: string;
  assignedAt: Date;
}

export interface AvailableSeller {
  id: string;
  name: string;
}

export interface AssignmentLists {
  assigned: AssignedSeller[];
  available: AvailableSeller[];
}

export async function getAssignmentLists(raffleId: string): Promise<AssignmentLists> {
  // 1. Sellers currently assigned to this raffle (active only — archived
  //    sellers keep their historical row but aren't surfaced).
  const assigned: AssignedSeller[] = await db
    .select({
      id: sellers.id,
      name: sellers.name,
      assignedAt: raffleSellers.createdAt,
    })
    .from(raffleSellers)
    .innerJoin(sellers, eq(sellers.id, raffleSellers.sellerId))
    .where(and(eq(raffleSellers.raffleId, raffleId), isNull(sellers.deletedAt)))
    .orderBy(asc(sellers.name));

  // 2. Active sellers NOT yet assigned to this raffle.
  const assignedIds = assigned.map((s) => s.id);
  const available: AvailableSeller[] = await db
    .select({ id: sellers.id, name: sellers.name })
    .from(sellers)
    .where(
      assignedIds.length === 0
        ? isNull(sellers.deletedAt)
        : and(isNull(sellers.deletedAt), notInArray(sellers.id, assignedIds))
    )
    .orderBy(asc(sellers.name));

  return { assigned, available };
}
