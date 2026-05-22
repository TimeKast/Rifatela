/**
 * TicketGrid — CMP-002 (RIF-019)
 *
 * The central visual of the product. Renders 1..N tickets as a grid of
 * tappable cells. Three variants:
 *
 *   - `vendor`        : available → tappable button; sold → initials, disabled
 *   - `public`        : read-only; sold → initials; winnerTicketId highlighted
 *   - `admin-detail`  : sold tickets emit `onTicketClick` (parent opens
 *                       ConfirmDialog for revert per RIF-035 — not in MVP yet)
 *
 * Density (DD-008): 5 cols mobile, 8 cols sm, 10 cols md, 12 cols lg. Each
 * cell is ≥44×44px (DD-004 tap target).
 *
 * BR-009: this component receives only `buyerInitials` (already reduced
 * upstream by `getRaffleTickets`). Phone/email are inaccessible by type.
 *
 * @see project/planning/15_DESIGN.md (CMP-002, §0.3 ticket states palette)
 * @see project/planning/05_BUSINESS_RULES.md (BR-009)
 */

'use client';

import type { RaffleTicket } from '@/lib/raffles/get-raffle-tickets';

export type TicketGridVariant = 'vendor' | 'public' | 'admin-detail';

interface TicketGridProps {
  tickets: RaffleTicket[];
  variant: TicketGridVariant;
  /** Required for `vendor` and `admin-detail` variants; ignored for `public`. */
  onTicketClick?: (ticket: RaffleTicket) => void;
  /** Highlighted with the "winner" treatment. Only meaningful for `public` post-draw. */
  winnerTicketId?: string | null;
  /** Disables interaction (e.g. claim in flight, no buyer registered yet). */
  disabled?: boolean;
}

export function TicketGrid({
  tickets,
  variant,
  onTicketClick,
  winnerTicketId = null,
  disabled = false,
}: TicketGridProps) {
  return (
    <ul
      role="list"
      aria-label="Boletos de la rifa"
      className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12"
    >
      {tickets.map((ticket) => (
        <li key={ticket.id}>
          <TicketCell
            ticket={ticket}
            variant={variant}
            isWinner={ticket.id === winnerTicketId}
            disabled={disabled}
            onClick={onTicketClick}
          />
        </li>
      ))}
    </ul>
  );
}

interface TicketCellProps {
  ticket: RaffleTicket;
  variant: TicketGridVariant;
  isWinner: boolean;
  disabled: boolean;
  onClick?: (ticket: RaffleTicket) => void;
}

function TicketCell({ ticket, variant, isWinner, disabled, onClick }: TicketCellProps) {
  const isAvailable = ticket.status === 'available';
  const isSold = ticket.status === 'sold';

  // Computed interactivity per variant.
  //   - vendor: tappable when available, disabled when sold.
  //   - public: never tappable (read-only).
  //   - admin-detail: tappable only when sold (for revert flow).
  const interactive =
    !disabled && ((variant === 'vendor' && isAvailable) || (variant === 'admin-detail' && isSold));

  const baseClasses =
    'flex h-11 w-full items-center justify-center rounded-md border text-sm font-semibold transition-colors focus-ring';

  const stateClasses = isWinner
    ? // Winner: golden background + carnaval red border, perpetual highlight.
      'border-primary bg-warning/30 text-foreground ring-2 ring-warning'
    : isAvailable
      ? // Available: white bg, carnaval red border, tappable.
        'border-primary bg-card text-foreground hover:bg-primary/10'
      : // Sold: muted bg, primary-tinted initials.
        'border-border bg-muted text-muted-foreground';

  const cursorClasses = interactive ? 'cursor-pointer' : 'cursor-default';

  const ariaLabel = isSold
    ? `Boleto ${ticket.number}, vendido a ${ticket.buyerInitials ?? 'Anónimo'}`
    : `Boleto ${ticket.number}, disponible`;

  if (variant === 'public') {
    return (
      <div
        role="cell"
        aria-label={ariaLabel}
        className={`${baseClasses} ${stateClasses} ${cursorClasses}`}
      >
        {isSold ? ticket.buyerInitials : ticket.number}
      </div>
    );
  }

  // vendor / admin-detail → button
  return (
    <button
      type="button"
      disabled={!interactive}
      aria-label={ariaLabel}
      onClick={interactive && onClick ? () => onClick(ticket) : undefined}
      className={`${baseClasses} ${stateClasses} ${cursorClasses} disabled:cursor-not-allowed disabled:opacity-80`}
    >
      {isSold ? ticket.buyerInitials : ticket.number}
    </button>
  );
}
