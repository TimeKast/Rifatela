/**
 * Public Raffle Landing — SCR-008 / SCR-009 (RIF-023)
 *
 * `/r/{publicSlug}` — the link the organizer shares via WhatsApp. Public,
 * no auth, no PII. Three states co-located here:
 *
 *   - status='open'   → hero + countdown + grid + commit-reveal footer
 *   - status='open' + soldCount == maxTickets → "BOLETOS AGOTADOS" banner
 *   - status='drawn'  → winner card + grid highlighting the winner
 *                       (placeholder — full SCR-009 visuals land with the
 *                        draw flow in RIF-026)
 *
 * BR-015: archived raffles still render with 200 — the WhatsApp link a
 * friend pasted two months ago must not break.
 *
 * BR-009: tickets carry only `buyerInitials`; phone/email never reach the
 * page (enforced by `getRaffleTickets`). PII smoke = there is no place
 * here to leak a buyer's contact, by construction.
 *
 * @see project/planning/15_DESIGN.md SCR-008, SCR-009
 * @see project/planning/05_BUSINESS_RULES.md (BR-006, BR-009, BR-015)
 * @see project/backlog/epics/EPIC-003-public-view-and-draw/issues/RIF-023-public-landing-open.md
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Countdown } from '@/components/raffles/Countdown';
import { CommitRevealBadge, SeedCommitDisplay } from '@/components/raffles/SeedCommitDisplay';
import { TicketGrid } from '@/components/tickets/TicketGrid';
import { getPublicRaffle } from '@/lib/raffles/get-public-raffle';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicRaffle(slug);
  if (!data) {
    return { title: 'Rifa no encontrada — Rifatela' };
  }
  const { raffle, prize } = data;
  const description = prize?.text
    ? `${prize.text} · ${raffle.maxTickets} boletos · Sorteo verificable`
    : `${raffle.maxTickets} boletos · Sorteo verificable`;
  return {
    title: `${raffle.name} — Rifatela`,
    description,
    openGraph: {
      title: raffle.name,
      description,
      images: prize?.imageUrl ? [{ url: prize.imageUrl }] : undefined,
      type: 'website',
    },
  };
}

export default async function PublicRafflePage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getPublicRaffle(slug);
  if (!data) notFound();

  const { raffle, prize, tickets, soldCount } = data;
  const now = new Date();

  const isArchived = raffle.deletedAt !== null;
  const isDrawn = raffle.status === 'drawn';
  const isSoldOut = soldCount === raffle.maxTickets;
  const soldPct = Math.round((soldCount / raffle.maxTickets) * 100);

  return (
    <main className="bg-background text-foreground min-h-screen px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <p
            className="text-primary text-2xl tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Rifatela
          </p>
        </header>

        {/* HERO */}
        <section className="bg-card border-border rounded-lg border p-5 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            {prize?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={prize.imageUrl}
                alt={`Premio: ${prize.text}`}
                className="border-border h-32 w-32 shrink-0 rounded-md border object-cover sm:h-44 sm:w-44"
              />
            ) : (
              <div className="border-border bg-muted text-muted-foreground flex h-32 w-32 shrink-0 items-center justify-center rounded-md border text-xs sm:h-44 sm:w-44">
                Sin imagen
              </div>
            )}

            <div className="flex-1 space-y-3">
              <h1
                className="text-foreground text-2xl tracking-tight sm:text-4xl"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {raffle.name}
              </h1>
              {prize?.text && <p className="text-foreground text-base">{prize.text}</p>}

              <div className="border-border border-t pt-3">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">
                  {isDrawn ? 'Sorteada' : 'Sorteo en'}
                </p>
                <Countdown targetDate={raffle.drawDate} serverNow={now} />
              </div>
            </div>
          </div>
        </section>

        {/* Sold-out banner */}
        {!isDrawn && isSoldOut && (
          <section className="border-warning/40 bg-warning/15 text-foreground rounded-lg border px-4 py-3 text-sm font-medium">
            🎟️ BOLETOS AGOTADOS — el sorteo se ejecuta cuando termine la cuenta regresiva.
          </section>
        )}

        {/* Drawn-state placeholder */}
        {isDrawn && raffle.winnerTicketId && (
          <section className="border-success/40 bg-success/10 text-foreground rounded-lg border px-4 py-4 text-center">
            <p className="text-muted-foreground text-xs tracking-wide uppercase">Ganador</p>
            <p className="text-foreground mt-1 text-2xl font-bold">
              Boleto #{tickets.find((t) => t.id === raffle.winnerTicketId)?.number ?? '—'}
            </p>
          </section>
        )}

        {/* Counter */}
        <section className="bg-card border-border rounded-lg border p-4">
          <div className="text-muted-foreground mb-2 flex items-center justify-between text-sm">
            <span>
              <span className="text-foreground font-semibold">{soldCount}</span> vendidos ·{' '}
              <span className="text-foreground font-semibold">{raffle.maxTickets - soldCount}</span>{' '}
              disponibles
            </span>
            <span className="text-foreground font-semibold">{soldPct}%</span>
          </div>
          <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
            <div
              className={`h-full transition-all ${soldPct >= 90 ? 'bg-primary' : 'bg-secondary'}`}
              style={{ width: `${Math.min(soldPct, 100)}%` }}
            />
          </div>
        </section>

        {/* Ticket grid — public variant */}
        <section>
          <h2 className="text-foreground mb-3 text-sm font-semibold uppercase">Boletos</h2>
          <TicketGrid
            tickets={tickets}
            variant="public"
            winnerTicketId={isDrawn ? raffle.winnerTicketId : null}
          />
        </section>

        {/* Commit-reveal footer */}
        <footer className="border-border space-y-2 border-t pt-5 text-sm">
          <div className="flex items-center gap-3">
            <CommitRevealBadge />
          </div>
          <div className="text-muted-foreground space-y-1 text-xs">
            <p>
              Huella del sorteo (sha256): <SeedCommitDisplay value={raffle.seedCommit} />
            </p>
            {raffle.rngSeed && (
              <p>
                Semilla revelada: <SeedCommitDisplay value={raffle.rngSeed} />
              </p>
            )}
          </div>
          {isArchived && (
            <p className="text-muted-foreground text-xs italic">
              Esta rifa está archivada. La página sigue accesible para verificación.
            </p>
          )}
        </footer>
      </div>
    </main>
  );
}
