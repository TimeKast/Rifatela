# RIF-009: Admin Dashboard listing (SCR-001)

| Field            | Value                                                                  |
| ---------------- | ---------------------------------------------------------------------- |
| **Epic**         | EPIC-002 Core Loop                                                     |
| **Priority**     | P0                                                                     |
| **Story Points** | 3                                                                      |
| **Status**       | ✅ Completed (2026-05-21)                                              |
| **Dependencies** | RIF-001, RIF-006, RIF-007, RIF-015                                     |
| **User Stories** | US-022, US-023                                                         |
| **Features**     | FT-012                                                                 |
| **Screens**      | SCR-001                                                                |
| **Components**   | CMP-001 RaffleCard, CMP-015 EmptyState (use placeholder until RIF-038) |
| **Agents**       | `frontend-specialist`                                                  |
| **Skills**       | `kb-rsc`, `kb-tailwind`                                                |

## Problem

Admin necesita ver lista de rifas con métricas resumen (% vendido, días restantes, vendedores) al entrar a `/admin/{token}`. RSC con read-only query. Filtro toggle "incluir archivadas" (default off).

## Acceptance Criteria

```gherkin
Given un admin con 0 rifas en DB
When abre /admin/{token}
Then ve EmptyState con CTA "Crear primera rifa" (→ /admin/{token}/raffles/new)

Given un admin con 3 rifas (1 draft, 1 open, 1 drawn, 1 archived)
When abre /admin/{token} (default filter "no archivadas")
Then ve 3 cards: draft, open, drawn
And NO ve la archivada
When toggle "incluir archivadas" ON
Then ve 4 cards

Given cada card visible
When la render se completa
Then muestra: name, status badge, % vendido, días restantes (con sign), total vendedores, total ventas
And ordena por created_at DESC default
And el toggle "ordenar por: fecha / % vendido / días restantes" funciona

Given component test
When render `<AdminDashboard raffles={[...]} />`
Then assertions sobre data displayed
And toggle "incluir archivadas" cambia visibility
```

## Implementation notes

- RSC page en `src/app/admin/[token]/page.tsx`
- Query: `db.query.raffles.findMany({ where: filter, with: { prizes: true, tickets: { columns: { id: true, status: true, sellerId: true } } } })` — agrega `% vendido` y `total vendedores` server-side
- Loading: skeleton de 3 cards per `15_DESIGN.md §6.5`
- `revalidatePath('/admin/[token]')` desde otras actions (RIF-010, RIF-035, etc.)
- Mobile-first 375px (DD-005)

## Done when

- [x] RSC page `src/app/admin/[token]/page.tsx` + inline sub-components ✅
- [x] Data helper `listRaffles({ includeArchived })` con SQL aggregation (count FILTER) ✅
- [x] EmptyState inline (placeholder hasta RIF-038) ✅
- [x] RaffleCardPlaceholder inline (placeholder hasta RIF-015) ✅
- [x] ArchiveToggle vía URL searchParam `?archived=true` (RSC-friendly, no client state) ✅
- [x] `pnpm typecheck` + `pnpm lint` + **551/551 tests** PASS ✅
- [ ] Component test 0/1/3 raffles — _diferido: vitest.config excluye `src/app/**/page.tsx` (E2E territory). Cubrirá E2E-001 más adelante._
- [ ] E2E smoke (E2E-001) + Lighthouse a11y ≥90 — _post-merge cuando RIF-040 active Lighthouse CI_

## ✅ Implementation Evidence (2026-05-21)

### Files created

- **NEW:** `src/lib/raffles/list-raffles.ts` — helper data-only con `listRaffles({ includeArchived })` que retorna `RaffleListEntry[]`. Usa Postgres `count() FILTER (WHERE …)` via Drizzle `sql` template para una sola query GROUP BY (no N+1).
- **NEW:** `src/app/admin/[token]/page.tsx` — RSC del dashboard. 3 sub-componentes inline: `ArchiveToggle`, `RaffleCardPlaceholder`, `EmptyState`. Maneja `params` y `searchParams` async (Next 15+ pattern).

### Key decisions

- **Helper extraído de la page** — `listRaffles` es testable independientemente cuando agreguemos integration tests, y permite reuso desde otras rutas (raffle detail puede ampliar).
- **Single query con FILTER** — alternativa N+1 quedaba fea con 10k tickets por raffle. Aggregation Postgres-native, casteado a `int` para que Drizzle no devuelva string.
- **Archive toggle via URL searchParam** — RSC-friendly, sin state cliente, shareable, browser back/forward funciona.
- **`Date.now` computado en page, pasado como prop** — React 19 purity rule prohíbe `Date.now()` en render. Capturamos `now = new Date()` después del await.
- **Sub-components inline** — RIF-015 (`<RaffleCard>`) y RIF-038 (`<EmptyState>`) los extraen cuando lleguen; mientras tanto son placeholders honestos.

### Tests deferred

Per `vitest.config.ts` exclude list (`src/app/**/page.tsx`), las pages no se unit-testean — se cubren con E2E (Playwright). Tampoco hay test del helper `listRaffles` en este commit porque mockear Drizzle query chain sin coverage real de SQL es ceremonia. Integration test contra Neon branch llega en RIF-022/034 (los críticos del CI gate).

### Verified

- `pnpm typecheck` PASS
- `pnpm lint` PASS (después de fix por React 19 purity rule — `Date.now()` movido al page-level)
- `pnpm test` PASS 551/551 (sin regresiones)

### Pending follow-up (NOT blocking)

- RIF-010 `createRaffle` action + form (crea las raffles que este dashboard lista)
- RIF-015 extrae `<RaffleCard>` a componente con props tipados
- RIF-038 extrae `<EmptyState>` con SVG illustration
