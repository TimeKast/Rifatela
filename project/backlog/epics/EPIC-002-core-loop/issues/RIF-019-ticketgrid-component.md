# RIF-019: `<TicketGrid>` component con 3 variants (CMP-002)

| Field              | Value                                    |
| ------------------ | ---------------------------------------- |
| **Epic**           | EPIC-002 Core Loop                       |
| **Priority**       | P0                                       |
| **Story Points**   | 5                                        |
| **Dependencies**   | RIF-006, RIF-021 (vendor variant)        |
| **User Stories**   | US-010, US-011, US-013                   |
| **Features**       | FT-005                                   |
| **Business Rules** | BR-009 (iniciales en pública)            |
| **Design**         | CMP-002 + §0.3 ticket states palette     |
| **Agents**         | `frontend-specialist`, `design-engineer` |
| **Skills**         | `kb-components`, `kb-grids`              |

## Problem

Componente central de la app: grilla visual de números (1..max). 3 variants:

- `vendor`: tappable, asigna ticket; sold muestra iniciales (no tappable)
- `public`: read-only, sold muestra iniciales; winner highlighted post-sorteo
- `admin-detail`: sold tickets clickable abren ConfirmDialog de revert

Densidad: 5 cols mobile (44px tap target), 8 cols tablet, 10-12 cols desktop (per DD-008).

## Acceptance Criteria

```gherkin
Given tickets con mix de available/sold (variant="vendor")
When render <TicketGrid tickets={...} variant="vendor" onTicketClick={fn} />
Then disponibles tienen border rojo carpa, fondo blanco, son tappable (44×44px)
And vendidos muestran iniciales del buyer en azul, no tappable
And cada celda tiene aria-label descriptivo

Given variant="public"
When render con winnerTicketId
Then el ticket ganador tiene background amarillo dorado con border rojo, highlight perpetuo (micro-animation)
And NO hay onClick handlers (read-only)

Given variant="admin-detail"
When click en ticket sold
Then onTicketClick(ticketId) se invoca (parent abre ConfirmDialog de revert per RIF-035)
And tooltip con nombre completo del buyer aparece al hover (admin tiene acceso a BR-009 exception)

Given mobile 375px
When render con 100 tickets
Then 5 cols, 20 rows visibles con scroll vertical
And tap targets verificables ≥44px (puppeteer measure)

Given buyer.name=null (anónimo)
When render variant="public" para ese ticket sold
Then muestra "Anónimo" (DD-010), no "—"

Given keyboard nav (arrow keys)
When focused en ticket #5
Then arrow right → focus ticket #6
And enter → invoca onClick (variant vendor) o no-op (variant public)
```

## Implementation notes

- Cada ticket es `<button type="button">` (vendor / admin-detail) o `<div role="cell">` (public)
- `tabindex` apropiado
- Container con CSS Grid, `grid-template-columns: repeat(var(--ticket-cols), 1fr)`
- Custom property `--ticket-cols` cambia por breakpoint
- `PublicTicketGrid` derivado con BR-009 enforcement — tipo prop discriminado para que TypeScript impida pasar buyer.phone/email
- Visual states per `15_DESIGN.md §0.3`

## Done when

- [ ] Component + 3 variants (puede ser 1 component con prop variant)
- [ ] Component test: render con 100 tickets, click handlers, keyboard nav, aria-labels
- [ ] PII smoke test (variant=public): assert que el HTML NO contiene `@`, `+54`, o sequence de >7 dígitos consecutivos
- [ ] Visual regression manual en 375 / 768 / 1280
- [ ] `pnpm verify` pasa
