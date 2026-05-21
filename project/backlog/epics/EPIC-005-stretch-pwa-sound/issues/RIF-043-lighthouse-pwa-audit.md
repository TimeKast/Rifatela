# RIF-043: Lighthouse PWA audit + iconos finales

| Field            | Value                                 |
| ---------------- | ------------------------------------- |
| **Epic**         | EPIC-005 Stretch PWA + Sound          |
| **Priority**     | P2                                    |
| **Story Points** | 2                                     |
| **Dependencies** | RIF-042                               |
| **Agents**       | `quality-engineer`, `design-engineer` |
| **Skills**       | `kb-lighthouse`, `kb-pwa`             |

## Problem

Validar PWA audit Lighthouse ≥ 90 + producir iconos finales (no placeholders).

## Acceptance Criteria

```gherkin
Given Lighthouse PWA audit en CI
When corre sobre / (PWA-eligible page)
Then PWA score ≥ 90
And checks específicos pasan:
  - Manifest válido
  - Service worker registered
  - Themed splash screen
  - Installable
  - HTTPS (Vercel default)

Given iconos finales generados desde logo
When verifico /public/icons/
Then existe 192×192, 512×512, maskable 512×512 PNG
And cumplen safe area requirements para maskable
```

## Implementation notes

- PWA score depende del logo (OQ-D1) — si todavía no hay logo concreto, este issue queda blocked
- Alternativa: usar placeholder estilizado (R en círculo con paleta carnaval) que funcione hasta tener logo final
- Maskable: safe area en centro 80% (no clip on Android home screen)

## Done when

- [ ] 3 iconos finales en `/public/icons/`
- [ ] manifest.ts referencia los iconos correctos
- [ ] Lighthouse CI gate PWA ≥ 90
- [ ] `pnpm verify` pasa
