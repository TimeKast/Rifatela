/**
 * Seller Portal — SCR-006 (RIF-017)
 *
 * Vendor's main workspace. Reached via `/v/{accessToken}` — the URL secret
 * IS the auth (ADR-003). The RSC:
 *   1. Resolves the token to an active seller. Invalid OR archived
 *      → `notFound()` (ambiguous, per BR-013).
 *   2. Picks the latest active raffle (status='open', not soft-deleted).
 *      No raffles yet → friendly empty state.
 *   3. Fetches the ticket grid for that raffle.
 *   4. Binds `registerBuyer` and `claimTicket` to the seller token via
 *      `.bind(null, token)` so the token never appears in form payloads.
 *
 * Note on multi-raffle: the design (SCR-006) supports a raffle selector
 * for the rare case of multiple active raffles. MVP picks the most recent
 * one and shows only that — selector deferred until a customer needs it.
 *
 * @see project/planning/15_DESIGN.md SCR-006
 * @see project/planning/05_BUSINESS_RULES.md (BR-013 archived seller)
 * @see project/planning/07_ARCHITECTURE.md (ADR-003 URL-secret auth)
 */

import { and, desc, eq, isNull } from 'drizzle-orm';
import { notFound } from 'next/navigation';

import { SellerPanel } from '@/components/sellers/SellerPanel';
import { registerBuyer } from '@/lib/actions/sales/register-buyer';
import { claimTicket } from '@/lib/actions/sales/claim-ticket';
import { db } from '@/lib/db/drizzle';
import { raffles } from '@/lib/db/schema';
import { getRaffleTickets } from '@/lib/raffles/get-raffle-tickets';
import { getSellerByToken } from '@/lib/sellers/get-seller-by-token';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SellerPortalPage({ params }: PageProps) {
  const { token } = await params;

  // 1. Token → seller. Ambiguous 404 for invalid OR archived (BR-013).
  const seller = await getSellerByToken(token);
  if (!seller) notFound();

  // 2. Pick the most recent open, non-archived raffle.
  //    MVP heuristic: single-tenant, latest raffle is the relevant one.
  const [raffle] = await db
    .select({
      id: raffles.id,
      name: raffles.name,
      maxTickets: raffles.maxTickets,
      drawDate: raffles.drawDate,
    })
    .from(raffles)
    .where(and(eq(raffles.status, 'open'), isNull(raffles.deletedAt)))
    .orderBy(desc(raffles.createdAt))
    .limit(1);

  if (!raffle) {
    return <NoActiveRaffle sellerName={seller.name} />;
  }

  // 3. Tickets for the active raffle.
  const tickets = await getRaffleTickets(raffle.id);
  const soldCount = tickets.filter((t) => t.status === 'sold').length;

  // 4. Bind the seller token to the actions so it never reaches form data.
  const boundRegisterBuyer = registerBuyer.bind(null, token);
  const boundClaimTicket = claimTicket.bind(null, token);

  return (
    <main className="bg-background text-foreground min-h-screen px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 sm:mb-8">
          <h1
            className="text-primary text-3xl tracking-tight sm:text-4xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Rifatela
          </h1>
          <p className="text-muted-foreground text-sm">Panel del vendedor</p>
        </header>

        <SellerPanel
          sellerName={seller.name}
          raffle={{
            id: raffle.id,
            name: raffle.name,
            maxTickets: raffle.maxTickets,
            soldCount,
          }}
          tickets={tickets}
          registerBuyer={boundRegisterBuyer}
          claimTicket={boundClaimTicket}
        />
      </div>
    </main>
  );
}

function NoActiveRaffle({ sellerName }: { sellerName: string }) {
  return (
    <main className="bg-background text-foreground min-h-screen px-4 py-10">
      <div className="mx-auto max-w-md text-center">
        <h1
          className="text-primary text-3xl tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Rifatela
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Hola, {sellerName}</p>

        <div className="bg-card border-border mt-8 rounded-lg border p-8">
          <h2 className="text-foreground text-xl" style={{ fontFamily: 'var(--font-display)' }}>
            Aún no hay rifas activas
          </h2>
          <p className="text-muted-foreground mx-auto mt-3 text-sm">
            Pídele a la organizadora que cree una. Cuando esté lista, aparecerá acá automáticamente.
          </p>
        </div>
      </div>
    </main>
  );
}
