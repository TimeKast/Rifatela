# RIF-011: Edit raffle (US-003)

| Field              | Value                                       |
| ------------------ | ------------------------------------------- |
| **Epic**           | EPIC-002 Core Loop                          |
| **Priority**       | P1                                          |
| **Story Points**   | 3                                           |
| **Dependencies**   | RIF-010                                     |
| **User Stories**   | US-003                                      |
| **Features**       | FT-001                                      |
| **Business Rules** | BR-010 (inmutabilidad post-sorteo)          |
| **Screens**        | SCR-002 (variant edit)                      |
| **Agents**         | `backend-specialist`, `frontend-specialist` |
| **Skills**         | `kb-server-actions`, `kb-forms`             |
| **API Contract**   | `editRaffle(input)` doc 08                  |

## Problem

Admin puede editar name/prize/image/draw_date de una rifa **pre-sorteo**. Si rifa ya sorteada → form readonly + banner. Si hay tickets vendidos, `max_tickets` no se puede reducir bajo `sold_count`.

## Acceptance Criteria

```gherkin
Given rifa con status='open' y 0 tickets vendidos
When admin edita name + prize_text + draw_date y submit
Then los cambios persisten
And se registra AdminAction(action_type='edit_raffle', details={changes})

Given rifa con status='open' y 23 tickets vendidos
When admin intenta reducir max_tickets a 20
Then form muestra error "no se puede reducir bajo sold_count" (validation)

Given rifa con status='drawn'
When admin abre /admin/{token}/raffles/{id}/edit
Then ve banner "Rifa sorteada, no editable"
And todos los inputs están disabled
And submit button está disabled

Given un attempt programático de editRaffle sobre rifa drawn
When la action ejecuta
Then retorna { ok: false, code: 'raffle_immutable' } (BR-010)

Given E2E test
When ejecuto edit pre-sorteo y post-sorteo attempt
Then validation funciona como spec
```

## Implementation notes

- Reusar `<CreateRaffleForm>` con prop `mode="edit"` + `initialValues`
- Server action `editRaffle` con Zod schema con campos opcionales
- Validation server-side: rechazar mutations si `status='drawn'` (middleware check ya cubre via BR-010)
- AdminAction insert con diff de cambios

## Done when

- [ ] Server action `editRaffle`
- [ ] Form en mode='edit'
- [ ] Component test: form readonly cuando status='drawn'
- [ ] E2E: editar pre-sorteo + intentar editar post-sorteo (debe fallar)
- [ ] `pnpm verify` pasa
