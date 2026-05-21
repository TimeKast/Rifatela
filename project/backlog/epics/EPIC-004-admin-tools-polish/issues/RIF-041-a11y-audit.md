# RIF-041: Accessibility audit (axe-core in E2E)

| Field            | Value                                     |
| ---------------- | ----------------------------------------- |
| **Epic**         | EPIC-004 Admin Tools & Polish             |
| **Priority**     | P1                                        |
| **Story Points** | 3                                         |
| **Dependencies** | RIF-022, RIF-034                          |
| **Design**       | DD-007 (reduced-motion)                   |
| **Agents**       | `quality-engineer`, `frontend-specialist` |
| **Skills**       | `kb-accessibility`, `kb-axe-core`         |

## Problem

Integrar `@axe-core/playwright` en E2E críticos para detectar violations a11y automáticamente. WCAG AA target. Reduced-motion validation manual.

## Acceptance Criteria

```gherkin
Given E2E críticos (E2E-001, E2E-002b, E2E-003, E2E-004)
When ejecutan en CI
Then cada uno llama AxeBuilder(page).analyze()
And violations.length === 0 (assertion)
And si hay violation → test falla con detalle

Given prefers-reduced-motion: reduce
When ejecuto tests con esta media query
Then DrawWheel NO ejecuta spin
And Countdown digit replacement sin flip
And toda animación tiene fallback

Given screen reader simulation
When navego /r/{slug} con axe
Then live regions anuncian:
  - Estado del countdown
  - Resultado del sorteo post-reveal
  - Toast messages

Given keyboard-only navigation
When tab through SCR-006 (panel de venta)
Then focus visible en cada elemento interactivo
And puedo asignar un ticket usando solo keyboard (arrow keys en grid + enter)
```

## Implementation notes

```ts
// tests/e2e/a11y.spec.ts
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

test('a11y: vista pública sin violations', async ({ page }) => {
  await page.goto('/r/seed-slug');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

// Integrar en cada @critical E2E con afterEach hook si querés cobertura amplia
```

- Tag a11y tests como `@a11y` para correr separado o junto al gate
- Reduced-motion: forzar via `page.emulateMedia({ reducedMotion: 'reduce' })`

## Done when

- [ ] `@axe-core/playwright` integrado
- [ ] E2E a11y test sobre URLs críticas
- [ ] Reduced-motion paths verificados
- [ ] Keyboard nav en TicketGrid funcional
- [ ] `pnpm verify` pasa
