# RIF-013: Admin Sellers Management (SCR-005)

| Field            | Value                                                         |
| ---------------- | ------------------------------------------------------------- |
| **Epic**         | EPIC-002 Core Loop                                            |
| **Priority**     | P0                                                            |
| **Story Points** | 3                                                             |
| **Dependencies** | RIF-014, RIF-016                                              |
| **User Stories** | US-004                                                        |
| **Features**     | FT-002                                                        |
| **Screens**      | SCR-005                                                       |
| **Components**   | CMP-008 SellerCard, CMP-009 ConfirmDialog, CMP-015 EmptyState |
| **Agents**       | `frontend-specialist`                                         |
| **Skills**       | `kb-rsc`                                                      |

## Problem

Pantalla para CRUD-like de vendedores: listar activos, agregar nuevo, rotar URL, archivar. Post-create muestra URL nueva con botón copiar (parte clave del flow — admin la comparte por WhatsApp inmediatamente).

## Acceptance Criteria

```gherkin
Given admin con 0 vendedores
When abre /admin/{token}/sellers
Then ve EmptyState "Aún no hay vendedores" con CTA "Agregar primer vendedor"

Given click en "+ Nuevo Vendedor"
When llena name="Diego" y submit
Then se crea seller via action (RIF-014)
And aparece banner verde con URL completa y botón copiar
And la URL aparece en formato {origin}/v/{accessToken}
And el banner persiste hasta acción explícita "Continuar"

Given seller existente "Diego"
When click "Rotar URL"
Then aparece ConfirmDialog "¿Rotar URL de Diego?"
When confirmo
Then nueva URL generada, banner verde nueva URL aparece
And la URL anterior queda inválida (verificable con E2E)

Given seller existente
When click "Archivar"
Then ConfirmDialog "¿Archivar a Diego? Sus ventas históricas se preservan."
When confirmo
Then seller pasa a archived; aparece en sección "Archivados" colapsable

Given archived seller list collapsed
When click expand
Then ve la lista de archivados con sus ventas históricas (count)
```

## Implementation notes

- RSC + Client Component híbrido (form en client, list en RSC)
- "Copiar URL" usa `navigator.clipboard.writeText()` con fallback
- Mobile: SellerCard en mobile, table en desktop (per design 6.4)

## Done when

- [ ] Page + sub-components
- [ ] Component test: empty state, post-create banner, rotate flow, archive flow
- [ ] E2E (parte E2E-005, E2E-007): crear + rotar + archivar
- [ ] `pnpm verify` pasa
