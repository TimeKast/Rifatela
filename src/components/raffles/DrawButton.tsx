/**
 * DrawButton — admin trigger for `executeDraw` (RIF-029)
 *
 * Lives inside the admin raffle-detail page when `status='open'` and the
 * draw date has been reached. Wraps the irreversible mutation in a
 * native `window.confirm()` (per design DD-006: native dialog is fine
 * for MVP; ConfirmDialog component arrives in RIF-038) with copy that
 * explicitly names the raffle and warns about irreversibility (BR-010).
 *
 * On success: shows the winner inline + refreshes the page so the RSC
 * re-fetches the new `status='drawn'` state and the Winner card renders.
 *
 * @see project/planning/05_BUSINESS_RULES.md (BR-005, BR-010)
 */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import type { ActionResult } from '@/lib/actions/types';

interface DrawResult {
  raffleId: string;
  publicSlug: string;
  winnerTicketId: string;
  winnerNumber: number;
  winnerBuyerName: string | null;
  rngSeed: string;
  drawnAt: Date;
}

type BoundFormAction = (state: unknown, formData: FormData) => Promise<ActionResult<DrawResult>>;

interface DrawButtonProps {
  raffleId: string;
  raffleName: string;
  action: BoundFormAction;
}

export function DrawButton({ raffleId, raffleName, action }: DrawButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null
  );

  const handleClick = () => {
    const message = `¿Ejecutar el sorteo de "${raffleName}"?\n\nEsta acción es IRREVERSIBLE: una vez sorteada, la rifa queda inmutable y el ganador queda registrado.`;
    if (!window.confirm(message)) return;

    const formData = new FormData();
    formData.set('raffleId', raffleId);

    startTransition(async () => {
      const result = await action(null, formData);
      if (result.error) {
        setFeedback({ kind: 'error', text: result.error });
        router.refresh();
      } else if (result.data) {
        setFeedback({
          kind: 'success',
          text: `🎉 Ganador: boleto #${result.data.winnerNumber}${
            result.data.winnerBuyerName ? ` (${result.data.winnerBuyerName})` : ' (anónimo)'
          }.`,
        });
        router.refresh();
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="bg-foreground text-background hover:bg-foreground/90 focus-ring mt-4 inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-semibold transition-colors disabled:opacity-60"
      >
        {pending ? 'Sorteando…' : 'Ejecutar sorteo'}
      </button>

      {feedback && (
        <p
          role="status"
          className={`mt-3 rounded-md px-3 py-2 text-sm ${
            feedback.kind === 'success'
              ? 'border-success/40 bg-success/10 text-success border'
              : 'border-destructive/40 bg-destructive/10 text-destructive border'
          }`}
        >
          {feedback.text}
        </p>
      )}
    </>
  );
}
