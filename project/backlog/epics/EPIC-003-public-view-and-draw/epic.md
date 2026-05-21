# EPIC-003 — Public View & Draw

> **Phase:** Fase 1 (~1 semana per Planner Challenge Pass)
> **Goal:** Cerrar el círculo emocional del producto: vista pública compartible + sorteo verificable + ticket digital
> **Issues:** RIF-023 → RIF-034 (12 issues)
> **Story Points total:** ~52

## Objetivo

Una vez Core Loop funciona (EPIC-002), agregamos la capa visible al mundo:

- Visitante abre URL pública en WhatsApp → ve countdown, premio, grilla, hash criptográfico
- Admin ejecuta sorteo con animación rueda de la fortuna
- Visitante post-sorteo ve replay determinista + verifica el commit-reveal
- Vendedor comparte ticket digital con el comprador

Este epic incluye los componentes más visuales del producto (`<DrawWheel>`, `<Countdown>`, `<TicketDigitalCard>`).

## Out of scope

- Admin reverts (FT-011) — EPIC-004
- Dashboard polish — EPIC-004
- PWA / Sound — EPIC-005

## Definition of Done (epic)

- [ ] Visitante puede abrir URL pública sin login y ver todo
- [ ] **`seedToWinner` y `verifyDraw` son funciones puras unit-tested 100%** (RSK-005 mitigation)
- [ ] Admin ejecuta sorteo con animación visible
- [ ] Visitante post-sorteo ve replay determinista (mismo ganador)
- [ ] Commit-reveal verification funciona cliente-side con Web Crypto
- [ ] Ticket digital se comparte vía Web Share API en mobile
- [ ] **E2E-003 sorteo end-to-end pasa en CI** (gate)
- [ ] Lighthouse vista pública ≥85 performance, ≥90 a11y
- [ ] LCP ≤ 2.5s mobile 4G

## Issues

### Public view sub-epic

- [RIF-023](./issues/RIF-023-public-landing-open.md) — Pública Landing (open) — SCR-008 (RSC page)
- [RIF-024](./issues/RIF-024-countdown-component.md) — `<Countdown>` component (CMP-003)
- [RIF-025](./issues/RIF-025-commit-reveal-badge.md) — `<CommitRevealBadge>` + `<SeedCommitDisplay>`
- [RIF-026](./issues/RIF-026-public-landing-drawn.md) — Pública Landing (drawn) — SCR-009 variant

### Draw sub-epic

- [RIF-027](./issues/RIF-027-seed-to-winner-pure.md) — `seedToWinner` pure function + unit tests ⭐ CRITICAL
- [RIF-028](./issues/RIF-028-verify-draw-web-crypto.md) — `verifyDraw` SHA-256 Web Crypto + unit tests
- [RIF-029](./issues/RIF-029-execute-draw-action.md) — Server action `executeDraw` (BR-005, BR-006)
- [RIF-030](./issues/RIF-030-admin-draw-panel.md) — SCR-004 Admin Draw Panel UI
- [RIF-031](./issues/RIF-031-drawwheel-component.md) — `<DrawWheel>` SVG animation + replay (CMP-004)
- [RIF-032](./issues/RIF-032-verify-draw-button-modal.md) — `<VerifyDrawButton>` + SCR-010 Verify modal

### Ticket digital sub-epic

- [RIF-033](./issues/RIF-033-ticket-digital-share.md) — SCR-007 Ticket Digital + `<TicketDigitalCard>` + Web Share
- [RIF-034](./issues/RIF-034-draw-e2e-test.md) — E2E-003 sorteo end-to-end ⭐ CRITICAL (CI gate)

## Dependencies

- EPIC-002 completo (necesitamos ventas registradas para sortear)
