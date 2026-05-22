/**
 * New Raffle Page — SCR-002 / RIF-010
 *
 * RSC page that renders `CreateRaffleForm`. Binds the admin token (from
 * the URL `[token]` segment) to the `createRaffle` action so the form
 * doesn't need to know about it.
 *
 * Access is gated by middleware (RIF-007): this RSC only renders after
 * the token matches `ADMIN_ACCESS_TOKEN`.
 *
 * @see project/planning/15_DESIGN.md SCR-002
 */

import Link from 'next/link';

import { CreateRaffleForm } from '@/components/raffles/CreateRaffleForm';
import { createRaffle } from '@/lib/actions/raffles/create-raffle';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function NewRafflePage({ params }: PageProps) {
  const { token } = await params;

  // Bind the admin token at render time so the action receives it from the
  // server context, not from user-controlled form data. The form sees only
  // (state, formData) and stays oblivious to the auth model.
  const boundAction = createRaffle.bind(null, token);

  return (
    <main className="bg-background text-foreground min-h-screen px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <nav className="text-muted-foreground mb-6 text-sm">
          <Link href={`/admin/${token}`} className="hover:text-foreground transition-colors">
            ← Volver al panel
          </Link>
        </nav>

        <header className="mb-8">
          <h1
            className="text-foreground text-2xl tracking-tight sm:text-3xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Nueva rifa
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Carga la rifa una vez y compártela en tu grupo de WhatsApp.
          </p>
        </header>

        <CreateRaffleForm action={boundAction} />
      </div>
    </main>
  );
}
