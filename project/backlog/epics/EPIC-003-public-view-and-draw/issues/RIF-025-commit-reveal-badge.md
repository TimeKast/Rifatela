# RIF-025: `<CommitRevealBadge>` + `<SeedCommitDisplay>`

| Field            | Value                                    |
| ---------------- | ---------------------------------------- |
| **Epic**         | EPIC-003 Public View & Draw              |
| **Priority**     | P0                                       |
| **Story Points** | 2                                        |
| **Status**       | Completed (2026-05-22)                   |
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

- [x] `<SeedCommitDisplay>` con truncate `8…8`, click-to-expand al full hash, botón copiar con feedback "¡Copiado!" 2s ✅
- [x] `<CommitRevealBadge>` chip "🔒 Sorteo verificable" con tooltip vía `title=` ✅
- [x] Co-localizados en `src/components/raffles/SeedCommitDisplay.tsx` (mismo dominio, ambos < 50 LOC) ✅
- [x] `pnpm typecheck` + `pnpm lint` + `pnpm build` PASS ✅
- [ ] Component test — _diferido per kit pattern_

## ✅ Implementation Evidence (2026-05-22)

- Tooltip implementado con `title=` HTML nativo en lugar de un componente Tooltip de shadcn — más simple, accesible por default. Si el copy mejora con un modal explicativo full, se reescribe ahí.
- El `SeedCommitDisplay` se usa para 2 valores en la landing pública: el commit (siempre visible) y el seed revelado (solo cuando `status='drawn'`).
