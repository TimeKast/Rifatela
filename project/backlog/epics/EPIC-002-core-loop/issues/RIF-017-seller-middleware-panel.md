# RIF-017: Vendedor middleware + selector + SCR-006 scaffold

| Field              | Value                                                           |
| ------------------ | --------------------------------------------------------------- |
| **Epic**           | EPIC-002 Core Loop                                              |
| **Priority**       | P0                                                              |
| **Story Points**   | 5                                                               |
| **Dependencies**   | RIF-001, RIF-004, RIF-007                                       |
| **User Stories**   | US-007, US-008                                                  |
| **Features**       | FT-003                                                          |
| **Business Rules** | BR-013 (archived seller 404)                                    |
| **Screens**        | SCR-006 (scaffold layout only; form + grid en RIF-018, RIF-019) |
| **Agents**         | `backend-specialist`, `frontend-specialist`                     |
| **Skills**         | `kb-middleware`, `kb-rsc`                                       |

## Problem

Cuando un vendedor abre `/v/{accessToken}`:

1. Server valida token → si inválido/archivado → 404
2. Si válido → muestra panel con selector de rifa activa (si múltiples) y layout scaffold
3. Container espera RIF-018 (BuyerForm) y RIF-019 (TicketGrid)

## Acceptance Criteria

```gherkin
Given /v/{validToken} con seller no archivado
When server resuelve
Then middleware (RIF-007) ya pasó headers (Referrer-Policy, noindex)
And RSC page valida token contra DB
And resolve el sellerId
And carga rifas con status='open' del proyecto (siempre todas en single-tenant)
And muestra header "👤 {sellerName}  {Rifa Active} ▾" si hay 1+ rifas
And muestra placeholder slots para BuyerForm + TicketGrid

Given /v/{invalidToken} o /v/{tokenOfArchivedSeller}
When server resuelve
Then 404 (ambiguous response — no filtra diferencia)

Given un seller con múltiples rifas activas (escenario raro pero posible)
When user click el selector
Then dropdown muestra todas las rifas activas
And selecting una cambia el contexto activo (route param o state)

Given selector con 0 rifas activas
When seller entra
Then muestra mensaje "No hay rifas activas. Pedile a la organizadora que cree una."
```

## Implementation notes

- RSC page en `src/app/v/[token]/page.tsx`
- Query: `db.query.sellers.findFirst({ where: and(eq(token), isNull(archivedAt)) })` — si null → `notFound()`
- Query rifas activas: `db.query.raffles.findMany({ where: and(eq('open'), isNull(archivedAt)) })`
- Layout: SCR-006 wireframe del doc 15
- Cookie de sesión: opcional en MVP — el token en la URL ya identifica al seller. Si se hace, scoped a `seller_id`.

## Done when

- [ ] RSC page con validation
- [ ] Header con seller name + raffle selector
- [ ] Unit test: invalid token → notFound
- [ ] Unit test: archived seller token → notFound (mismo 404)
- [ ] E2E (parte de E2E-002): seller entra, ve panel
- [ ] `pnpm verify` pasa
