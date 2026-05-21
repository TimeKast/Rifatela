# RIF-012: Admin Raffle Detail (SCR-003 base)

| Field            | Value                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Epic**         | EPIC-002 Core Loop                                                                                                        |
| **Priority**     | P0                                                                                                                        |
| **Story Points** | 5                                                                                                                         |
| **Dependencies** | RIF-009, RIF-019 (TicketGrid admin-detail variant)                                                                        |
| **User Stories** | (anchor para US-020, US-022)                                                                                              |
| **Features**     | FT-001, FT-012                                                                                                            |
| **Screens**      | SCR-003                                                                                                                   |
| **Components**   | CMP-001 RaffleCard (detail-header), CMP-002 TicketGrid (admin-detail), CMP-012 AdminActionLog (placeholder hasta RIF-036) |
| **Agents**       | `frontend-specialist`                                                                                                     |
| **Skills**       | `kb-rsc`, `kb-tailwind`                                                                                                   |

## Problem

Página de detalle por rifa para el admin. Muestra:

- Hero con prize image + metadata (countdown, % vendido, vendedores activos)
- Botón "Copiar URL pública"
- Lista de vendedores activos con sus ventas
- Tabla de tickets vendidos (filtrable por seller / buyer / number)
- Historial de AdminActions (placeholder hasta RIF-036)
- Panel "Ejecutar Sorteo" si `draw_date <= now` (placeholder hasta RIF-030)

## Acceptance Criteria

```gherkin
Given rifa con 23/100 vendidos, 3 vendedores
When admin abre /admin/{token}/raffles/{id}
Then ve hero con name, prize text, prize image
And countdown component (CMP-003) — placeholder por ahora si RIF-024 pendiente
And "% vendido: 23/100"
And lista de vendedores activos con ventas count
And botón "Copiar URL pública" funciona (copia /r/{publicSlug} al clipboard)
And tabla de tickets vendidos con cols: #, comprador, vendedor, fecha venta

Given tabla de tickets con 50 filas
When la grilla rende
Then se muestra mobile-first (cards en 375px, table en ≥768px)
And tiene search input para filtrar por # o nombre

Given rifa con draw_date ya pasado y status='open'
When admin abre el detail
Then ve banner amarillo "🎯 ¡Hora del sorteo!" con CTA "Ejecutar Sorteo" (lead a SCR-004 — link placeholder)

Given rifa con status='drawn'
When admin abre el detail
Then ve sección "Ganador: #N - {nombre}"
And NO ve panel sorteo

Given component test
When render con dataset mock
Then assertions de visibility por status
```

## Implementation notes

- RSC page `src/app/admin/[token]/raffles/[id]/page.tsx`
- Query: `db.query.raffles.findFirst({ where: ..., with: { prizes, tickets: { with: { buyer, seller } }, adminActions } })`
- Sub-component `<TicketsTable>` (admin-only, expone buyer.name completo per BR-009 exception para admin context)
- Mobile-first 375px (DD-005)

## Done when

- [ ] RSC page con todos los sub-componentes
- [ ] Component test render con rifa en cada status
- [ ] E2E smoke: navegar desde dashboard → detail → ver datos
- [ ] `pnpm verify` pasa
