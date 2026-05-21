# project-config — Rifatela

> SSOT de configuración cross-cutting del proyecto. Referenciado desde `CLAUDE.md`.

---

## 1. Identity

- **Name:** Rifatela
- **Domain:** Gestión de rifas (single-tenant, single-admin)
- **Type:** Web app + PWA (stretch v1.1)
- **Audience:** Organizadores informales de rifas (clubes, escuelas, asociaciones, individuos)
- **Stage:** Pre-release (v0.0.0)
- **Branching:** pre-release (push directo a `main` permitido — GIT.md §4). Auto-detección por `version="0.0.0"` en `package.json`.

## 2. Stack

| Capa            | Tecnología                                      |
| --------------- | ----------------------------------------------- |
| Framework       | Next.js 16+ (App Router, Turbopack)             |
| Lenguaje        | TypeScript strict                               |
| ORM             | Drizzle                                         |
| Database        | Neon Postgres (serverless, HTTP driver)         |
| Auth            | **Deferred** — sin password en MVP (URL secret) |
| UI              | Tailwind CSS v4 + Lucide React                  |
| Testing         | Vitest (unit + component) + Playwright (E2E)    |
| Storage         | Vercel Blob (imágenes de premios)               |
| Hosting         | Vercel                                          |
| Monitoring      | Sentry                                          |
| Package manager | pnpm                                            |

## 3. Constraints

- **No multi-tenant** — single admin, single-org.
- **No payments** — la app no maneja dinero; solo tracking de ventas.
- **No notifications** — sin email/SMS/WhatsApp automático.
- **No real auth** — URLs secretas con tokens nanoid. NextAuth deferred.
- **Mobile-first** — vendedor opera 100% desde celular. Vista pública optimizada para WhatsApp share.

## 4. Critical patterns

- **Concurrency:** atomic UPDATE pattern para asignación de tickets (BR-002). Single-statement conditional, no transactions.
- **RNG auditability:** commit-reveal (sha256 del seed publicado antes del sorteo, seed revelado al sortear). BR-006.
- **Soft-delete:** `archived_at` en `Raffle` y `Seller` para preservar histórico.
- **PII minimal:** datos de comprador todos opcionales. Vista pública expone solo iniciales.

## 5. Out of scope (post-MVP v1.0)

- Múltiples premios por rifa (modelo data ya lo soporta vía tabla `Prize`)
- Pagos online
- Multi-tenant
- Auth real (password / magic link / OAuth)
- Notificaciones automáticas
- Sorteo vinculado a lotería externa
- Offline-write para vendedores (rechazado por riesgo de doble-venta)

## 6. References

- **Discovery Brief:** [`00_DISCOVERY_BRIEF.md`](./00_DISCOVERY_BRIEF.md) — v1.0 Final, SSOT de requirements
- **Rules:** `.claude/rules/` (always-on)

---

_project-config — Rifatela — generated post-discovery v1.0_
