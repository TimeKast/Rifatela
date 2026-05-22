/**
 * Admin Raffle Detail — SCR-003 / RIF-012
 *
 * Per-raffle dashboard for the admin: hero (prize + countdown), public URL
 * with copy button, active sellers + sales count, sold-tickets table, and
 * admin-action history. Two CTAs surface based on raffle state:
 *
 *   - `status='open'` + `draw_date <= now`  →  "¡Hora del sorteo!" banner
 *      linking to /admin/{token}/raffles/{id}/draw  (RIF-030, placeholder)
 *
 *   - `status='drawn'`                       →  Winner card showing the
 *      ticket number + full name (BR-009 exception for the winner only).
 *
 * Placeholders inline:
 *   - RaffleCard (detail-header variant)  → RIF-015 extracts component
 *   - AdminActionLog                       → RIF-036 extracts component
 *   - TicketGrid (admin-detail variant)    → RIF-019 extracts component
 *
 * Access is gated by middleware (RIF-007) against `ADMIN_ACCESS_TOKEN`.
 * Sub-route segment `[id]` is the raffle UUID.
 *
 * @see project/planning/15_DESIGN.md SCR-003
 * @see project/backlog/epics/EPIC-002-core-loop/issues/RIF-012-admin-raffle-detail.md
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';

import { CopyToClipboardButton } from '@/components/shared/CopyToClipboardButton';
import {
  getRaffleDetail,
  type RaffleDetail,
  type SoldTicketRow,
} from '@/lib/raffles/get-raffle-detail';
import type { AdminAction } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string; id: string }>;
}

const STATUS_LABEL: Record<RaffleDetail['raffle']['status'], string> = {
  draft: 'Borrador',
  open: 'Abierta',
  drawn: 'Sorteada',
};

const STATUS_CLASSES: Record<RaffleDetail['raffle']['status'], string> = {
  draft: 'bg-muted text-muted-foreground',
  open: 'bg-success/15 text-success',
  drawn: 'bg-accent text-accent-foreground',
};

const ACTION_LABEL: Record<AdminAction['actionType'], string> = {
  revert_sale: 'Venta revertida',
  rotate_seller_token: 'URL de vendedor rotada',
  archive_raffle: 'Rifa archivada',
  archive_seller: 'Vendedor archivado',
  edit_raffle: 'Rifa editada',
};

export default async function AdminRaffleDetailPage({ params }: PageProps) {
  const { token, id } = await params;
  const detail = await getRaffleDetail(id);

  if (!detail) {
    notFound();
  }

  const { raffle, prize, soldTickets, availableCount, adminActions } = detail;
  const now = new Date();
  const soldCount = soldTickets.length;
  const totalTickets = raffle.maxTickets;
  const soldPct = Math.round((soldCount / totalTickets) * 100);

  const daysRemaining = Math.ceil(
    (raffle.drawDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
  );
  const drawDateReached = raffle.drawDate.getTime() <= now.getTime();

  const sellerStats = buildSellerStats(soldTickets);

  // Compose the public URL from NEXT_PUBLIC_APP_URL or fall back to a
  // relative path the user can copy + paste manually.
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const publicUrl = origin ? `${origin}/r/${raffle.publicSlug}` : `/r/${raffle.publicSlug}`;

  const isArchived = raffle.deletedAt !== null;
  const winner = raffle.winnerTicketId
    ? (soldTickets.find((t) => t.id === raffle.winnerTicketId) ?? null)
    : null;

  return (
    <main className="bg-background text-foreground min-h-screen px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <nav className="text-muted-foreground text-sm">
          <Link href={`/admin/${token}`} className="hover:text-foreground transition-colors">
            ← Volver al panel
          </Link>
        </nav>

        {/* HERO — RaffleCard detail-header placeholder */}
        <section className="bg-card border-border rounded-lg border p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            {prize?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={prize.imageUrl}
                alt={`Premio: ${prize.text}`}
                className="border-border h-32 w-32 shrink-0 rounded-md border object-cover sm:h-40 sm:w-40"
              />
            ) : (
              <div className="border-border bg-muted text-muted-foreground flex h-32 w-32 shrink-0 items-center justify-center rounded-md border text-xs sm:h-40 sm:w-40">
                Sin imagen
              </div>
            )}

            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h1
                  className="text-foreground text-2xl tracking-tight sm:text-3xl"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {raffle.name}
                </h1>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[raffle.status]}`}
                >
                  {STATUS_LABEL[raffle.status]}
                </span>
              </div>

              {prize?.text ? <p className="text-foreground text-base">{prize.text}</p> : null}

              <dl className="text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs uppercase">Vendidos</dt>
                  <dd className="text-foreground font-semibold">
                    {soldCount} / {totalTickets}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase">% vendido</dt>
                  <dd className="text-foreground font-semibold">{soldPct}%</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase">Vendedores</dt>
                  <dd className="text-foreground font-semibold">{sellerStats.length}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase">Sorteo</dt>
                  <dd className="text-foreground font-semibold">
                    {raffle.status === 'drawn'
                      ? 'Sorteada'
                      : daysRemaining <= 0
                        ? 'Hoy o antes'
                        : `${daysRemaining} día(s)`}
                  </dd>
                </div>
              </dl>

              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div
                  className={`h-full transition-all ${soldPct >= 90 ? 'bg-primary' : 'bg-secondary'}`}
                  style={{ width: `${Math.min(soldPct, 100)}%` }}
                />
              </div>

              {isArchived ? (
                <p className="text-muted-foreground text-xs italic">
                  Esta rifa está archivada. Su URL pública sigue accesible.
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {/* Public URL */}
        <section className="bg-card border-border rounded-lg border p-5">
          <h2 className="text-foreground mb-3 text-sm font-semibold uppercase">URL pública</h2>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <code className="bg-muted text-foreground flex-1 truncate rounded-md px-3 py-2 font-mono text-sm">
              {publicUrl}
            </code>
            <CopyToClipboardButton value={publicUrl} label="Copiar URL" />
            <Link
              href={`/r/${raffle.publicSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring border-border bg-card text-foreground hover:bg-muted inline-flex h-9 items-center justify-center rounded-md border px-3 text-xs font-medium transition-colors"
            >
              Abrir
            </Link>
          </div>
        </section>

        {/* Draw CTA — only when /open + draw date passed */}
        {raffle.status === 'open' && drawDateReached ? (
          <section className="bg-accent text-accent-foreground rounded-lg p-5 sm:p-6">
            <h2 className="text-2xl" style={{ fontFamily: 'var(--font-display)' }}>
              🎯 ¡Hora del sorteo!
            </h2>
            <p className="mt-1 text-sm">
              La fecha del sorteo llegó. Cuando estés listo, ejecutalo.
            </p>
            <Link
              href={`/admin/${token}/raffles/${raffle.id}/draw`}
              className="bg-foreground text-background hover:bg-foreground/90 focus-ring mt-4 inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-semibold transition-colors"
            >
              Ejecutar sorteo
            </Link>
          </section>
        ) : null}

        {/* Winner card — only when drawn */}
        {raffle.status === 'drawn' && winner ? (
          <section className="bg-accent text-accent-foreground rounded-lg p-5 sm:p-6">
            <p className="text-xs tracking-wide uppercase">Ganador</p>
            <p
              className="mt-1 text-4xl tracking-tight sm:text-6xl"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              #{winner.number}
            </p>
            <p className="mt-1 text-base">
              {/* BR-009 exception: winner shows full name, not initials. */}
              {winner.buyer?.name ?? 'Anónimo'}
              {winner.seller ? (
                <span className="opacity-75"> · Vendido por {winner.seller.name}</span>
              ) : null}
            </p>
          </section>
        ) : null}

        {/* Sellers summary */}
        <section className="bg-card border-border rounded-lg border p-5">
          <h2 className="text-foreground mb-3 text-sm font-semibold uppercase">
            Vendedores ({sellerStats.length})
          </h2>
          {sellerStats.length === 0 ? (
            <p className="text-muted-foreground text-sm">Todavía no hay ventas en esta rifa.</p>
          ) : (
            <ul className="divide-border divide-y">
              {sellerStats.map((s) => (
                <li
                  key={s.sellerId}
                  className="text-foreground flex items-center justify-between py-2 text-sm"
                >
                  <span>{s.sellerName}</span>
                  <span className="text-muted-foreground">
                    {s.count} boleto(s) · {Math.round((s.count / totalTickets) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Sold tickets list */}
        <section className="bg-card border-border rounded-lg border p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-foreground text-sm font-semibold uppercase">Boletos vendidos</h2>
            <p className="text-muted-foreground text-xs">
              {availableCount} disponibles · {soldCount} vendidos
            </p>
          </div>

          {soldTickets.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aún no se vendió ningún boleto.</p>
          ) : (
            <SoldTicketsTable tickets={soldTickets} />
          )}
        </section>

        {/* AdminAction log — RIF-036 will extract component */}
        <section className="bg-card border-border rounded-lg border p-5">
          <h2 className="text-foreground mb-3 text-sm font-semibold uppercase">
            Historial administrativo
          </h2>
          {adminActions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Sin acciones administrativas registradas.
            </p>
          ) : (
            <ul className="divide-border divide-y text-sm">
              {adminActions.map((a) => (
                <li key={a.id} className="text-foreground flex items-center justify-between py-2">
                  <span>{ACTION_LABEL[a.actionType]}</span>
                  <time className="text-muted-foreground text-xs">
                    {formatRelative(a.createdAt, now)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components + helpers — inlined until proper extraction
// ─────────────────────────────────────────────────────────────────────────────

interface SellerStat {
  sellerId: string;
  sellerName: string;
  count: number;
}

function buildSellerStats(soldTickets: SoldTicketRow[]): SellerStat[] {
  const byId = new Map<string, SellerStat>();
  for (const t of soldTickets) {
    if (!t.seller) continue;
    const entry = byId.get(t.seller.id) ?? {
      sellerId: t.seller.id,
      sellerName: t.seller.name,
      count: 0,
    };
    entry.count += 1;
    byId.set(t.seller.id, entry);
  }
  return Array.from(byId.values()).sort((a, b) => b.count - a.count);
}

function SoldTicketsTable({ tickets }: { tickets: SoldTicketRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-muted-foreground text-xs uppercase">
          <tr>
            <th className="px-2 py-2 text-left font-medium">#</th>
            <th className="px-2 py-2 text-left font-medium">Comprador</th>
            <th className="hidden px-2 py-2 text-left font-medium sm:table-cell">Vendedor</th>
            <th className="hidden px-2 py-2 text-left font-medium md:table-cell">Fecha</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {tickets.map((t) => (
            <tr key={t.id} className="text-foreground">
              <td className="px-2 py-2 font-mono">{t.number}</td>
              <td className="px-2 py-2">{t.buyer?.name ?? 'Anónimo'}</td>
              <td className="text-muted-foreground hidden px-2 py-2 sm:table-cell">
                {t.seller?.name ?? '—'}
              </td>
              <td className="text-muted-foreground hidden px-2 py-2 text-xs md:table-cell">
                {t.soldAt ? t.soldAt.toLocaleString('es-AR') : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatRelative(date: Date, now: Date): string {
  const diffMs = now.getTime() - date.getTime();
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'hace segundos';
  if (minutes < 60) return `hace ${minutes} min`;
  if (hours < 24) return `hace ${hours}h`;
  if (days < 30) return `hace ${days}d`;
  return date.toLocaleDateString('es-AR');
}
