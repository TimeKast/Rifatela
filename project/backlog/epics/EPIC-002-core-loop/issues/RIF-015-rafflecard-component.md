# RIF-015: `<RaffleCard>` component (CMP-001)

| Field            | Value                                                                |
| ---------------- | -------------------------------------------------------------------- |
| **Epic**         | EPIC-002 Core Loop                                                   |
| **Priority**     | P0                                                                   |
| **Story Points** | 2                                                                    |
| **Dependencies** | RIF-006, RIF-024 (Countdown — puede usar placeholder hasta entonces) |
| **User Stories** | US-022, US-023                                                       |
| **Design**       | CMP-001                                                              |
| **Agents**       | `frontend-specialist`, `design-engineer`                             |
| **Skills**       | `kb-components`, `kb-tailwind`                                       |

## Problem

Component visual reutilizable para mostrar una rifa. 2 variants: `dashboard` (lista en SCR-001) y `detail-header` (hero en SCR-003).

## Acceptance Criteria

```gherkin
Given raffle con status='open', maxTickets=100, sold=62, drawDate 4 días futuro
When render <RaffleCard variant="dashboard" raffle={...} />
Then muestra prize image (thumbnail), name, status badge verde "Abierta", progress bar 62%, métricas, "⏰ 4 días", clickable wrapping

Given raffle con status='drawn', winner #47
When render
Then border amarillo dorado, badge "Sorteada · ganador #47", sin progress bar

Given raffle con archived_at != NULL
When render
Then opacity 0.65, badge gris "Archivada"

Given raffle con % vendido = 92
When render
Then progress bar en color rojo (urgencia)

Given raffle con dias restantes <= 1
When render
Then countdown con pulse animation

Given component test
When render con cada variant
Then assertions sobre clases visuales, badges, métricas computadas
```

## Implementation notes

- Pure presentational component (no data fetching, recibe `raffle` por props)
- `variant='detail-header'` es full-width con prize image hero (per wireframe SCR-003)
- Click handler opcional (wraps en `<Link>`)
- Respect mobile-first (DD-005), tap target ≥44px en links

## Done when

- [ ] Component en `src/components/raffles/RaffleCard.tsx`
- [ ] Component tests para cada variant + cada status
- [ ] Visual smoke render screenshots (manual)
- [ ] `pnpm verify` pasa
