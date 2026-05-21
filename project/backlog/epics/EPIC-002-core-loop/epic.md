# EPIC-002 — Core Loop: Admin + Seller + Sale

> **Phase:** Fase 0 (~1 semana per Planner Challenge Pass)
> **Goal:** Cierra el loop "admin crea rifa → vendedor vende → sistema previene doble-venta"
> **Issues:** RIF-009 → RIF-022 (14 issues)
> **Story Points total:** ~58

## Objetivo

End-to-end demoable de la operación principal: admin configura rifa + vendedores, vendedor entra por URL secreta, registra comprador, asigna número. Concurrency atómica garantiza zero doble-venta (el invariant central del producto).

**Sin UI pulida, sin vista pública, sin sorteo todavía.** Eso es EPIC-003.

## Out of scope

- Vista pública (SCR-008/009) — EPIC-003
- Sorteo + animación — EPIC-003
- Admin tools (revert, history) — EPIC-004
- PWA / Sound — EPIC-005

## Definition of Done (epic)

- [ ] Admin puede crear rifa, agregar vendedores y compartir sus URLs
- [ ] Vendedor entra por su URL única, registra buyer, asigna número
- [ ] **E2E-002b concurrency race pasa en CI** (gate no-deploy crítico)
- [ ] BR-002 atomic UPDATE implementado correctamente (single-statement)
- [ ] BR-008 datos opcionales de buyer validados
- [ ] Coverage component test ≥80% en componentes nuevos
- [ ] `pnpm verify` pasa en cada issue antes de cerrar

## Issues

### Admin sub-epic

- [RIF-009](./issues/RIF-009-admin-dashboard-listing.md) — Admin Dashboard listing (SCR-001)
- [RIF-010](./issues/RIF-010-create-raffle-action-form.md) — Create raffle (action + SCR-002 form)
- [RIF-011](./issues/RIF-011-edit-raffle.md) — Edit raffle (US-003)
- [RIF-012](./issues/RIF-012-admin-raffle-detail.md) — Admin: Raffle Detail base (SCR-003)
- [RIF-013](./issues/RIF-013-admin-sellers-management.md) — Sellers Management (SCR-005)
- [RIF-014](./issues/RIF-014-seller-actions.md) — Server actions: createSeller, rotateSellerToken, archiveSeller
- [RIF-015](./issues/RIF-015-rafflecard-component.md) — `<RaffleCard>` (CMP-001)
- [RIF-016](./issues/RIF-016-sellercard-component.md) — `<SellerCard>` (CMP-008)

### Vendedor sub-epic

- [RIF-017](./issues/RIF-017-seller-middleware-panel.md) — Vendedor middleware + selector + SCR-006 scaffold
- [RIF-018](./issues/RIF-018-buyerform-component.md) — `<BuyerForm>` (CMP-005, FT-004)
- [RIF-019](./issues/RIF-019-ticketgrid-component.md) — `<TicketGrid>` con 3 variants (CMP-002)
- [RIF-020](./issues/RIF-020-register-buyer-action.md) — Server action `registerBuyer`
- [RIF-021](./issues/RIF-021-claim-ticket-action.md) — Server action `claimTicket` ⭐ CRITICAL (BR-002)
- [RIF-022](./issues/RIF-022-concurrency-e2e-test.md) — E2E-002b concurrency race ⭐ CRITICAL (CI gate)

## Dependencies

- EPIC-001 completo (schemas, helpers, middleware ready)
