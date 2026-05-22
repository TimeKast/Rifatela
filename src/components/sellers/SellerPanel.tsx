/**
 * SellerPanel — SCR-006 (RIF-017 + RIF-018 + RIF-019)
 *
 * Orchestrator for the seller experience:
 *   1. BuyerForm (CMP-005)  — captures optional buyer data, returns buyerId
 *   2. Status banner        — "Comprador registrado, asigná un número"
 *   3. TicketGrid (vendor)  — tap → claim ticket for active buyer
 *
 * The flow is intentionally sequential — a seller MUST register a buyer
 * before tapping a ticket. We surface this with a disabled grid until
 * `activeBuyer` is set, and an inline hint banner.
 *
 * Concurrency UX: on claim error (e.g. "ticket ya vendido"), the inline
 * banner shows the message and the seller is invited to re-fetch the
 * page (router refresh). The grid refetches the latest state.
 *
 * @see project/planning/15_DESIGN.md SCR-006, CMP-005, CMP-002
 * @see project/backlog/epics/EPIC-002-core-loop/issues/RIF-017-seller-middleware-panel.md
 */

'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import type { ActionResult } from '@/lib/actions/types';
import type { RaffleTicket } from '@/lib/raffles/get-raffle-tickets';
import { TicketGrid } from '@/components/tickets/TicketGrid';

interface ActiveBuyer {
  id: string;
  label: string;
}

interface RegisterBuyerData {
  buyerId: string;
}

interface ClaimTicketData {
  ticketId: string;
  number: number;
  raffleId: string;
}

type BoundFormAction<T> = (state: unknown, formData: FormData) => Promise<ActionResult<T>>;

interface SellerPanelProps {
  sellerName: string;
  raffle: {
    id: string;
    name: string;
    maxTickets: number;
    soldCount: number;
  };
  tickets: RaffleTicket[];
  registerBuyer: BoundFormAction<RegisterBuyerData>;
  claimTicket: BoundFormAction<ClaimTicketData>;
}

export function SellerPanel({
  sellerName,
  raffle,
  tickets,
  registerBuyer,
  claimTicket,
}: SellerPanelProps) {
  const router = useRouter();

  // Active buyer carried across one or more claim cycles
  const [activeBuyer, setActiveBuyer] = useState<ActiveBuyer | null>(null);

  // Banner feedback (register error / claim success / claim error)
  const [statusMessage, setStatusMessage] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);

  const [registerPending, startRegister] = useTransition();
  const [claimPending, startClaim] = useTransition();
  const [registerError, setRegisterError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleRegisterSubmit = (formData: FormData) => {
    const name = (formData.get('name') as string | null)?.trim() ?? '';
    startRegister(async () => {
      const result = await registerBuyer(null, formData);
      if (result.error) {
        setRegisterError(result.error);
        return;
      }
      if (result.data) {
        setRegisterError(null);
        setActiveBuyer({
          id: result.data.buyerId,
          label: name.length > 0 ? name : 'Comprador anónimo',
        });
        setStatusMessage({
          kind: 'success',
          text: 'Comprador registrado. Toca un número para asignarlo.',
        });
        formRef.current?.reset();
      }
    });
  };

  const handleTicketClick = (ticket: RaffleTicket) => {
    if (!activeBuyer) return;
    const formData = new FormData();
    formData.set('ticketId', ticket.id);
    formData.set('buyerId', activeBuyer.id);

    startClaim(async () => {
      const result = await claimTicket(null, formData);
      if (result.error) {
        setStatusMessage({ kind: 'error', text: result.error });
        // Surface the latest server state so the seller doesn't keep
        // tapping a sold ticket.
        router.refresh();
      } else if (result.data) {
        setStatusMessage({
          kind: 'success',
          text: `Número ${result.data.number} asignado a ${activeBuyer.label}. Registra otro comprador o asigna otro número.`,
        });
        setActiveBuyer(null);
        router.refresh();
      }
    });
  };

  const soldPct = Math.round((raffle.soldCount / raffle.maxTickets) * 100);

  return (
    <section className="space-y-6">
      <header className="bg-card border-border rounded-lg border p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-xs tracking-wide uppercase">Vendedor</p>
            <h2 className="text-foreground text-lg font-semibold">{sellerName}</h2>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-xs tracking-wide uppercase">Rifa</p>
            <h2 className="text-foreground text-lg font-semibold">{raffle.name}</h2>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-muted-foreground mb-1 flex items-center justify-between text-xs">
            <span>
              {raffle.soldCount} / {raffle.maxTickets} vendidos
            </span>
            <span>{soldPct}%</span>
          </div>
          <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full transition-all"
              style={{ width: `${Math.min(soldPct, 100)}%` }}
            />
          </div>
        </div>
      </header>

      <div className="bg-card border-border rounded-lg border p-4 sm:p-5">
        <h3 className="text-foreground mb-3 text-base font-semibold">1. Registra al comprador</h3>

        <form ref={formRef} action={handleRegisterSubmit} className="space-y-3">
          <div>
            <label htmlFor="buyer-name" className="text-foreground mb-1 block text-sm font-medium">
              Nombre <span className="text-muted-foreground text-xs">(opcional)</span>
            </label>
            <input
              id="buyer-name"
              name="name"
              type="text"
              autoComplete="off"
              className="border-border bg-background text-foreground focus-ring h-11 w-full rounded-md border px-3 text-base"
              placeholder="Marta López"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="buyer-phone"
                className="text-foreground mb-1 block text-sm font-medium"
              >
                Teléfono <span className="text-muted-foreground text-xs">(opcional)</span>
              </label>
              <input
                id="buyer-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                className="border-border bg-background text-foreground focus-ring h-11 w-full rounded-md border px-3 text-base"
                placeholder="+54 11 5555 5555"
              />
            </div>
            <div>
              <label
                htmlFor="buyer-email"
                className="text-foreground mb-1 block text-sm font-medium"
              >
                Email <span className="text-muted-foreground text-xs">(opcional)</span>
              </label>
              <input
                id="buyer-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="off"
                className="border-border bg-background text-foreground focus-ring h-11 w-full rounded-md border px-3 text-base"
                placeholder="marta@correo.com"
              />
            </div>
          </div>

          {registerError && (
            <p className="text-destructive text-sm" role="alert">
              {registerError}
            </p>
          )}

          <button
            type="submit"
            disabled={registerPending}
            className="bg-primary text-primary-foreground hover:bg-primary-hover focus-ring inline-flex h-11 w-full items-center justify-center rounded-md px-4 text-sm font-semibold transition-colors disabled:opacity-60 sm:w-auto"
          >
            {registerPending ? 'Registrando…' : 'Registrar comprador'}
          </button>
        </form>
      </div>

      {statusMessage && (
        <div
          role="status"
          className={
            statusMessage.kind === 'success'
              ? 'border-success/40 bg-success/10 text-success rounded-lg border px-4 py-3 text-sm'
              : 'border-destructive/40 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm'
          }
        >
          {statusMessage.text}
        </div>
      )}

      <div className="bg-card border-border rounded-lg border p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-foreground text-base font-semibold">
            2. Asigna un número
            {activeBuyer && (
              <span className="text-muted-foreground ml-2 text-sm font-normal">
                para <span className="text-primary font-medium">{activeBuyer.label}</span>
              </span>
            )}
          </h3>
          {claimPending && <span className="text-muted-foreground text-xs">Asignando…</span>}
        </div>

        {!activeBuyer && (
          <p className="text-muted-foreground mb-3 text-sm">
            Registra primero un comprador para poder asignar un número.
          </p>
        )}

        <TicketGrid
          tickets={tickets}
          variant="vendor"
          onTicketClick={handleTicketClick}
          disabled={!activeBuyer || claimPending}
        />
      </div>
    </section>
  );
}
