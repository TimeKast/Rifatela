# RIF-030: SCR-004 Admin Draw Panel UI

| Field            | Value                                    |
| ---------------- | ---------------------------------------- |
| **Epic**         | EPIC-003 Public View & Draw              |
| **Priority**     | P0                                       |
| **Story Points** | 3                                        |
| **Dependencies** | RIF-029, RIF-031                         |
| **User Stories** | US-016, US-017                           |
| **Features**     | FT-008                                   |
| **Screens**      | SCR-004                                  |
| **Components**   | CMP-004 DrawWheel, CMP-009 ConfirmDialog |
| **Agents**       | `frontend-specialist`                    |
| **Skills**       | `kb-rsc`, `kb-animations`                |

## Problem

UI para que admin ejecute el sorteo. Pre-sorteo: botón "Ejecutar Sorteo" + countdown. Durante: wheel animado (4s). Post: ganador revelado con confetti + acciones share.

## Acceptance Criteria

```gherkin
Given admin en /admin/{token}/raffles/{id}/draw, status='open', draw_date <= now()
When la page carga
Then ve hero "Rifa {name}" + "Sorteando entre {N} boletos"
And ve DrawWheel en estado idle (no animado, mostrando segments con tickets vendidos)
And botón "Ejecutar Sorteo" prominent + visible

Given click "Ejecutar Sorteo"
When confirm dialog aparece (ConfirmDialog destructive — irreversible)
And confirmo
Then action executeDraw se invoca
And UI transiciona a estado "sorteando" — wheel spin 4s
And countdown "3 · 2 · 1 · ¡SORTEO!"
And background dimmed

Given action retorna ok con ganador
When animación termina
Then card grande aparece con "🎉 GANADOR 🎉" + número + nombre completo
And confetti burst 1.2s
And botones secundarios: "Compartir resultado", "Ver vista pública"

Given action falla (precondition)
When falla
Then toast con error en español neutro
And UI vuelve a estado idle

Given status='drawn' (re-acceso post-sorteo)
When admin abre /draw URL
Then NO ve botón "Ejecutar" (BR-005)
And ve directamente el resultado con replay de la animación
And mensaje "Sorteo ejecutado el {fecha}"

Given component test
When ejecuto integrations con action mock
Then assertions sobre transitions de estado UI
```

## Implementation notes

- RSC + Client Component híbrido (action en client, layout en RSC)
- `<DrawWheel>` (RIF-031) usado con `mode="live"` en pre-sorteo, transitions a `mode="replay"` post-action result
- Confetti via library (canvas-confetti o similar) — overlay absolute positioned
- Audio toggle (FT-016, stretch) NO implementado en este issue — solo placeholder UI

## Done when

- [ ] Page + Client Component con state machine (idle/spinning/result)
- [ ] Component tests por cada estado
- [ ] E2E-003 cubre flow completo
- [ ] `pnpm verify` pasa
