# EPIC-001 — Foundation & Data Layer

> **Phase:** Pre-loop (sprint 0)
> **Goal:** Tener el backbone técnico listo antes de tocar features de usuario
> **Issues:** RIF-001 → RIF-008 (8 issues)
> **Story Points total:** ~26

## Objetivo

Schemas Drizzle, helpers de auth/crypto, integraciones de infra (Vercel Blob), middleware, design tokens y test fixtures. Cero features de usuario en este epic — todo es plumbing.

## Out of scope

- Cualquier UI de usuario (Admin/Vendedor/Pública)
- Lógica de negocio (sorteo, concurrency)

## Definition of Done (epic)

- [ ] 6 tablas Drizzle creadas (Raffle, Prize, Seller, Buyer, Ticket, AdminAction)
- [ ] Migrations corren limpio en Neon
- [ ] Helpers crypto, nanoid, sha256 exportados desde `src/lib/`
- [ ] `withSellerToken` wrapper estilo SK.md §2.3 disponible
- [ ] Vercel Blob upload action probado con imagen test
- [ ] Design tokens en `src/styles/tokens.css` mappeados a paleta §0.3
- [ ] Middleware con Referrer-Policy + noindex activo en rutas con token
- [ ] Test fixtures (`tests/fixtures/builders.ts`) creados
- [ ] `pnpm verify` (lint + typecheck + test) pasa

## Issues

- [RIF-001](./issues/RIF-001-setup-drizzle-schemas.md) — Setup Drizzle schemas (6 entities)
- [RIF-002](./issues/RIF-002-create-raffle-bulk-tickets.md) — Bulk insert N tickets on raffle creation
- [RIF-003](./issues/RIF-003-crypto-helpers.md) — Crypto helpers (rng_seed, sha256, nanoid)
- [RIF-004](./issues/RIF-004-withsellertoken-wrapper.md) — `withSellerToken` server action wrapper
- [RIF-005](./issues/RIF-005-vercel-blob-upload.md) — Vercel Blob upload integration
- [RIF-006](./issues/RIF-006-design-tokens.md) — Design tokens CSS variables
- [RIF-007](./issues/RIF-007-middleware-auth-headers.md) — Middleware: token routes + headers
- [RIF-008](./issues/RIF-008-test-fixtures-builders.md) — Test fixtures + entity builders

## Dependencies

- Ninguna (este epic NO depende de nada)
- Es el unblocker de EPIC-002, EPIC-003, EPIC-004
