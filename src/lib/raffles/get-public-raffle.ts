/**
 * Get Public Raffle (RIF-023 — SCR-008/009)
 *
 * Read-only fetcher for the public landing `/r/{publicSlug}`. Returns
 * everything the page needs in one shot:
 *   - raffle row (status, drawDate, maxTickets, seedCommit, rngSeed,
 *     winnerTicketId, deletedAt for BR-015 display)
 *   - prize (text + imageUrl) if any
 *   - tickets reduced to public-safe shape (id, number, status, initials)
 *
 * BR-015: archived raffles (deletedAt non-null) STILL resolve with 200 —
 * the link a friend pasted in WhatsApp two months ago shouldn't break.
 * The page can show an "archived" hint visually but the data is returned.
 *
 * BR-009: only `buyerInitials` is exposed. `getRaffleTickets` already
 * enforces this at the data layer — phone/email never reach the boundary.
 *
 * @see project/planning/05_BUSINESS_RULES.md (BR-009, BR-015)
 * @see project/planning/06_DATA_MODEL.md (E-001, E-002, E-005)
 */

import { and, eq } from 'drizzle-orm';

import { db } from '@/lib/db/drizzle';
import { buyers, prizes, raffles, tickets, type Raffle } from '@/lib/db/schema';
import { getRaffleTickets, type RaffleTicket } from '@/lib/raffles/get-raffle-tickets';

export interface PublicPrize {
  text: string;
  imageUrl: string | null;
}

export interface PublicWinner {
  ticketId: string;
  number: number;
  /** Full name (BR-009 exception per DD-010). Null = anonymous. */
  buyerName: string | null;
}

export interface PublicRaffle {
  raffle: Raffle;
  prize: PublicPrize | null;
  tickets: RaffleTicket[];
  soldCount: number;
  /** Only populated when raffle.status === 'drawn'. */
  winner: PublicWinner | null;
}

export async function getPublicRaffle(publicSlug: string): Promise<PublicRaffle | null> {
  const [raffle] = await db
    .select()
    .from(raffles)
    .where(eq(raffles.publicSlug, publicSlug))
    .limit(1);
  if (!raffle) return null;

  const [prize] = await db
    .select({ text: prizes.text, imageUrl: prizes.imageUrl })
    .from(prizes)
    .where(eq(prizes.raffleId, raffle.id))
    .limit(1);

  const ticketsForGrid = await getRaffleTickets(raffle.id);
  const soldCount = ticketsForGrid.filter((t) => t.status === 'sold').length;

  // Resolve winner details when drawn. BR-009 carves out an exception
  // for the winner: their full name is shown publicly (DD-010). Anonymous
  // buyers (no name) render as "Anónimo" at the UI layer.
  let winner: PublicWinner | null = null;
  if (raffle.status === 'drawn' && raffle.winnerTicketId) {
    const [row] = await db
      .select({
        ticketId: tickets.id,
        number: tickets.number,
        buyerName: buyers.name,
      })
      .from(tickets)
      .leftJoin(buyers, eq(tickets.buyerId, buyers.id))
      .where(and(eq(tickets.id, raffle.winnerTicketId), eq(tickets.raffleId, raffle.id)))
      .limit(1);
    if (row) {
      winner = {
        ticketId: row.ticketId,
        number: row.number,
        buyerName: row.buyerName,
      };
    }
  }

  return {
    raffle,
    prize: prize ?? null,
    tickets: ticketsForGrid,
    soldCount,
    winner,
  };
}
