# RIF-016: `<SellerCard>` component (CMP-008)

| Field            | Value                                    |
| ---------------- | ---------------------------------------- |
| **Epic**         | EPIC-002 Core Loop                       |
| **Priority**     | P0                                       |
| **Story Points** | 2                                        |
| **Dependencies** | RIF-006, RIF-014                         |
| **User Stories** | US-004, US-005, US-006                   |
| **Design**       | CMP-008                                  |
| **Agents**       | `frontend-specialist`, `design-engineer` |
| **Skills**       | `kb-components`                          |

## Problem

Card visual para vendedor en SCR-005. 3 variants: `active`, `archived`, `copy-mode` (post-create/rotate banner).

## Acceptance Criteria

```gherkin
Given seller activo con accessToken, salesCount=24
When render <SellerCard variant="active" seller={...} />
Then muestra: name, salesCount, URL (con toggle 👁️ visible/hidden), botones Copiar / Rotar / Archivar

Given seller archived
When render variant="archived"
Then opacity 0.5, badge "Archivado", solo muestra salesCount; sin botones de mutación

Given variant="copy-mode" (post create o post rotate)
When render
Then banner verde con URL completa resaltada + botón "Copiar" prominente + "Continuar" para volver a active variant

Given URL con toggle hidden
When user click toggle
Then la URL aparece visible

Given click "Copiar"
When clipboard API disponible
Then copia la URL completa al clipboard
And muestra feedback "Copiado!" 2s

Given component test interactive
When click Rotar
Then onRotate callback se invoca (the dialog logic vive en padre RIF-013)
```

## Implementation notes

- Pure presentational + callbacks externos
- Toggle 👁️ default hidden (mejor UX que mostrar 32 chars de token siempre)
- Mobile: stack vertical; Desktop: row table layout

## Done when

- [ ] Component + Storybook smoke (si existe) o manual visual check
- [ ] Component tests para cada variant + interactions
- [ ] `pnpm verify` pasa
