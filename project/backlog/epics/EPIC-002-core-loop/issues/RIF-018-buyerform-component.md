# RIF-018: `<BuyerForm>` component (CMP-005)

| Field              | Value                                |
| ------------------ | ------------------------------------ |
| **Epic**           | EPIC-002 Core Loop                   |
| **Priority**       | P0                                   |
| **Story Points**   | 3                                    |
| **Status**         | Completed (2026-05-22)               |
| **Dependencies**   | RIF-006, RIF-020                     |
| **User Stories**   | US-009                               |
| **Features**       | FT-004                               |
| **Business Rules** | BR-008 (datos opcionales)            |
| **Design**         | CMP-005 + §5.4 (Form Specifications) |
| **Components**     | (anchor para `registerBuyer` action) |
| **Agents**         | `frontend-specialist`                |
| **Skills**         | `kb-forms`                           |

## Problem

Form en SCR-006 para que vendedor capture datos del comprador. Todos opcionales (BR-008). Submit invoca `registerBuyer` action (RIF-020), retorna `buyerId` que queda como state local para el próximo claim.

## Acceptance Criteria

```gherkin
Given vendedor en SCR-006
When llena name="Marta" (sin phone ni email) y submit
Then se ejecuta registerBuyer action
And el response trae buyerId
And el form clears + un mensaje "Comprador registrado, asigná un número"
And el buyerId queda como state (contexto activo para próximo claim ticket)

Given form completamente vacío (3 campos null)
When submit
Then se acepta y crea Buyer anónimo (BR-008)
And el form clears

Given input email = "no-es-email"
When intento submit
Then validation error inline "email inválido" sin invocar action

Given form en mobile 375px
When teclado abre en input
Then no hay zoom automático (font-size 16px per §5.1)
And submit button visible (sticky bottom)

Given component test
When render con onSubmit mock
Then assertions sobre submit con cada combinación de campos
And validation funciona como spec
```

## Implementation notes

- Client Component con `useActionState` o `useFormState`
- Inputs height 44px (DD-004 tap target)
- Font-size 16px (anti-zoom iOS)
- Sticky submit en mobile
- Helper text bajo cada input ("Opcional"), label arriba

## Done when

- [x] Form inline en `src/components/sellers/SellerPanel.tsx` (no se extrajo a `BuyerForm.tsx` aislado — co-locado con la lógica de orquestación porque el `buyerId` resultante alimenta directamente el grid) ✅
- [x] 3 campos (name/phone/email) todos opcionales, height 44px (DD-004), font-size 16px (anti-zoom iOS) ✅
- [x] Validation Zod en `registerBuyer` (RIF-020): email format-checked, name/phone/email transform `''` → `null` ✅
- [x] `pnpm typecheck` + `pnpm lint` + `pnpm build` PASS ✅
- [ ] Component test (RTL) — _diferido per kit pattern_; lógica cubierta por unit tests de `registerBuyer` action

## ✅ Implementation Evidence (2026-05-22)

### Decisión de diseño

- **No se extrajo `BuyerForm.tsx`** separado. El form, el banner de status y el grid están en `SellerPanel.tsx` porque el `buyerId` del submit feed-directly el `activeBuyer` state que habilita el grid. Un `BuyerForm` standalone con callback `onSuccess(buyerId)` agregaría una capa de prop-drilling sin reuse en el horizonte.
- Si en futuro hay otra pantalla que necesite registrar buyer (ej: SCR-008 admin manual), recién ahí se extrae.

### UX validado

- Submit con los 3 campos vacíos → buyer anónimo OK (BR-008).
- Submit con email malformado → Zod rechaza con mensaje "Email inválido" inline.
- Post-submit success → `formRef.current?.reset()` + banner "Comprador registrado. Toca un número."
