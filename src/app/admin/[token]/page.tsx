/**
 * Admin Dashboard — SCR-001 (RIF-009)
 *
 * Lists all Rifatela raffles owned by the admin, with key metrics per row.
 * Access controlled at the middleware layer (RIF-007) — this RSC runs only
 * after `ADMIN_ACCESS_TOKEN` matched the `[token]` path segment.
 *
 * URL: `/admin/{ADMIN_ACCESS_TOKEN}`
 * Optional: `?archived=true` toggles soft-deleted raffles in the list.
 *
 * Placeholders:
 *   - `<RaffleCard>` is inlined here. Extracted to a real component in RIF-015.
 *   - Empty-state copy is inline. Component in RIF-038.
 *
 * @see project/planning/15_DESIGN.md SCR-001
 * @see project/backlog/epics/EPIC-002-core-loop/issues/RIF-009-admin-dashboard-listing.md
 */

import Link from 'next/link';

import { listRaffles, type RaffleListEntry } from '@/lib/raffles/list-raffles';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<RaffleListEntry['status'], string> = {
  draft: 'Borrador',
  open: 'Abierta',
  drawn: 'Sorteada',
};

const STATUS_CLASSES: Record<RaffleListEntry['status'], string> = {
  draft: 'bg-muted text-muted-foreground',
  open: 'bg-success/15 text-success',
  drawn: 'bg-accent text-accent-foreground',
};

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ archived?: string }>;
}

export default async function AdminDashboardPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { archived } = await searchParams;
  const includeArchived = archived === 'true';

  const raffleList = await listRaffles({ includeArchived });
  // Captured once per request — cards use this for "days remaining" to keep
  // the render pure (React 19 purity rule disallows Date.now() inside render).
  const now = new Date();

  return (
    <main className="bg-background text-foreground min-h-screen px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-col gap-1 sm:mb-10 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div>
            <h1
              className="text-primary text-3xl tracking-tight sm:text-5xl"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Rifatela
            </h1>
            <p className="text-muted-foreground text-sm">Panel del organizador</p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/admin/${token}/sellers`}
              className="text-foreground hover:text-primary focus-ring text-sm underline transition-colors"
            >
              Vendedores
            </Link>
            <Link
              href={`/admin/${token}/raffles/new`}
              className="bg-primary text-primary-foreground hover:bg-primary-hover focus-ring inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-semibold transition-colors"
            >
              + Nueva rifa
            </Link>
          </div>
        </header>

        <ArchiveToggle token={token} includeArchived={includeArchived} />

        {raffleList.length === 0 ? (
          <EmptyState token={token} includeArchived={includeArchived} />
        ) : (
          <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {raffleList.map((raffle) => (
              <li key={raffle.id}>
                <RaffleCardPlaceholder raffle={raffle} token={token} now={now} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components (inline placeholders — extracted in RIF-015 / RIF-038)
// ─────────────────────────────────────────────────────────────────────────────

function ArchiveToggle({ token, includeArchived }: { token: string; includeArchived: boolean }) {
  const baseHref = `/admin/${token}`;
  return (
    <nav aria-label="Filtro de rifas" className="text-sm">
      <div className="bg-card border-border inline-flex overflow-hidden rounded-md border">
        <Link
          href={baseHref}
          className={`px-3 py-1.5 transition-colors ${
            !includeArchived
              ? 'bg-primary text-primary-foreground'
              : 'text-foreground hover:bg-muted'
          }`}
          aria-current={!includeArchived ? 'page' : undefined}
        >
          Activas
        </Link>
        <Link
          href={`${baseHref}?archived=true`}
          className={`border-border border-l px-3 py-1.5 transition-colors ${
            includeArchived
              ? 'bg-primary text-primary-foreground'
              : 'text-foreground hover:bg-muted'
          }`}
          aria-current={includeArchived ? 'page' : undefined}
        >
          Incluir archivadas
        </Link>
      </div>
    </nav>
  );
}

function RaffleCardPlaceholder({
  raffle,
  token,
  now,
}: {
  raffle: RaffleListEntry;
  token: string;
  now: Date;
}) {
  const soldPct = Math.round((raffle.soldCount / raffle.maxTickets) * 100);
  const daysRemaining = Math.ceil(
    (raffle.drawDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
  );
  const isArchived = raffle.deletedAt !== null;

  return (
    <Link
      href={`/admin/${token}/raffles/${raffle.id}`}
      className={`bg-card border-border focus-ring block rounded-lg border p-5 transition-all hover:shadow-md ${
        isArchived ? 'opacity-60' : ''
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="text-foreground text-lg leading-tight font-semibold">{raffle.name}</h2>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[raffle.status]}`}
        >
          {STATUS_LABEL[raffle.status]}
        </span>
      </div>

      <div className="text-muted-foreground space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span>
            {raffle.soldCount} / {raffle.maxTickets} vendidos
          </span>
          <span className="text-foreground font-medium">{soldPct}%</span>
        </div>

        <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
          <div
            className={`h-full transition-all ${soldPct >= 90 ? 'bg-primary' : 'bg-secondary'}`}
            style={{ width: `${Math.min(soldPct, 100)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs">
          <span>{raffle.sellersCount} vendedor(es)</span>
          <span>
            {raffle.status === 'drawn'
              ? 'Sorteada'
              : daysRemaining <= 0
                ? '¡Hora del sorteo!'
                : `${daysRemaining} día(s)`}
          </span>
        </div>

        {isArchived && <span className="text-muted-foreground text-xs italic">Archivada</span>}
      </div>
    </Link>
  );
}

function EmptyState({ token, includeArchived }: { token: string; includeArchived: boolean }) {
  if (includeArchived) {
    return (
      <div className="text-muted-foreground mt-12 text-center text-sm">
        No hay rifas archivadas todavía.
        <Link href={`/admin/${token}`} className="text-primary ml-2 underline">
          Volver a activas
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-card border-border mt-10 rounded-lg border p-8 text-center sm:p-12">
      <h2 className="text-foreground text-2xl" style={{ fontFamily: 'var(--font-display)' }}>
        Aún no tienes rifas
      </h2>
      <p className="text-muted-foreground mx-auto mt-3 max-w-md text-sm">
        Crea la primera y compártela en tu grupo de WhatsApp.
      </p>
      <Link
        href={`/admin/${token}/raffles/new`}
        className="bg-primary text-primary-foreground hover:bg-primary-hover focus-ring mt-6 inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-semibold transition-colors"
      >
        Crear rifa
      </Link>
    </div>
  );
}
