# RIF-038: `<EmptyState>` component (CMP-015)

| Field            | Value                                    |
| ---------------- | ---------------------------------------- |
| **Epic**         | EPIC-004 Admin Tools & Polish            |
| **Priority**     | P1                                       |
| **Story Points** | 2                                        |
| **Dependencies** | RIF-006                                  |
| **Design**       | CMP-015 + DD-011 (copy festivo)          |
| **Agents**       | `frontend-specialist`, `design-engineer` |
| **Skills**       | `kb-components`                          |

## Problem

Reusable component para empty states con copy festivo (no genérico). 4 variants: `dashboard-empty`, `sellers-empty`, `no-results`, `error`.

## Acceptance Criteria

```gherkin
Given <EmptyState variant="dashboard-empty" />
When render
Then muestra:
  - Ilustración rueda 200×200px
  - Title "Aún no tienes rifas"
  - Body "Crea la primera y compártela en tu grupo de WhatsApp."
  - CTA primary "Crear rifa" (acepta href o onClick prop)

Given variant="sellers-empty"
When render
Then "Aún no hay vendedores. Agrega gente que te ayude a vender." + CTA "Agregar vendedor"

Given variant="no-results"
When render
Then "No encontramos rifas con ese filtro." + CTA "Volver a activas"

Given variant="error"
When render
Then "Algo no salió como esperábamos." + CTA "Reintentar" (onClick para retry)

Given component tests
When render cada variant
Then copy + CTA presentes
And NO usa copy genérico tipo "No data available"
```

## Implementation notes

- Pure presentational, accepts `variant` + optional `cta` props
- SVG illustrations en `src/assets/empty-states/`
- Centered vertical layout
- Copy en español neutro festivo (CORE.md §2)

## Done when

- [ ] Component + 4 variants
- [ ] 4 SVG illustrations
- [ ] Component tests
- [ ] Integrado en SCR-001 (dashboard empty), SCR-005 (sellers empty)
- [ ] `pnpm verify` pasa
