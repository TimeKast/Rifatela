# RIF-018: `<BuyerForm>` component (CMP-005)

| Field              | Value                                |
| ------------------ | ------------------------------------ |
| **Epic**           | EPIC-002 Core Loop                   |
| **Priority**       | P0                                   |
| **Story Points**   | 3                                    |
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

- [ ] Component en `src/components/sellers/BuyerForm.tsx`
- [ ] Component tests: 3 campos vacíos OK, email invalid blocked, name only OK
- [ ] `pnpm verify` pasa
