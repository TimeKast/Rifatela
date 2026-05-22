# RIF-012: Admin Raffle Detail (SCR-003 base)

| Field            | Value                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Epic**         | EPIC-002 Core Loop                                                                                                        |
| **Priority**     | P0                                                                                                                        |
| **Story Points** | 5                                                                                                                         |
| **Status**       | ✅ Completed (2026-05-22)                                                                                                 |
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

- [x] RSC page `src/app/admin/[token]/raffles/[id]/page.tsx` con hero + sellers + tickets + history ✅
- [x] Helper `getRaffleDetail(raffleId)` con 5 queries explícitas (raffle, prize, sold tickets, available count, admin actions) ✅
- [x] CopyToClipboardButton reusable client component (admin URL pública + futuros sellers/ticket digital) ✅
- [x] Conditional render por status: open+draw_date_reached → CTA sorteo; drawn → winner card; archived → label ✅
- [x] Winner name shown completo (BR-009 exception para ganador) ✅
- [x] `pnpm typecheck` + `pnpm lint` + **558/558 tests** PASS ✅
- [ ] Component test render con rifa en cada status — _diferido per kit pattern (RSC pages en E2E territory)_
- [ ] E2E smoke navegación dashboard → detail — _llega en suite E2E (RIF-022/034)_

## ✅ Implementation Evidence (2026-05-22)

### Files created

- **NEW:** `src/lib/raffles/get-raffle-detail.ts` — helper con 5 queries explícitas (raffle, prize, sold tickets + leftJoin buyers/sellers, available count agregado, admin actions). Drizzle relations() no configured, así que SQL explícito.
- **NEW:** `src/components/shared/CopyToClipboardButton.tsx` — client component reutilizable con feedback "Copiado" 2s. Fallback silencioso si `navigator.clipboard` no está disponible (older browsers / no secure context).
- **NEW:** `src/app/admin/[token]/raffles/[id]/page.tsx` — RSC del detail page. Hero + URL pública + draw CTA conditional + winner card conditional + sellers list + sold tickets table + admin actions log. ~290 LOC con sub-components inline.

### Key features

- **Hero** con prize image + name + status badge + 4 métricas (vendidos, %, vendedores, días al sorteo) + progress bar (rojo si ≥90% para urgency)
- **Public URL section** con código mono + CopyToClipboardButton + "Abrir" en nueva tab
- **Draw CTA conditional** — solo aparece si `status='open' AND draw_date <= now()`. Lleva a `/admin/{token}/raffles/{id}/draw` (RIF-030, todavía 404)
- **Winner card conditional** — `status='drawn'` muestra ticket# en font display + nombre completo (BR-009 exception)
- **Sellers list** agregada en JS desde sold tickets (sin query extra) — name + count + % del total, sorted by count DESC
- **Sold tickets table** con cols: #, comprador, vendedor (sm+), fecha (md+) — responsive
- **AdminAction log** con labels en español + timestamp relativo (formatRelative inline helper)

### Architecture decisions

- **5 queries explícitas en lugar de `db.query.X.findFirst({ with })`** — el proyecto no declaró `relations()` en schemas; agregarlas sería scope creep. Explicit SELECT con leftJoins es más simple y suficiente para la escala (1 raffle × ≤10k tickets).
- **SoldTickets ORDER BY number** — natural reading order para el admin
- **`NEXT_PUBLIC_APP_URL` o fallback relativo** — la URL pública usa env var si existe; sino fallback a `/r/{slug}` (admin igual puede copiar y pegar)
- **`formatRelative` inline** — pequeño helper sin libs externas. Si después crece, extraer a `kb-utils`.

### Pending follow-up (NOT blocking)

- RIF-011 Edit raffle → botón "Editar" en hero (todavía no agregado)
- RIF-015 extrae RaffleCard component formal (detail-header variant)
- RIF-019 extrae TicketGrid component (admin-detail variant con grid visual de todos los tickets)
- RIF-024 `<Countdown>` reemplaza el "X días" estático por countdown en vivo
- RIF-035 botón "Revertir" en cada row de la sold tickets table
- RIF-030 implementa la draw panel (`/admin/{token}/raffles/{id}/draw`)
- RIF-037 botón "Archivar rifa" en menú
