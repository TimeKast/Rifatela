# RIF-025: `<CommitRevealBadge>` + `<SeedCommitDisplay>`

| Field            | Value                                    |
| ---------------- | ---------------------------------------- |
| **Epic**         | EPIC-003 Public View & Draw              |
| **Priority**     | P0                                       |
| **Story Points** | 2                                        |
| **Dependencies** | RIF-006                                  |
| **User Stories** | US-024                                   |
| **Features**     | FT-013                                   |
| **Design**       | CMP-010, CMP-013                         |
| **Agents**       | `frontend-specialist`, `design-engineer` |
| **Skills**       | `kb-components`                          |

## Problem

Dos componentes coordinados para verificability del sorteo (visible desde `status='open'`):

- `<CommitRevealBadge>`: chip "🔒 Sorteo verificable" con tooltip explicativo
- `<SeedCommitDisplay>`: hash hex truncado con copy button + toggle expandible

## Acceptance Criteria

```gherkin
Given un seedCommit string de 64 chars hex
When render <SeedCommitDisplay value={seedCommit} variant="truncated" />
Then muestra "a3f8b9c4...e6f7a8b9" (8 + ... + 8)
And font mono
And botón copiar (icono 📋) que copia el hash completo al clipboard
And click en el hash expande a "full" variant (muestra los 64 chars)

Given render <CommitRevealBadge />
Then chip con icono 🔒 y texto "Sorteo verificable"
And on hover/click: tooltip o modal con explicación corta del esquema commit-reveal

Given component test
When render con datos válidos
Then assertions sobre formato truncado + copy button + expand toggle
```

## Implementation notes

- Pure presentational components
- Copy button usa `navigator.clipboard.writeText()` + feedback "Copiado!" 2s
- Hash truncation: `${hash.slice(0, 8)}...${hash.slice(-8)}`
- Tooltip puede ser CSS pure o un Tooltip primitive (shadcn ya disponible per kit)

## Done when

- [ ] 2 components implementados
- [ ] Component test cada uno
- [ ] `pnpm verify` pasa
