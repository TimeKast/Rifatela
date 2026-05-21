# RIF-026: Pública Landing (drawn) — SCR-009 variant

| Field              | Value                                                           |
| ------------------ | --------------------------------------------------------------- |
| **Epic**           | EPIC-003 Public View & Draw                                     |
| **Priority**       | P0                                                              |
| **Story Points**   | 3                                                               |
| **Dependencies**   | RIF-023, RIF-031 (DrawWheel replay), RIF-032 (VerifyDrawButton) |
| **User Stories**   | US-015, US-018                                                  |
| **Features**       | FT-009, FT-013                                                  |
| **Business Rules** | BR-006, BR-015 (archivada URL pública sigue)                    |
| **Screens**        | SCR-009                                                         |
| **Agents**         | `frontend-specialist`                                           |
| **Skills**         | `kb-rsc`                                                        |

## Problem

Misma URL `/r/{publicSlug}` cambia render cuando `raffle.status='drawn'`:

- Hero con prize permanece
- DrawWheel reproduce animación con `rngSeed` + ganador (replay determinista)
- Card grande con número ganador + nombre completo del buyer
- VerifyDrawButton visible
- Grilla read-only con ganador highlighted

## Acceptance Criteria

```gherkin
Given raffle con status='drawn', winner_ticket_id, rng_seed revelado
When visitante abre /r/{publicSlug}
Then RSC render:
  - Hero (mismo que SCR-008)
  - <DrawWheel mode="replay" rngSeed={...} winnerTicketId={...} /> con autoplay
  - Card "🎉 GANADOR 🎉" con número grande + nombre completo del buyer
  - Botón "Repetir" debajo de la wheel
  - <VerifyDrawButton seedCommit rngSeed> visible (no disabled)
  - <SeedCommitDisplay> + label "Hash publicado" y separado "Seed revelado"
  - <TicketGrid variant="public" winnerTicketId> con ⭐ amarillo en el ticket ganador

Given winner.buyer.name=null (anónimo)
When render
Then muestra "Ganador: #N — Anónimo" (DD-010)

Given raffle con archived_at != NULL pero status='drawn' (BR-015)
When visitante abre la URL (link viejo de WhatsApp)
Then mismo render que drawn no-archived
And response status 200 (NO 404)

Given E2E (parte de E2E-003 y E2E-008)
When ejecuto flow completo
Then replay matchea ganador del server
And verify button funciona ✅
```

## Implementation notes

- Misma RSC page que SCR-008, conditional render based en `raffle.status`
- ISR aggressive: `revalidate: false` o year, contenido inmutable post-`drawn`
- Render `<DrawWheel>` con `key={raffle.id}` para forzar re-mount si admin re-sortea (no debería ocurrir por BR-005, pero defensive)

## Done when

- [ ] Conditional render en RSC page
- [ ] Component test con raffle drawn (autoplay, winner display, verify visible)
- [ ] E2E-003 Acto 3 covers this
- [ ] E2E-008 (archivada URL pública sigue) cubierto
- [ ] `pnpm verify` pasa
