/**
 * Seller Portal — SCR-006 (RIF-017) + raffle-seller assignment filter
 *
 * Vendor's main workspace. Reached via `/v/{accessToken}` — the URL secret
 * IS the auth (ADR-003). The RSC:
 *   1. Resolves the token to an active seller. Invalid OR archived
 *      → `notFound()` (ambiguous, per BR-013).
 *   2. Lists the OPEN, non-archived raffles assigned to THIS seller via
 *      the `raffle_sellers` junction (E-007, BR-016).
 *   3. Selects which raffle to focus on (query param `?raffleId=...`,
 *      else the most recently created assigned raffle).
 *   4. Fetches the ticket grid for the selected raffle.
 *   5. Binds `registerBuyer` and `claimTicket` to the seller token via
 *      `.bind(null, token)` so the token never appears in form payloads.
 *
 * Multi-raffle UX: when the seller is assigned to ≥2 open raffles, a
 * sub-header selector lets them switch via `?raffleId=...`. URL-based,
 * RSC-friendly, no client state required.
 *
 * @see project/planning/15_DESIGN.md SCR-006
 * @see project/planning/05_BUSINESS_RULES.md (BR-013 archived, BR-016 assigned-only)
 * @see project/planning/07_ARCHITECTURE.md (ADR-003 URL-secret auth)
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SellerPanel } from '@/components/sellers/SellerPanel';
import { registerBuyer } from '@/lib/actions/sales/register-buyer';
import { claimTicket } from '@/lib/actions/sales/claim-ticket';
import { getRaffleTickets } from '@/lib/raffles/get-raffle-tickets';
import { listRafflesForSeller, type SellerRaffle } from '@/lib/raffles/list-raffles-for-seller';
import { getSellerByToken } from '@/lib/sellers/get-seller-by-token';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ raffleId?: string }>;
}

export default async function SellerPortalPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { raffleId: requestedRaffleId } = await searchParams;

  // 1. Token → seller. Ambiguous 404 for invalid OR archived (BR-013).
  const seller = await getSellerByToken(token);
  if (!seller) notFound();

  // 2. Raffles this seller is allowed to operate on.
  const assignedRaffles = await listRafflesForSeller(seller.id);

  if (assignedRaffles.length === 0) {
    return <NoAssignedRaffles sellerName={seller.name} />;
  }

  // 3. Pick the active raffle: requested via query param (if valid), else
  //    the most recent (listRafflesForSeller already returns desc(createdAt)).
  const activeRaffle =
    (requestedRaffleId && assignedRaffles.find((r) => r.id === requestedRaffleId)) ||
    assignedRaffles[0]!;

  // 4. Tickets for the active raffle.
  const tickets = await getRaffleTickets(activeRaffle.id);
  const soldCount = tickets.filter((t) => t.status === 'sold').length;

  // 5. Bind the seller token to the actions so it never reaches form data.
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

        {assignedRaffles.length > 1 && (
          <RaffleSelector
            token={token}
            raffles={assignedRaffles}
            activeRaffleId={activeRaffle.id}
          />
        )}

        <SellerPanel
          sellerName={seller.name}
          raffle={{
            id: activeRaffle.id,
            name: activeRaffle.name,
            maxTickets: activeRaffle.maxTickets,
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

function RaffleSelector({
  token,
  raffles,
  activeRaffleId,
}: {
  token: string;
  raffles: SellerRaffle[];
  activeRaffleId: string;
}) {
  return (
    <nav aria-label="Cambiar de rifa" className="mb-6">
      <p className="text-muted-foreground mb-2 text-xs tracking-wide uppercase">
        Tus rifas asignadas
      </p>
      <div className="flex flex-wrap gap-2">
        {raffles.map((r) => {
          const isActive = r.id === activeRaffleId;
          return (
            <Link
              key={r.id}
              href={`/v/${token}?raffleId=${r.id}`}
              className={`focus-ring rounded-md border px-3 py-1.5 text-sm transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border bg-card text-foreground hover:bg-muted'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {r.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function NoAssignedRaffles({ sellerName }: { sellerName: string }) {
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
            Aún no tienes rifas asignadas
          </h2>
          <p className="text-muted-foreground mx-auto mt-3 text-sm">
            Pídele a la organizadora que te asigne a una rifa. Cuando lo haga, aparecerá acá
            automáticamente.
          </p>
        </div>
      </div>
    </main>
  );
}
