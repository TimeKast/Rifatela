# RIF-036: `<AdminActionLog>` component (CMP-012)

| Field            | Value                              |
| ---------------- | ---------------------------------- |
| **Epic**         | EPIC-004 Admin Tools & Polish      |
| **Priority**     | P1                                 |
| **Story Points** | 3                                  |
| **Dependencies** | RIF-035, RIF-014                   |
| **User Stories** | (anchor de auditabilidad — varios) |
| **Design**       | CMP-012                            |
| **Agents**       | `frontend-specialist`              |
| **Skills**       | `kb-components`                    |

## Problem

Component timeline para mostrar historial de AdminActions en SCR-003. Audit trail visible para forensics de disputas.

## Acceptance Criteria

```gherkin
Given una raffle con varias AdminActions persistidas
When render <AdminActionLog actions={[...]} />
Then muestra timeline vertical con dot connector
And cada entry: timestamp relativo ("hace 2h"), action type con icon, expandible para ver details JSON
And ordenadas DESC por createdAt

Given action_type='revert_sale' con details.reason
When expand entry
Then muestra "Revertir venta del ticket #N — Razón: '{reason}'"
And muestra "Comprador previo: {Buyer.name}" y "Vendedor previo: {Seller.name}" (lookup desde details.prevBuyerId/prevSellerId)

Given action_type='rotate_seller_token'
When expand
Then muestra "Rotó URL del vendedor {Seller.name}"
And NO muestra el oldTokenHash (es interno, no útil para humano)

Given action_type='archive_seller' o 'archive_raffle'
When expand
Then muestra reason si presente

Given lista vacía
When render
Then muestra "Sin acciones administrativas aún" en estado empty

Given lista con 50+ entries
When render
Then paginación o "Ver más antiguos" después de los primeros 20
```

## Implementation notes

- Pure presentational component
- Timestamps relativos via `date-fns formatDistanceToNow(es)` o similar
- Icons via Lucide (per §0.7 design)
- Detail JSON pretty-printed pero hidden behind expand click (UX para 95% del tiempo donde el resumen alcanza)

## Done when

- [ ] Component + render para cada actionType
- [ ] Component tests por action variant
- [ ] `pnpm verify` pasa
