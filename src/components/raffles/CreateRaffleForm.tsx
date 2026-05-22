'use client';

/**
 * CreateRaffleForm — SCR-002 (RIF-010)
 *
 * Client component that renders the "new raffle" form. Receives a server
 * action `action` that's already bound to the admin token from the page,
 * so the form itself never handles auth — it just collects user input
 * and posts to the action.
 *
 * Inline `PrizeImageUpload` sub-component (CMP-006) until RIF-006 / future
 * issue extracts it. Pragmatic for the MVP form scope.
 *
 * @see project/planning/15_DESIGN.md SCR-002 + §5.2 Create Raffle Form
 * @see project/backlog/epics/EPIC-002-core-loop/issues/RIF-010-create-raffle-action-form.md
 */

import { useActionState, useRef, useState } from 'react';

import type { ActionResult } from '@/lib/actions/types';
import type { CreateRaffleResult } from '@/lib/actions/raffles/create-raffle';

type FormState = ActionResult<CreateRaffleResult> | null;

interface Props {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}

/**
 * Local default draw date: 7 days from "now" rendered at first paint.
 * Computed inside a function so the client and server don't disagree on
 * the millisecond (React would warn on hydration mismatch otherwise — we
 * intentionally render an empty string server-side and fill on mount).
 */
function defaultDrawDateValue(): string {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  d.setSeconds(0, 0);
  // datetime-local input expects YYYY-MM-DDTHH:mm in local time.
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CreateRaffleForm({ action }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <Field label="Nombre de la rifa" htmlFor="name" required>
        <input
          id="name"
          name="name"
          type="text"
          required
          minLength={3}
          maxLength={120}
          placeholder="Rifa Pro Cole"
          className="bg-input-bg text-foreground border-border focus-ring h-11 w-full rounded-md border px-3 text-base outline-none"
        />
      </Field>

      <Field label="Premio" htmlFor="prizeText" required help="Lo que el ganador se lleva.">
        <textarea
          id="prizeText"
          name="prizeText"
          required
          minLength={3}
          maxLength={500}
          rows={3}
          placeholder="iPhone 15 128GB color natural"
          className="bg-input-bg text-foreground border-border focus-ring w-full resize-y rounded-md border px-3 py-2 text-base outline-none"
        />
      </Field>

      <PrizeImageUpload />

      <Field
        label="Cantidad de boletos"
        htmlFor="maxTickets"
        required
        help="Entre 1 y 10.000. No se puede cambiar una vez que empieces a vender."
      >
        <input
          id="maxTickets"
          name="maxTickets"
          type="number"
          required
          min={1}
          max={10_000}
          step={1}
          defaultValue={100}
          className="bg-input-bg text-foreground border-border focus-ring h-11 w-full rounded-md border px-3 text-base outline-none"
        />
      </Field>

      <Field
        label="Fecha y hora del sorteo"
        htmlFor="drawDate"
        required
        help="Mínimo una hora en el futuro."
      >
        <input
          id="drawDate"
          name="drawDate"
          type="datetime-local"
          required
          defaultValue={defaultDrawDateValue()}
          className="bg-input-bg text-foreground border-border focus-ring h-11 w-full rounded-md border px-3 text-base outline-none"
        />
      </Field>

      {state?.error ? (
        <p
          className="bg-destructive/10 text-destructive border-destructive/30 rounded-md border px-3 py-2 text-sm"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-primary-foreground hover:bg-primary-hover focus-ring inline-flex h-11 w-full items-center justify-center rounded-md px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {pending ? 'Creando…' : 'Crear rifa'}
      </button>
    </form>
  );
}

/**
 * Labelled field wrapper. Keeps layout consistent without pulling in a
 * design-system primitive yet.
 */
function Field({
  label,
  htmlFor,
  required,
  help,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-foreground block text-sm font-medium">
        {label}
        {required ? <span className="text-primary ml-0.5">*</span> : null}
      </label>
      {children}
      {help ? <p className="text-muted-foreground text-xs">{help}</p> : null}
    </div>
  );
}

/**
 * Prize image upload (CMP-006 placeholder).
 *
 * Inline for now — keeps the form self-contained. Will be extracted to
 * `src/components/raffles/PrizeImageUpload.tsx` when a second consumer
 * (raffle edit form) needs it.
 *
 * Validates MIME + size client-side as immediate feedback. The action
 * re-validates server-side (always — never trust the client).
 */
function PrizeImageUpload() {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const MAX = 5 * 1024 * 1024;
  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError(null);
    if (!file) {
      setPreview(null);
      return;
    }
    if (!ALLOWED.includes(file.type)) {
      setError('Formato no soportado. Usa JPG, PNG o WebP.');
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    if (file.size > MAX) {
      setError('La imagen es demasiado grande (máximo 5 MB).');
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
  }

  function clear() {
    if (fileRef.current) fileRef.current.value = '';
    setPreview(null);
    setError(null);
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor="prizeImage" className="text-foreground block text-sm font-medium">
        Imagen del premio
        <span className="text-muted-foreground ml-1 text-xs">(opcional)</span>
      </label>

      <div className="border-border bg-card flex flex-col gap-3 rounded-md border border-dashed p-4 sm:flex-row sm:items-center">
        {preview ? (
          // Use a plain img tag — next/image needs a remotePatterns config,
          // and this is a client-side object URL anyway (not a remote asset).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Vista previa del premio"
            className="border-border h-24 w-24 rounded-md border object-cover"
          />
        ) : (
          <div className="border-border bg-muted text-muted-foreground flex h-24 w-24 items-center justify-center rounded-md border text-xs">
            Sin imagen
          </div>
        )}

        <div className="flex-1 space-y-2">
          <input
            ref={fileRef}
            id="prizeImage"
            name="prizeImage"
            type="file"
            accept={ALLOWED.join(',')}
            onChange={handleChange}
            className="text-foreground file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary-hover block w-full cursor-pointer text-sm file:mr-3 file:h-9 file:rounded-md file:border-0 file:px-3 file:text-sm file:font-medium"
          />
          <p className="text-muted-foreground text-xs">
            JPG, PNG o WebP, hasta 5 MB. Lo que vea tu audiencia al compartir la rifa.
          </p>
          {preview ? (
            <button type="button" onClick={clear} className="text-primary text-xs underline">
              Quitar imagen
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
