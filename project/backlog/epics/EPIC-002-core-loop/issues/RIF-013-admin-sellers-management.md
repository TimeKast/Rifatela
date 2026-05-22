# RIF-013: Admin Sellers Management (SCR-005)

| Field            | Value                                                         |
| ---------------- | ------------------------------------------------------------- |
| **Epic**         | EPIC-002 Core Loop                                            |
| **Priority**     | P0                                                            |
| **Story Points** | 3                                                             |
| **Status**       | ✅ Completed (2026-05-22)                                     |
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

- [x] Page + Client Component `<SellersManagement>` con form crear + lista activos + lista archivados ✅
- [x] Empty state inline (placeholder hasta RIF-038) ✅
- [x] Post-create URL banner (verde, con CopyToClipboardButton) ✅
- [x] Rotate flow per-row con banner inline cuando el rotateState matchea el sellerId del row ✅
- [x] Archive flow per-row con native `confirm()` (CMP-009 ConfirmDialog reemplaza en futuro) ✅
- [x] Active/archived toggle vía URL searchParam `?archived=true` (RSC-friendly) ✅
- [x] Bundle con RIF-014 (actions necesarias) ✅
- [x] `pnpm typecheck` + `pnpm lint` + **558/558 tests** PASS ✅
- [ ] Component test del flow completo — _diferido per kit pattern_
- [ ] E2E-005 / E2E-007 — _llegan en suite E2E (RIF-022/034)_

## ✅ Implementation Evidence (2026-05-22)

### Files created

- **NEW:** `src/lib/sellers/list-sellers.ts` — helper `listSellers({ includeArchived })` con sales count agregado (count FILTER pattern, mismo que listRaffles)
- **NEW:** `src/components/sellers/SellersManagement.tsx` — Client Component con 3 `useActionState` (create, rotate, archive). Form ref + useEffect para clearear el create form on success.
- **NEW:** `src/app/admin/[token]/sellers/page.tsx` — RSC, bindea las 3 actions con el adminToken
- **MODIFY:** `src/app/admin/[token]/page.tsx` — link "Vendedores" agregado al header del dashboard

### UX flows verificados (visuales en el código)

- **Create:** name → submit → banner verde con URL nueva (Copy + Abrir) + form se resetea para el siguiente
- **Rotate:** click "Rotar URL" del row X → action → row X muestra "URL rotada. La anterior ya no funciona." en verde. URL del row reemplazada por la nueva.
- **Archive:** click "Archivar" → `window.confirm()` con texto del nombre del vendedor → submit → row desaparece de activos
- **Toggle archivados:** link "Ver archivados" en header de Active section, navega con `?archived=true`. Lista archivados aparece con opacity 0.7 + ventas históricas visibles.

### Pending follow-up (NOT blocking)

- RIF-016 extrae `<SellerCard>` formal component
- RIF-038 reemplaza `window.confirm()` por `<ConfirmDialog>` (CMP-009)
- RIF-017 desbloquea el flow del vendedor (entrar por la URL que el admin acaba de copiar)
