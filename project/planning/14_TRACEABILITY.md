# 14 — Traceability Matrix

> **Proyecto:** Rifatela
> **Estado:** v1.0
> **Purpose:** Cross-reference matrix de la suite completa. SSOT para `/backlog` (cada FT → US → BR → E → tests deben aparecer en issues).

---

## Matrix principal: FT ↔ US ↔ BR ↔ E ↔ Tests

| FT     | Feature                    | US                     | BR                     | Entities            | E2E                                    | Component / Unit                                                    |
| ------ | -------------------------- | ---------------------- | ---------------------- | ------------------- | -------------------------------------- | ------------------------------------------------------------------- |
| FT-001 | Admin crea rifa            | US-001, US-002, US-003 | BR-006, BR-010         | E-001, E-002, E-005 | E2E-001                                | `createRaffle.test.ts`, `<RaffleForm>`                              |
| FT-002 | Admin gestiona vendedores  | US-004, US-005, US-006 | BR-012, BR-013         | E-003, E-006        | E2E-005, E2E-007                       | `createSeller`, `rotateSellerToken`, `<SellerList>`                 |
| FT-003 | Vendedor login             | US-007, US-008         | (auth middleware)      | E-003               | (covered en otros)                     | middleware test                                                     |
| FT-004 | Registra comprador         | US-009                 | BR-008                 | E-004               | E2E-002, E2E-009                       | `<BuyerForm>`, validation                                           |
| FT-005 | Asigna número              | US-010, US-011         | BR-001, BR-002         | E-005, E-004, E-003 | E2E-002, E2E-002b                      | `claimTicket.test.ts`                                               |
| FT-006 | Concurrency atómica        | US-012                 | **BR-001, BR-002**     | E-005               | **E2E-002b @critical**                 | `claimTicket.test.ts` (rowCount=0 path)                             |
| FT-007 | Vista pública              | US-013, US-014, US-015 | BR-003, BR-009, BR-015 | E-001, E-002, E-005 | E2E-001, E2E-008                       | `<PublicTicketGrid>`, `<RaffleCountdown>`, `publicInitials.test.ts` |
| FT-008 | Sorteo manual              | US-016, US-017         | BR-004, BR-005, BR-010 | E-001, E-005        | E2E-003, E2E-006                       | `executeDraw.test.ts`, `seedToWinner.test.ts`                       |
| FT-009 | Replay determinista        | US-018                 | BR-004, BR-005, BR-006 | E-001               | E2E-003 (parte Acto 3)                 | `<DrawWheel>`, `seedToWinner` determinismo                          |
| FT-010 | Ticket digital             | US-019                 | (display)              | E-005, E-004, E-003 | E2E-002 (parte final)                  | `<TicketDigital>`, share button                                     |
| FT-011 | Admin revierte             | US-020, US-021         | BR-010, BR-011         | E-005, E-006        | E2E-004                                | `revertSale.test.ts`, admin-only enforcement                        |
| FT-012 | Admin dashboard            | US-022, US-023         | (read-only)            | E-001, E-003, E-005 | (smoke en E2E-001)                     | `<AdminDashboard>` con 0/1/N rifas                                  |
| FT-013 | Verificación commit-reveal | US-024, US-025         | BR-006                 | E-001               | E2E-003 (Actos 1+3)                    | `verifyDraw.test.ts`, `<VerifyDrawButton>`                          |
| FT-014 | Mobile-first baseline      | (cross-cutting AC)     | (UX)                   | —                   | Viewport 375 en todos los E2E críticos | Visual regression opcional                                          |
| FT-015 | PWA (stretch)              | US-026                 | —                      | —                   | E2E-S01                                | Lighthouse PWA audit                                                |
| FT-016 | Sonido sorteo (stretch)    | US-027                 | —                      | —                   | E2E-S02 manual                         | `<DrawWheel>` audio + localStorage                                  |

---

## BR coverage map (cada BR → dónde se valida)

| BR                                        | Validated in                         | Test layer                              |
| ----------------------------------------- | ------------------------------------ | --------------------------------------- |
| BR-001 Uniqueness tickets                 | DB unique constraint + atomic UPDATE | DB migration test, unit                 |
| **BR-002 Atomic conditional UPDATE**      | `claimTicket` server action          | **E2E-002b @critical** + unit           |
| BR-003 Espera al countdown                | Vista pública con sold==max          | E2E-001 ampliado                        |
| BR-004 Sorteo entre vendidos              | `seedToWinner`                       | Unit + E2E-003                          |
| BR-005 Sorteo único                       | `executeDraw` preconditions          | E2E-003, E2E-006, unit                  |
| BR-006 Commit-reveal                      | `seedCommit` + `rngSeed` reveal      | E2E-003 (3 actos), `verifyDraw.test.ts` |
| BR-007 Rifa con 0 ventas                  | `executeDraw` precondition           | Unit test `executeDraw` soldCount=0     |
| BR-008 Datos opcionales buyer             | `<BuyerForm>` + Zod                  | Component + E2E-009                     |
| BR-009 Iniciales en vista pública         | `publicInitials` + grid render       | Unit + Component test PII smoke         |
| BR-010 Inmutabilidad post-sortéo          | Middleware en mutations              | E2E-006, E2E-004 negative               |
| BR-011 Revertir solo admin                | `revertSale` admin check             | E2E-004 + US-021 negative               |
| BR-012 Rotación token                     | `rotateSellerToken`                  | E2E-007                                 |
| BR-013 Vendedor archivado preserva ventas | `archiveSeller`                      | E2E-005                                 |
| BR-014 No borrar con ventas               | `archiveRaffle` vs delete            | API contract test                       |
| BR-015 Rifa archivada URL pública activa  | RSC `/r/{slug}`                      | E2E-008                                 |

---

## Entity usage (cada Entity → quién la lee/escribe)

| Entity            | Used by features                       | Read by                                                   | Mutated by                                                                        |
| ----------------- | -------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| E-001 Raffle      | FT-001, FT-007, FT-008, FT-012, FT-013 | Admin dashboard, vista pública, vendedor panel            | `createRaffle`, `editRaffle`, `executeDraw`, `archiveRaffle`                      |
| E-002 Prize       | FT-001, FT-007                         | Vista pública, ticket digital                             | `createRaffle` (insert), `editRaffle` (update text/img)                           |
| E-003 Seller      | FT-002, FT-003                         | Admin dashboard, middleware auth                          | `createSeller`, `rotateSellerToken`, `archiveSeller`                              |
| E-004 Buyer       | FT-004, FT-007 (initials), FT-010      | Vendedor panel, vista pública (iniciales), ticket digital | `registerBuyer` (insert only, no updates en MVP)                                  |
| E-005 Ticket      | FT-005, FT-006, FT-008, FT-011         | Vista pública (grid), vendedor (grid), admin (detalle)    | `claimTicket`, `revertSale`, `executeDraw` (winner only)                          |
| E-006 AdminAction | FT-002, FT-011                         | Admin dashboard (historial)                               | `revertSale`, `rotateSellerToken`, `archiveRaffle`, `archiveSeller`, `editRaffle` |

---

## Risk → mitigations (cross-ref con doc 13)

| RSK                            | Mitigated by                                           | Validated by                              |
| ------------------------------ | ------------------------------------------------------ | ----------------------------------------- |
| RSK-001 Doble venta            | BR-002 + DB unique + E2E test gate                     | E2E-002b in CI critical gate              |
| RSK-002 URL-secret leak        | ADR-003 + BR-012 + tokens in path + noindex            | Accepted by user (R1) + middleware tests  |
| RSK-003 PII expuesta           | BR-009 + types discriminados + logger sanitization     | `publicInitials.test.ts` + PII smoke test |
| RSK-004 Image upload malicious | Zod MIME/size + filename derivado + Vercel Blob origin | `createRaffle.test.ts` validation paths   |
| RSK-005 Replay tampering       | Pure function `seedToWinner` + sort consistency        | Determinism unit + E2E-003                |
| RSK-006 Browser sync leak      | BR-012 rotation                                        | (operational, no test)                    |
| RSK-007 Neon outage            | SLA + PITR + Sentry                                    | (infra, no test)                          |
| RSK-008 Admin error            | Confirm dialogs + BR-010 + AdminAction log             | E2E confirm flows                         |
| RSK-009 Rate limit             | Vercel default + CSRF Next.js                          | (none in MVP)                             |

---

## Discovery decision → doc reference (anti-drift trace)

> Cada decisión firme F1-F27 del brief debe aparecer reflejada en al menos 1 doc downstream.

| Brief decision                               | Reflected in                                    |
| -------------------------------------------- | ----------------------------------------------- |
| F1 App para rifas                            | All docs (general)                              |
| F2 Cargar rifa                               | FT-001, US-001..003                             |
| F3 Vendedores                                | FT-002, FT-003, E-003                           |
| F4 Vendedores suben compradores              | FT-004, US-009                                  |
| F5 Fecha sorteo                              | E-001 `drawDate`, BR-005                        |
| F6 Countdown                                 | FT-007 (vista pública), `<RaffleCountdown>`     |
| F7 Sortear premio en fecha                   | FT-008, BR-005                                  |
| F8 Nombre Rifatela                           | All branding refs                               |
| F9 Single-tenant                             | ADR-003, no multi-org en schema                 |
| F10 max_tickets cerrado                      | E-001 `maxTickets`, BR-001                      |
| F11 Comprador elige número                   | FT-005, US-010                                  |
| F12 Sin pagos                                | No payment integration (RSK exclusion)          |
| F13 Sorteo RNG + animación                   | FT-008 + `<DrawWheel>`                          |
| F14 Sin password vendedor                    | ADR-003, BR-012                                 |
| F15 Vendedor: pantalla compradores + números | FT-003 panel, FT-005                            |
| F16 1 premio MVP, modelo multi               | E-002 Prize table desde MVP                     |
| F17 Vista pública                            | FT-007, US-013..015                             |
| F18 Datos comprador opcionales               | BR-008, E-004 nullable, US-009                  |
| F19 Sorteo entre vendidos                    | BR-004                                          |
| F20 Espera countdown                         | BR-003, US-014                                  |
| F21 Multi-device                             | FT-014 mobile-first                             |
| F22 Español neutro                           | Glossary + UI strings                           |
| F23 PWA                                      | FT-015 (downgraded a stretch B6)                |
| F24 Sin auth real                            | ADR-003                                         |
| F25 Sin notificaciones                       | Out of scope `03_USER_PERSONAS.md` + arch       |
| F26 Premio texto + imagen                    | E-002 `Prize`                                   |
| F27 Carnaval + rueda                         | FT-008 `<DrawWheel>`, branding section in brief |

Challenge Pass blockers:

| Block                         | Reflected in                      |
| ----------------------------- | --------------------------------- |
| B1 Atomic UPDATE              | BR-002, ADR-001, FT-006           |
| B2 Replay only                | ADR-002, FT-009                   |
| B3 Admin reverts only         | BR-011, FT-011, E-006 AdminAction |
| B4 Iniciales + ticket digital | BR-009, FT-010                    |
| B5 Commit-reveal              | BR-006, ADR-002, FT-013           |
| B6 PWA stretch                | FT-015 SHOULD                     |
| B7 Prize table MVP            | E-002                             |
| B8 Token rotation             | BR-012, FT-002                    |

---

## Backlog readiness checklist

Cada FT debe poder convertirse en ≥1 issue ejecutable con DoR completo (per `DOR_DOD.md`). Esta matriz garantiza que:

- [x] Cada FT tiene ≥1 US definida
- [x] Cada US referencia BRs aplicables
- [x] Cada BR tiene mecanismo de validación (test)
- [x] Cada entidad referenciada existe en `06_DATA_MODEL.md`
- [x] Cada server action tiene contrato en `08_API_CONTRACTS.md`
- [x] Cada flujo crítico tiene E2E en `12_E2E_SCENARIOS.md`
- [x] Cada decisión del brief (F1-F27) está trazada a downstream doc

> **Listo para `/backlog`.**

---

## Document index (suite completa)

| #   | Doc             | Status                    | Lines aprox |
| --- | --------------- | ------------------------- | ----------- |
| 00  | Discovery Brief | ✅ v1.0 Final             | ~500        |
| 01  | Proposal        | ⏸ pendiente (`/proposal`) | —           |
| 02  | Feature Map     | ✅ v1.0                   | ~250        |
| 03  | User Personas   | ✅ v1.0                   | ~190        |
| 04  | User Stories    | ✅ v1.0                   | ~600        |
| 05  | Business Rules  | ✅ v1.0                   | ~430        |
| 06  | Data Model      | ✅ v1.0                   | ~390        |
| 07  | Architecture    | ✅ v1.0                   | ~460        |
| 08  | API Contracts   | ✅ v1.0                   | ~340        |
| 09  | Glossary        | ✅ v1.0                   | ~210        |
| 10  | Runbooks        | ✅ v1.0                   | ~290        |
| 11  | Test Strategy   | ✅ v1.0                   | ~390        |
| 12  | E2E Scenarios   | ✅ v1.0                   | ~430        |
| 13  | Risk Register   | ✅ v1.0                   | ~330        |
| 14  | Traceability    | ✅ v1.0 (this doc)        | —           |
|     | **Total**       | **13/13 ready**           | ~4,800      |

---

_14 Traceability — Rifatela — Cross-reference completa: 16 FT × 27 US × 15 BR × 6 E × 9 RSK × 12 E2E + 27 brief decisions trazadas_
