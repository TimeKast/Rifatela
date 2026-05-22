/**
 * Get Raffle Tickets for Public/Vendor Grid (RIF-019)
 *
 * Returns all tickets for a raffle, ordered by number ASC, joined with the
 * buyer's name (reduced to initials at the boundary). NEVER returns
 * buyer.phone or buyer.email — BR-009 enforced at the data layer, not just
 * the UI, so a future caller cannot accidentally pipe PII to a public view.
 *
 * Shape is intentionally minimal — the `TicketGrid` only needs id, number,
 * status, and the "what to render in a sold cell" hint (initials).
 *
 * @see project/planning/05_BUSINESS_RULES.md (BR-009)
 * @see project/planning/06_DATA_MODEL.md (E-005 Ticket, E-004 Buyer)
 */

import { eq } from 'drizzle-orm';

import { db } from '@/lib/db/drizzle';
import { buyers, tickets } from '@/lib/db/schema';
import { publicInitials } from '@/lib/buyers/initials';

export interface RaffleTicket {
  id: string;
  number: number;
  status: 'available' | 'sold';
  /** Pre-computed via `publicInitials()`. "Anónimo" when buyer.name is null. */
  buyerInitials: string | null;
}

export async function getRaffleTickets(raffleId: string): Promise<RaffleTicket[]> {
  const rows = await db
    .select({
      id: tickets.id,
      number: tickets.number,
      status: tickets.status,
      buyerName: buyers.name,
    })
    .from(tickets)
    .leftJoin(buyers, eq(tickets.buyerId, buyers.id))
    .where(eq(tickets.raffleId, raffleId))
    .orderBy(tickets.number);

  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    status: r.status,
    buyerInitials: r.status === 'sold' ? publicInitials(r.buyerName) : null,
  }));
}
