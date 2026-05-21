/**
 * Rifatela — Landing placeholder
 *
 * Public landing page (no auth required). Per ADR-003 / brief F24, Rifatela
 * does not use real auth in MVP — admin and seller flows are reached via
 * URL-secret tokens (`/admin/{token}`, `/v/{token}`), and the canonical
 * public route is `/r/{publicSlug}` per raffle.
 *
 * The starter kit's default home redirected to `/login`. We replace it with
 * a Rifatela placeholder so the deploy is visit-able. A richer landing will
 * come later (see RIF-023 — public raffle view); this is just the entry
 * point until then.
 *
 * @see project/planning/07_ARCHITECTURE.md ADR-003
 * @see project/backlog/epics/EPIC-001-foundation-data-layer/issues/RIF-002a-disable-kit-auth-landing.md
 */

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-amber-50 px-6 text-center text-purple-950">
      <div className="space-y-4">
        <h1 className="text-6xl font-bold tracking-tight md:text-8xl">Rifatela</h1>
        <p className="text-xl md:text-2xl">Rifas sin lápiz ni cuaderno.</p>
      </div>

      <p className="mt-16 text-sm text-purple-700">En desarrollo · próximamente</p>
    </main>
  );
}
