# 07 — Architecture

> **Proyecto:** Rifatela
> **Source:** [`00_DISCOVERY_BRIEF.md`](./00_DISCOVERY_BRIEF.md) §8 + Challenge Pass blockers
> **Estado:** v1.0
> **Stack:** Next.js 16 + TypeScript + Drizzle + Neon + Vercel + Tailwind

---

## C4 — Nivel 1 (System Context)

```
                    ┌─────────────────────────────────┐
                    │       Rifatela (system)         │
                    │   Single-tenant raffle web app  │
                    └────────┬───────────┬────────────┘
                             │           │
              ┌──────────────┘           └──────────────┐
              │                                         │
              ▼                                         ▼
       ┌────────────┐                          ┌────────────────┐
       │   Users    │                          │   Vercel       │
       │  (3 roles) │                          │   Platform     │
       │ Admin      │                          │  - Hosting     │
       │ Vendedor   │                          │  - Vercel Blob │
       │ Visitante  │                          │  - Edge cache  │
       └────────────┘                          └────────────────┘
                                                       │
                                                       ▼
                                              ┌────────────────┐
                                              │  Neon Postgres │
                                              │   (serverless) │
                                              └────────────────┘

       Additional: Sentry (error monitoring, included via starter kit)
```

**Boundaries:**

- Sin integraciones externas en MVP (no pagos, no notifications, no lottery).
- Storage de imágenes: Vercel Blob (incluido en plataforma).
- DB: Neon Postgres serverless (incluido en starter kit).

---

## C4 — Nivel 2 (Container)

```
┌────────────────────────────────────────────────────────────────────┐
│                  Next.js App (App Router, Vercel)                  │
│                                                                    │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐      │
│  │  Pages       │    │ Server Actions│    │  Middleware      │      │
│  │  /admin/...  │───▶│ createRaffle  │    │  (auth gate)     │      │
│  │  /v/{token}  │    │ claimTicket   │    │ /admin → admin   │      │
│  │  /r/{slug}   │    │ executeDraw   │    │ /v/{t} → seller  │      │
│  │              │    │ revertSale    │    │ /r/{s} → public  │      │
│  │              │    │ rotateToken   │    │                  │      │
│  │              │    │ archiveRaffle │    │                  │      │
│  └──────┬───────┘    └──────┬───────┘    └──────────────────┘      │
│         │                   │                                      │
│         │  React Server     │  withAuth() / withRole()             │
│         │  Components       │  wrappers (per `SK.md §2.3`)         │
│         ▼                   ▼                                      │
│  ┌──────────────────────────────────────────┐                      │
│  │           Drizzle ORM (single layer)      │                      │
│  │   schema/{raffles,prizes,sellers,         │                      │
│  │           buyers,tickets,admin-actions}.ts│                      │
│  └────────────────┬──────────────────────────┘                      │
└───────────────────│──────────────────────────────────────────────────┘
                    │ (Neon HTTP driver — single-statement only)
                    ▼
            ┌─────────────────┐
            │ Neon Postgres   │
            │   (serverless)  │
            └─────────────────┘

External boundaries:
  ↑ Vercel Blob (image upload for prizes)
  ↑ Sentry (error capture from server actions + client errors)
  ↑ Web Crypto API (client-side commit-reveal verification)
```

**Container responsibilities:**

| Container              | Responsibilities                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| **Pages (App Router)** | RSC para data fetching, layouts por rol, vistas públicas SSG-friendly                                 |
| **Server Actions**     | TODA mutación (crear rifa, vender, sortear, revertir, etc.) — no REST API público en MVP              |
| **Middleware**         | Validación de tokens en `/admin/*` y `/v/*`; `Referrer-Policy: no-referrer` para rutas con token      |
| **Drizzle layer**      | Single source of schema; helpers (`withAuth`, atomic UPDATE patterns) en `src/lib/actions/helpers.ts` |
| **Neon Postgres**      | Persistencia. HTTP driver (no WebSocket en MVP — no requerimos multi-statement TX)                    |

---

## C4 — Nivel 3 (Components — Server Actions principales)

```
┌─ Raffle domain ──────────────────────────────────────────┐
│                                                          │
│  createRaffle(input)                                     │
│    ├─ generateSeed() → rngSeed                           │
│    ├─ sha256(rngSeed) → seedCommit                       │
│    ├─ nanoid(10) → publicSlug                            │
│    ├─ tx-less sequence:                                  │
│    │   • INSERT raffle                                   │
│    │   • INSERT prize (position=1)                       │
│    │   • INSERT N tickets (bulk)                         │
│    └─ revalidatePath('/admin')                           │
│                                                          │
│  executeDraw(raffleId)                                   │
│    ├─ assertAdmin + assertOpen + assertDrawDateReached   │
│    ├─ SELECT sold tickets ORDER BY number                │
│    ├─ seedToWinner(rngSeed, soldIds)                     │
│    ├─ UPDATE raffle SET winnerTicketId, drawnAt,         │
│    │                    status='drawn', rngSeed=...      │
│    │     WHERE id=? AND status='open' RETURNING *        │
│    └─ revalidatePath('/admin', '/r/{slug}')              │
│                                                          │
│  archiveRaffle(raffleId)                                 │
│  editRaffle(raffleId, changes)                           │
│                                                          │
└──────────────────────────────────────────────────────────┘

┌─ Seller domain ─────────────────────────────────────────┐
│                                                         │
│  createSeller(name) → { id, accessToken, url }          │
│  rotateSellerToken(sellerId) → { newAccessToken }       │
│  archiveSeller(sellerId)                                │
│                                                         │
└─────────────────────────────────────────────────────────┘

┌─ Sale domain (CRITICAL CONCURRENCY) ────────────────────┐
│                                                         │
│  registerBuyer(input) → { buyerId }                     │
│    └─ INSERT buyer (idempotent, all fields nullable)    │
│                                                         │
│  claimTicket({ ticketId, buyerId, sellerToken })        │
│    ├─ assertSeller from sellerToken                     │
│    ├─ assertOpen (raffle status)                        │
│    ├─ ATOMIC UPDATE (BR-002):                           │
│    │   UPDATE tickets                                   │
│    │      SET status='sold', buyerId=?,                 │
│    │          sellerId=?, soldAt=NOW()                  │
│    │    WHERE id=? AND status='available'               │
│    │   RETURNING *                                      │
│    ├─ if rowCount==0 → throw ConflictError              │
│    └─ revalidatePath('/r/{slug}', '/v/{token}')         │
│                                                         │
│  revertSale(ticketId, reason?)  -- admin only           │
│    ├─ assertAdmin + assertRaffleNotDrawn                │
│    ├─ UPDATE tickets SET status='available',            │
│    │          buyerId=NULL, sellerId=NULL, soldAt=NULL  │
│    │    WHERE id=?                                      │
│    └─ INSERT adminAction(action_type='revert_sale',     │
│            details={reason,prevBuyerId,prevSellerId})   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## ADR-001 — Concurrency: Atomic Conditional UPDATE

**Status:** Accepted
**Date:** 2026-05-20
**Source:** Challenge Pass B1, BR-002, FT-006

### Context

Múltiples vendedores pueden intentar vender el mismo número simultáneamente. El brief declara como North Star "zero doble-venta". El stack es Neon Postgres con HTTP driver (no soporta multi-statement transactions de forma nativa sin WebSocket driver).

### Options considered

| Option                                      | Pros                                                                                         | Cons                                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **(A) Atomic conditional UPDATE** (chosen)  | Single-statement, atómico en Postgres por default, compatible con Neon HTTP, mínima latencia | Requiere manejar 409 en UX (no es solo "actualizar"); side: buyer se crea separado antes del claim |
| (B) `SELECT FOR UPDATE` + `UPDATE` en TX    | Patrón clásico SQL, semánticamente claro                                                     | Necesita WebSocket driver de Neon, +complejidad infra, mayor latencia (2 roundtrips)               |
| (C) Postgres advisory locks                 | Lock por ticket, granular                                                                    | Overkill, requiere TX, no resuelve UX (cliente sigue compitiendo)                                  |
| (D) Optimistic concurrency con version/etag | Funciona offline-first, escalable                                                            | Sobre-engineering para single-org single-region; agrega columna `version` y lógica adicional       |

### Decision

**Option A.** Patrón:

```sql
UPDATE tickets SET status='sold', buyer_id=?, seller_id=?, sold_at=NOW()
 WHERE id=? AND status='available'
 RETURNING *
```

Si `rowCount=0` → server retorna 409 → UX muestra toast y refresca grilla.

### Consequences

- ✅ **Cero doble-venta garantizado** por DB engine (single-statement UPDATE es ACID-isolated en Postgres).
- ✅ **Compatible con Neon HTTP driver** — no requiere migrar a WebSocket en MVP.
- ✅ **Latencia baja** — 1 roundtrip a DB.
- ⚠️ **Side path obligatorio:** crear `Buyer` ANTES del claim (idempotente, sin side effects); si el claim falla, queda un Buyer huérfano (aceptado — Buyers son baratos en storage).
- ⚠️ **UX debe manejar 409 elegantemente** — toast + auto-refresh de grilla.

### Validated by

- BR-002 (definición exacta del patrón)
- US-012 (E2E concurrency test con `Promise.all`)
- Unit test sobre `claimTicket` con mock de `rowCount=0`

---

## ADR-002 — Sorteo: Replay determinista + Commit-Reveal

**Status:** Accepted
**Date:** 2026-05-20
**Source:** Challenge Pass B2 + B5, BR-005, BR-006, FT-008, FT-009, FT-013

### Context

El sorteo debe ser (1) verificable post-hoc (commit-reveal), (2) visualmente atractivo (animación rueda), y (3) sincronizable entre admin y N visitantes públicos sin infra extra.

### Options considered para sync

| Option                               | Pros                                                                                                                  | Cons                                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **(A) Replay determinista** (chosen) | Cero infra extra, scaling natural (cualquiera entra y ve la misma animación), animación es función pura de `rng_seed` | El admin y los visitantes NO ven la animación al mismo tiempo (cada uno la dispara al abrir) |
| (B) Real-time sync (websockets/SSE)  | Sincronización en vivo entre admin y visitantes                                                                       | Requiere Pusher/Ably/Vercel KV + complejidad, costo, posible vendor lock-in                  |
| (C) Server-Sent Events nativos       | Sin vendor lock-in, simple                                                                                            | Vercel serverless limita SSE long-lived; aún tiene complejidad de presencia                  |

### Options considered para auditability

| Option                                     | Pros                                                                                 | Cons                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| **(A) Commit-reveal lightweight** (chosen) | 1 columna + 1 hash; verificable cliente-side con Web Crypto API; cero crypto exótico | Requiere que admin no regenere seed post-`open` (enforced server-side) |
| (B) Solo persistir seed post-sorteo        | Más simple                                                                           | Admin podría generar N seeds y elegir el favorable → 0 trust           |
| (C) VDF / blockchain-anchored seed         | Trust maximal                                                                        | Overkill brutal para MVP single-org                                    |

### Decision

**Replay (A) + Commit-Reveal lightweight (A).**

**Sequence:**

1. `createRaffle`: server genera `rngSeed` con `crypto.randomBytes(32)`; calcula `seedCommit = sha256Hex(rngSeed)`; persiste `seedCommit`. **NO expone `rngSeed`**.
2. `open` status: `seedCommit` visible en vista pública.
3. `executeDraw`: server lee `rngSeed`, ejecuta `seedToWinner(rngSeed, soldTicketIds)`, persiste `winnerTicketId`, `drawnAt`, **`rngSeed` (revelado)**, `status='drawn'`.
4. Vista pública post-draw: lee `rngSeed`, ejecuta `seedToWinner` cliente-side (animación rueda), calcula `sha256(rngSeed)` y compara con `seedCommit` → muestra ✅/❌.

### Consequences

- ✅ **Cero infra extra** — sin websockets, sin presence service, sin polling.
- ✅ **Animación reproducible** — el visitante que entra 3 días después ve la misma rueda.
- ✅ **Trust verificable** — cualquiera valida `sha256(seed) == commit` sin confiar en el server.
- ⚠️ **No real-time** — admin y visitantes NO ven la animación sincronizada en vivo. Si el cliente exige esto en el futuro, evaluar Ably/Pusher (3-5 días extra).
- ⚠️ **Server enforcement crítico:** `rngSeed` NUNCA debe ser regenerable después de `status='open'`. Server actions de edit raffle deben bloquear cambio de seed.

### Validated by

- BR-005, BR-006 (definición)
- US-016, US-018, US-024, US-025
- Unit test `seedToWinner` (determinismo) + `verifyDraw` (commit match)

---

## ADR-003 — Auth: URL-secret tokens (sin password en MVP)

**Status:** Accepted
**Date:** 2026-05-20
**Source:** Brief F24 (decisión consciente del usuario), Challenge Pass R2

### Context

El usuario declaró explícitamente "sin seguridad real en MVP, solo URLs te llevan a donde tienes que llegar". El stack incluye NextAuth v5 del starter kit, pero el usuario rechaza el flow de password/magic link en v1.

### Decision

**URL-secret tokens en path:**

- Admin: `/admin/{adminToken}` (un único token, configurado por env var inicialmente o generado en setup)
- Vendedor: `/v/{accessToken}` (token único por seller, nanoid(32) = 191 bits entropy)
- Visitante: `/r/{publicSlug}` (nanoid(10), no es secreto — público por diseño)

### Mitigations en MVP

| Risk                                 | Mitigation                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| Leak via referrer header             | `Referrer-Policy: no-referrer` en layout admin y vendedor                                  |
| Leak via search engines              | `robots.txt` + `<meta name="robots" content="noindex">` en rutas con token                 |
| Browser history exposure             | Tokens en **path** (no en query) — mejor para WhatsApp share pero igual visible en history |
| Token leak por screenshot compartido | Admin puede rotar tokens (BR-012, FT-002)                                                  |
| Browser sync cloud (Chrome → Google) | Aceptado — no mitigable sin auth real                                                      |

### Consequences

- ✅ **Simplicidad maximal:** no signup flow, no recovery, no password reset.
- ✅ **Friction cero para vendedores y visitantes** — abrir un link es todo lo necesario.
- ⚠️ **Risk R1 aceptado:** quien tenga el adminToken tiene control total. Single-org de confianza interna.
- ⚠️ **Upgrade path post-MVP:** integrar NextAuth con magic link (email) o password. NextAuth ya está en deps, solo se activa.

### NextAuth status

- Dependency **mantenida** en `package.json` (heredada del starter kit)
- NO se activa middleware ni provider en MVP
- Reactivación = task post-MVP (post-release v1.1+)

---

## Routing topology

| Path pattern                             | Layout                    | Auth gate                | Audience             |
| ---------------------------------------- | ------------------------- | ------------------------ | -------------------- |
| `/admin/{adminToken}`                    | Admin shell               | `assertAdmin` middleware | Admin (P-001)        |
| `/admin/{adminToken}/raffles/{raffleId}` | Admin detail              | `assertAdmin`            | Admin                |
| `/admin/{adminToken}/sellers`            | Admin sellers             | `assertAdmin`            | Admin                |
| `/v/{accessToken}`                       | Vendedor shell            | `assertSeller(token)`    | Vendedor (P-002)     |
| `/v/{accessToken}/ticket/{ticketId}`     | Ticket digital share view | `assertSeller(token)`    | Vendedor → Comprador |
| `/r/{publicSlug}`                        | Public landing            | Sin gate (público)       | Visitante (P-003)    |
| `/r/{publicSlug}/verify`                 | Verify draw modal/page    | Sin gate                 | Visitante            |
| `/api/og/{publicSlug}`                   | OpenGraph image generator | Sin gate                 | WhatsApp preview     |

### Middleware logic (simplificado)

```ts
// src/middleware.ts
export function middleware(req) {
  const url = req.nextUrl;

  // Token-bearing routes get strict referrer policy
  if (url.pathname.startsWith('/admin/') || url.pathname.startsWith('/v/')) {
    const res = NextResponse.next();
    res.headers.set('Referrer-Policy', 'no-referrer');
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return res;
  }

  // Public routes: cacheable
  return NextResponse.next();
}
```

---

## Render strategy per route

| Route                     | Strategy                            | Cache TTL                              | Refresh trigger                       |
| ------------------------- | ----------------------------------- | -------------------------------------- | ------------------------------------- |
| `/r/{publicSlug}` (open)  | RSC + `revalidatePath`              | sin TTL (siempre fresca tras mutación) | Server action invoca `revalidatePath` |
| `/r/{publicSlug}` (drawn) | RSC + ISR aggressive                | inmutable (1 año)                      | Solo si `archived_at` cambia          |
| `/admin/*`                | RSC con `dynamic = 'force-dynamic'` | sin cache                              | Cada navegación                       |
| `/v/{token}`              | RSC dynamic                         | sin cache                              | Cada navegación                       |
| `/api/og/*`               | ISR                                 | 1 hora                                 | Mutación de premio (revalidate)       |

---

## Performance budget

| Metric                               | Target           | Validated by         |
| ------------------------------------ | ---------------- | -------------------- |
| LCP `/r/{publicSlug}`                | ≤ 2.5s mobile 4G | Lighthouse CI        |
| TTI vendedor `/v/{token}`            | ≤ 3s mobile 4G   | Lighthouse CI        |
| Bundle size first load               | ≤ 200KB gzip     | `next build` analyze |
| Server action latency (claim ticket) | p95 ≤ 200ms      | Sentry transactions  |

---

## Security posture (MVP)

| Concern                | Stance                                                                      |
| ---------------------- | --------------------------------------------------------------------------- |
| Auth                   | URL-secret (ADR-003) — aceptado risk R1                                     |
| Token leak             | Mitigated via referrer policy + rotation (BR-012)                           |
| SQL injection          | Drizzle parameterized queries (zero raw SQL)                                |
| XSS                    | React escaping + `dangerouslySetInnerHTML` PROHIBIDO                        |
| CSRF                   | Server actions de Next.js incluyen CSRF tokens automáticos                  |
| Image upload (prize)   | Validate MIME + size (5MB max) + sanitize filename antes de Blob put        |
| Sensitive data en logs | NUNCA loguear `accessToken`, `rngSeed` (pre-sorteo), `phone`, `email`       |
| Rate limiting          | Vercel Edge default; sin RL custom en MVP (acceptable risk para single-org) |

---

## Observability

| Concern        | Tool                                   | Setup                                                  |
| -------------- | -------------------------------------- | ------------------------------------------------------ |
| Error tracking | Sentry (incluido en starter kit)       | Configurado en `sentry.{client,edge,server}.config.ts` |
| Runtime logs   | Vercel built-in                        | `console.log` server-side queda en Vercel logs         |
| Performance    | Vercel Analytics + Sentry transactions | Opt-in                                                 |
| User analytics | NO en MVP (sin PII tracking)           | n/a                                                    |

---

## Deployment topology

```
GitHub (main branch)
       │
       │ push → trigger
       ▼
   Vercel Deploy
       │
       ├─ Build (Next.js)
       ├─ Run migrations (manual via CLI, per SK.md §1.1)
       └─ Deploy to:
           ├─ main  → Production (rifatela.com or similar)
           └─ feature/* → Preview URLs (per commit)
```

**Branching:** pre-release (`v0.0.0`), main-first per `GIT.md §4`. Migrar a develop-first con `/deploy` cuando se haga v1.0.0.

---

## Cross-cutting concerns

### Internationalization (i18n)

- MVP: español neutro hardcoded (no i18n framework)
- Post-MVP: si se requiere portugués/inglés, integrar `next-intl`

### Accessibility (a11y)

- Mobile-first 375px (FT-014) implica tap targets ≥44px
- Lighthouse a11y score ≥ 90 target (en CI)
- Animación rueda: respect `prefers-reduced-motion` → fallback a "reveal con flip" simple

### Error boundaries

- `error.tsx` por segmento de App Router
- Sentry captura unhandled
- User-facing: mensajes genéricos sin filtrar info (sobre todo en routes con token)

---

_07 Architecture — Rifatela — C4 niveles 1-3 + 3 ADRs + topology completa_
