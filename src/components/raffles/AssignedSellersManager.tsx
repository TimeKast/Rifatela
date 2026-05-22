/**
 * AssignedSellersManager — Admin UI for raffle ↔ seller M:N
 *
 * Lives inside the admin raffle-detail page (`/admin/{token}/raffles/{id}`)
 * between the Public URL section and the sold-tickets table.
 *
 * Three slots:
 *   1. List of currently-assigned sellers, each with a "Quitar" button
 *      (calls `unassignSellerFromRaffle`).
 *   2. A `<select>` of available (active, not-yet-assigned) sellers + an
 *      "Asignar" button (calls `assignSellerToRaffle`).
 *   3. Empty / hint states when there are no sellers in the system at all
 *      or all sellers are already assigned.
 *
 * Both actions take FormData and revalidate the raffle page so the lists
 * refresh on the server side without any client cache.
 *
 * @see project/planning/06_DATA_MODEL.md (E-007 RaffleSeller)
 * @see project/planning/05_BUSINESS_RULES.md (BR-016 assigned-only sales)
 */

'use client';

import { useState, useTransition } from 'react';

import type { ActionResult } from '@/lib/actions/types';
import type { AssignedSeller, AvailableSeller } from '@/lib/raffles/get-assigned-sellers';

interface AssignResult {
  raffleId: string;
  sellerId: string;
  inserted: boolean;
}

interface UnassignResult {
  raffleId: string;
  sellerId: string;
  removed: boolean;
}

type BoundFormAction<T> = (state: unknown, formData: FormData) => Promise<ActionResult<T>>;

interface AssignedSellersManagerProps {
  raffleId: string;
  assigned: AssignedSeller[];
  available: AvailableSeller[];
  assignAction: BoundFormAction<AssignResult>;
  unassignAction: BoundFormAction<UnassignResult>;
}

export function AssignedSellersManager({
  raffleId,
  assigned,
  available,
  assignAction,
  unassignAction,
}: AssignedSellersManagerProps) {
  const [selectedSellerId, setSelectedSellerId] = useState<string>(available[0]?.id ?? '');
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null
  );

  const handleAssign = () => {
    if (!selectedSellerId) return;
    const formData = new FormData();
    formData.set('raffleId', raffleId);
    formData.set('sellerId', selectedSellerId);
    startTransition(async () => {
      const result = await assignAction(null, formData);
      if (result.error) {
        setFeedback({ kind: 'error', text: result.error });
      } else if (result.data) {
        setFeedback({
          kind: 'success',
          text: result.data.inserted ? 'Vendedor asignado.' : 'El vendedor ya estaba asignado.',
        });
      }
    });
  };

  const handleUnassign = (sellerId: string, sellerName: string) => {
    if (!window.confirm(`¿Quitar a ${sellerName} de esta rifa?`)) return;
    const formData = new FormData();
    formData.set('raffleId', raffleId);
    formData.set('sellerId', sellerId);
    startTransition(async () => {
      const result = await unassignAction(null, formData);
      if (result.error) {
        setFeedback({ kind: 'error', text: result.error });
      } else if (result.data) {
        setFeedback({
          kind: 'success',
          text: result.data.removed ? 'Vendedor quitado.' : 'El vendedor ya no estaba asignado.',
        });
      }
    });
  };

  const hasAnySeller = assigned.length + available.length > 0;

  return (
    <section className="bg-card border-border rounded-lg border p-5">
      <header className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-foreground text-sm font-semibold uppercase">Vendedores asignados</h2>
        <span className="text-muted-foreground text-xs">
          {assigned.length} asignado{assigned.length === 1 ? '' : 's'}
        </span>
      </header>

      {!hasAnySeller && (
        <p className="text-muted-foreground text-sm">
          Aún no hay vendedores en el sistema. Crea uno desde la sección{' '}
          <span className="text-foreground font-medium">Vendedores</span> del panel.
        </p>
      )}

      {hasAnySeller && assigned.length === 0 && (
        <p className="text-muted-foreground mb-4 text-sm">
          Esta rifa todavía no tiene vendedores asignados. Los vendedores solo verán esta rifa si
          los asignás aquí.
        </p>
      )}

      {assigned.length > 0 && (
        <ul className="divide-border mb-4 divide-y">
          {assigned.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-foreground text-sm font-medium">{s.name}</p>
                <p className="text-muted-foreground text-xs">
                  Asignado el{' '}
                  {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(s.assignedAt)}
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => handleUnassign(s.id, s.name)}
                className="text-destructive hover:bg-destructive/10 focus-ring rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <div className="border-border flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center">
          <label htmlFor="assign-seller" className="sr-only">
            Seleccionar vendedor
          </label>
          <select
            id="assign-seller"
            value={selectedSellerId}
            onChange={(e) => setSelectedSellerId(e.target.value)}
            disabled={pending}
            className="border-border bg-background text-foreground focus-ring h-11 flex-1 rounded-md border px-3 text-sm disabled:opacity-50"
          >
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAssign}
            disabled={pending || !selectedSellerId}
            className="bg-primary text-primary-foreground hover:bg-primary-hover focus-ring inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {pending ? 'Asignando…' : 'Asignar'}
          </button>
        </div>
      )}

      {hasAnySeller && available.length === 0 && (
        <p className="text-muted-foreground mt-2 text-xs">
          Todos los vendedores activos ya están asignados a esta rifa.
        </p>
      )}

      {feedback && (
        <p
          role="status"
          className={`mt-3 rounded-md px-3 py-2 text-xs ${
            feedback.kind === 'success'
              ? 'border-success/40 bg-success/10 text-success border'
              : 'border-destructive/40 bg-destructive/10 text-destructive border'
          }`}
        >
          {feedback.text}
        </p>
      )}
    </section>
  );
}
