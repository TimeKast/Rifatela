# EPIC-004 — Admin Tools & Polish

> **Phase:** Fase 2 (~3-5 días per Planner Challenge Pass)
> **Goal:** Sad paths del admin + pulido mobile-first + accessibility budget
> **Issues:** RIF-035 → RIF-041 (7 issues)
> **Story Points total:** ~24

## Objetivo

Después de tener el Core Loop + Public/Draw funcionando, agregamos:

- Admin tools operacionales: revertir venta, archivar rifa, ver historial de acciones
- Empty states amigables
- Error pages
- Mobile polish + Lighthouse audits en CI
- a11y validation con axe-core

Sin este epic el MVP funciona pero queda "rough around the edges". Con este epic el MVP es production-ready.

## Out of scope

- PWA install — EPIC-005 (stretch)
- Sound en sorteo — EPIC-005 (stretch)

## Definition of Done (epic)

- [ ] Admin puede revertir ventas pre-sorteo con razón opcional (FT-011)
- [ ] AdminAction log visible en SCR-003 (CMP-012)
- [ ] Rifas archivables (BR-014, BR-015) — URL pública sigue funcionando
- [ ] Empty states en dashboard + sellers (CMP-015)
- [ ] 404 / error page consistente (SCR-011)
- [ ] **Lighthouse CI verde** sobre vista pública (≥85 perf, ≥90 a11y)
- [ ] **axe-core sin violaciones** en E2E críticos
- [ ] Mobile-first 375px verificado en todos los flows

## Issues

- [RIF-035](./issues/RIF-035-admin-revert-sale.md) — Admin revierte venta (FT-011)
- [RIF-036](./issues/RIF-036-admin-action-log-component.md) — `<AdminActionLog>` component (CMP-012)
- [RIF-037](./issues/RIF-037-archive-raffle.md) — Archive raffle (BR-014, BR-015)
- [RIF-038](./issues/RIF-038-empty-states.md) — `<EmptyState>` component (CMP-015)
- [RIF-039](./issues/RIF-039-error-404-page.md) — 404 / Error pages (SCR-011)
- [RIF-040](./issues/RIF-040-lighthouse-ci.md) — Lighthouse CI + mobile polish (FT-014)
- [RIF-041](./issues/RIF-041-a11y-audit.md) — Accessibility audit (axe-core in E2E)

## Dependencies

- EPIC-002 completo (revert requiere ventas)
- EPIC-003 completo (archive flow incluye rifas drawn)
