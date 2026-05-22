'use client';

/**
 * SellersManagement — RIF-013
 *
 * Client component that renders the sellers admin page (SCR-005):
 *   - Create form at top (new seller → emits URL banner)
 *   - Active sellers list with per-row Rotate + Archive actions
 *   - Archived sellers list (optional toggle via URL searchParam handled by page)
 *
 * Three useActionState hooks — one per action. Inline banners surface
 * action results (success URLs, errors). Archive uses native confirm()
 * for MVP simplicity; CMP-009 ConfirmDialog will replace it later.
 *
 * @see project/planning/15_DESIGN.md SCR-005
 * @see project/backlog/epics/EPIC-002-core-loop/issues/RIF-013-admin-sellers-management.md
 */

import { useEffect, useRef } from 'react';
import { useActionState } from 'react';
import Link from 'next/link';

import { CopyToClipboardButton } from '@/components/shared/CopyToClipboardButton';
import type { ActionResult } from '@/lib/actions/types';
import type {
  ArchiveSellerResult,
  CreateSellerResult,
  RotateSellerResult,
} from '@/lib/actions/sellers';
import type { SellerListEntry } from '@/lib/sellers/list-sellers';

type CreateState = ActionResult<CreateSellerResult> | null;
type RotateState = ActionResult<RotateSellerResult> | null;
type ArchiveState = ActionResult<ArchiveSellerResult> | null;

interface Props {
  token: string;
  origin: string;
  activeSellers: SellerListEntry[];
  archivedSellers: SellerListEntry[];
  showArchived: boolean;
  createAction: (state: CreateState, formData: FormData) => Promise<CreateState>;
  rotateAction: (state: RotateState, formData: FormData) => Promise<RotateState>;
  archiveAction: (state: ArchiveState, formData: FormData) => Promise<ArchiveState>;
}

function sellerUrl(origin: string, accessToken: string): string {
  return origin ? `${origin}/v/${accessToken}` : `/v/${accessToken}`;
}

export function SellersManagement({
  token,
  origin,
  activeSellers,
  archivedSellers,
  showArchived,
  createAction,
  rotateAction,
  archiveAction,
}: Props) {
  const [createState, createFormAction, creating] = useActionState<CreateState, FormData>(
    createAction,
    null
  );
  const [rotateState, rotateFormAction, rotating] = useActionState<RotateState, FormData>(
    rotateAction,
    null
  );
  const [archiveState, archiveFormAction, archiving] = useActionState<ArchiveState, FormData>(
    archiveAction,
    null
  );

  // Clear the create form on success so the admin can quickly add another.
  const createFormRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (createState?.data) {
      createFormRef.current?.reset();
    }
  }, [createState?.data]);

  return (
    <main className="bg-background text-foreground min-h-screen px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl space-y-8">
        <nav className="text-muted-foreground text-sm">
          <Link href={`/admin/${token}`} className="hover:text-foreground transition-colors">
            ← Volver al panel
          </Link>
        </nav>

        <header>
          <h1
            className="text-foreground text-2xl tracking-tight sm:text-3xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Vendedores
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Cada vendedor recibe una URL única para registrar compradores.
          </p>
        </header>

        {/* Create form */}
        <section className="bg-card border-border rounded-lg border p-5">
          <h2 className="text-foreground mb-3 text-sm font-semibold uppercase">Nuevo vendedor</h2>

          <form
            ref={createFormRef}
            action={createFormAction}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <label
                htmlFor="seller-name"
                className="text-foreground mb-1 block text-sm font-medium"
              >
                Nombre
              </label>
              <input
                id="seller-name"
                name="name"
                type="text"
                required
                minLength={3}
                maxLength={80}
                placeholder="Diego"
                className="bg-input-bg text-foreground border-border focus-ring h-11 w-full rounded-md border px-3 text-base outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="bg-primary text-primary-foreground hover:bg-primary-hover focus-ring inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? 'Creando…' : 'Crear vendedor'}
            </button>
          </form>

          {createState?.error ? (
            <p
              role="alert"
              className="bg-destructive/10 text-destructive border-destructive/30 mt-3 rounded-md border px-3 py-2 text-sm"
            >
              {createState.error}
            </p>
          ) : null}

          {createState?.data ? (
            <UrlBanner
              title="✅ Vendedor creado"
              description="Compártele esta URL por WhatsApp."
              url={createState.data.url}
            />
          ) : null}
        </section>

        {/* Active sellers */}
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-foreground text-sm font-semibold uppercase">
              Activos ({activeSellers.length})
            </h2>
            <Link
              href={
                showArchived ? `/admin/${token}/sellers` : `/admin/${token}/sellers?archived=true`
              }
              className="text-primary text-xs underline"
            >
              {showArchived ? 'Ver activos' : 'Ver archivados'}
            </Link>
          </div>

          {activeSellers.length === 0 ? (
            <p className="text-muted-foreground bg-card border-border rounded-lg border p-5 text-center text-sm">
              Aún no hay vendedores. Agregá uno arriba para empezar.
            </p>
          ) : (
            <ul className="space-y-3">
              {activeSellers.map((seller) => {
                // Inline freshly-rotated URL (banner) when this row matches
                // the last rotate result.
                const rotated = rotateState?.data?.sellerId === seller.id ? rotateState.data : null;
                const url = rotated ? rotated.newUrl : sellerUrl(origin, seller.accessToken);

                return (
                  <li
                    key={seller.id}
                    className="bg-card border-border rounded-lg border p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-foreground text-base font-semibold">{seller.name}</h3>
                      <span className="text-muted-foreground text-xs">
                        {seller.salesCount} venta{seller.salesCount === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                      <code className="bg-muted text-foreground flex-1 truncate rounded-md px-3 py-2 font-mono text-xs">
                        {url}
                      </code>
                      <CopyToClipboardButton value={url} label="Copiar URL" />
                    </div>

                    {rotated ? (
                      <p className="text-success mt-2 text-xs">
                        URL rotada. La anterior ya no funciona.
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <form action={rotateFormAction}>
                        <input type="hidden" name="sellerId" value={seller.id} />
                        <button
                          type="submit"
                          disabled={rotating}
                          className="focus-ring border-border bg-card text-foreground hover:bg-muted inline-flex h-9 items-center justify-center rounded-md border px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {rotating ? 'Rotando…' : 'Rotar URL'}
                        </button>
                      </form>

                      <ArchiveButton
                        sellerName={seller.name}
                        sellerId={seller.id}
                        formAction={archiveFormAction}
                        pending={archiving}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {rotateState?.error ? (
            <p
              role="alert"
              className="bg-destructive/10 text-destructive border-destructive/30 mt-3 rounded-md border px-3 py-2 text-sm"
            >
              {rotateState.error}
            </p>
          ) : null}
          {archiveState?.error ? (
            <p
              role="alert"
              className="bg-destructive/10 text-destructive border-destructive/30 mt-3 rounded-md border px-3 py-2 text-sm"
            >
              {archiveState.error}
            </p>
          ) : null}
        </section>

        {/* Archived sellers (only when toggle is on) */}
        {showArchived ? (
          <section>
            <h2 className="text-foreground mb-3 text-sm font-semibold uppercase">
              Archivados ({archivedSellers.length})
            </h2>
            {archivedSellers.length === 0 ? (
              <p className="text-muted-foreground bg-card border-border rounded-lg border p-5 text-center text-sm">
                No hay vendedores archivados.
              </p>
            ) : (
              <ul className="space-y-2">
                {archivedSellers.map((seller) => (
                  <li
                    key={seller.id}
                    className="bg-card border-border flex items-center justify-between rounded-lg border p-4 opacity-70 sm:p-5"
                  >
                    <div>
                      <p className="text-foreground text-sm font-medium">{seller.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {seller.salesCount} venta{seller.salesCount === 1 ? '' : 's'} históricas
                      </p>
                    </div>
                    <span className="text-muted-foreground text-xs">Archivado</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function UrlBanner({
  title,
  description,
  url,
}: {
  title: string;
  description: string;
  url: string;
}) {
  return (
    <div className="bg-success/10 border-success/30 mt-4 rounded-md border p-4">
      <p className="text-success text-sm font-semibold">{title}</p>
      <p className="text-foreground mt-1 text-xs">{description}</p>
      <div className="mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <code className="bg-muted text-foreground flex-1 truncate rounded-md px-3 py-2 font-mono text-xs">
          {url}
        </code>
        <CopyToClipboardButton value={url} label="Copiar URL" />
      </div>
    </div>
  );
}

function ArchiveButton({
  sellerName,
  sellerId,
  formAction,
  pending,
}: {
  sellerName: string;
  sellerId: string;
  formAction: (formData: FormData) => void;
  pending: boolean;
}) {
  // MVP: native confirm() for the destructive action — CMP-009
  // ConfirmDialog will replace it. Browser confirm IS accessible.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (
      !window.confirm(
        `¿Archivar al vendedor "${sellerName}"? Sus ventas históricas se preservan; su URL deja de funcionar.`
      )
    ) {
      e.preventDefault();
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit}>
      <input type="hidden" name="sellerId" value={sellerId} />
      <button
        type="submit"
        disabled={pending}
        className="focus-ring text-destructive hover:bg-destructive/10 border-destructive/30 inline-flex h-9 items-center justify-center rounded-md border px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Archivando…' : 'Archivar'}
      </button>
    </form>
  );
}
