# RIF-009: Admin Dashboard listing (SCR-001)

| Field            | Value                                                                  |
| ---------------- | ---------------------------------------------------------------------- |
| **Epic**         | EPIC-002 Core Loop                                                     |
| **Priority**     | P0                                                                     |
| **Story Points** | 3                                                                      |
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

- [ ] RSC page + sub-components
- [ ] Component test con 0/1/3 rifas
- [ ] E2E smoke (parte de E2E-001): crear rifa → aparece en dashboard
- [ ] Lighthouse a11y ≥90 sobre esta page
- [ ] `pnpm verify` pasa
