# RIF-039: 404 / Error pages (SCR-011)

| Field            | Value                           |
| ---------------- | ------------------------------- |
| **Epic**         | EPIC-004 Admin Tools & Polish   |
| **Priority**     | P1                              |
| **Story Points** | 2                               |
| **Dependencies** | RIF-038                         |
| **Screens**      | SCR-011                         |
| **Agents**       | `frontend-specialist`           |
| **Skills**       | `kb-rsc`, `kb-error-boundaries` |

## Problem

Next.js App Router permite `not-found.tsx` y `error.tsx` per segmento. Necesitamos versiones consistentes con el branding (carnaval), copy festivo, CTAs útiles.

## Acceptance Criteria

```gherkin
Given una URL inexistente (rifa, vendedor, admin)
When navego
Then render not-found.tsx:
  - Ilustración carpa de circo cerrada
  - Title "Esta página no existe o el link expiró"
  - Body "Si esperabas ver una rifa, pedile el link al organizador."
  - CTA "Ir al inicio" (link a /)

Given runtime error en un RSC o action
When falla
Then error.tsx boundary captura
And Sentry captura el error (ya configurado en kit)
And UI muestra "Algo no salió bien" + botón "Reintentar"
And no expone stack trace al user

Given error boundary segment-level
When error en /admin/.../draw
Then boundary del segmento maneja sin romper toda la app
```

## Implementation notes

- `src/app/not-found.tsx` (global)
- `src/app/error.tsx` (root error boundary, Client Component con 'use client')
- Considerar `error.tsx` por segmento crítico (admin, vendedor, public) si UX lo requiere
- Sentry captura via `Sentry.captureException(error)` en error boundary
- NO exponer error.message ni stack en producción

## Done when

- [ ] not-found.tsx + error.tsx implementados
- [ ] E2E: navegar a /r/inexistente → 404 con CTA
- [ ] Manual trigger de error → boundary captura + Sentry alerta
- [ ] `pnpm verify` pasa
