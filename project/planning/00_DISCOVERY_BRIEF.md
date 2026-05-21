# 00 — Discovery Brief

> **Proyecto:** Rifatela
> **Modo Discovery:** D0 (from scratch, sin source package)
> **Fecha:** 2026-05-20
> **Estado:** **v1.0 Final** (post-Challenge-Pass, ready para `/proposal`)
> **Autor:** @discovery-expert
> **SSOT chain:** Discovery → Proposal → Docs → Design → Backlog → Code

---

## Resumen ejecutivo

**Rifatela** es una aplicación web (PWA) **single-tenant** para gestionar rifas con boletos numerados. Un admin único crea rifas, da de alta vendedores, y los vendedores registran compradores asignándoles un número del set cerrado. Vista pública compartible con countdown, premio, grilla de números, y sorteo manual con animación de **rueda de la fortuna**. Sin pagos online, sin notificaciones automáticas, sin contraseñas — acceso por URLs secretas.

**Pillares del MVP:** zero doble-venta · sorteo verificable (commit-reveal) · vista pública compartible · operación 100% mobile.

---

## Confidence tags

| Tag             | Significado                                |
| --------------- | ------------------------------------------ |
| `Confirmed`     | Stated explícitamente por el usuario       |
| `[INFERRED]`    | Deducción razonable                        |
| `[RECOMMENDED]` | Recomendación del expert, no decisión      |
| `[OQ]`          | Open Question — requiere input del usuario |

---

## 1. General Idea

### Pitch (`Confirmed`)

Aplicación web (PWA) para gestionar rifas con boletos numerados. Un admin único crea rifas, da de alta vendedores, y los vendedores registran compradores asignándoles un número de los disponibles. Cada rifa tiene un countdown a la fecha de sorteo, una vista pública compartible, y el sorteo se ejecuta con una animación de **rueda de la fortuna**.

### Problem `[INFERRED]`

Las rifas informales (clubes, colegios, asociaciones, individuos) se gestionan en papel o planillas: control manual de números vendidos, vendedores anotando en cuadernos, falta de centralización, riesgo de doble venta del mismo número, falta de visibilidad pública del estado del sorteo.

### Solution (`Confirmed`)

- Panel admin para configurar rifas y dar de alta vendedores
- Pantalla simple para que cada vendedor registre compradores y asigne números (mobile)
- Vista pública compartible (link/QR) con countdown, premio, números disponibles, ganador post-sorteo
- Sorteo ejecutado por el admin con animación visible y **verificable** (commit-reveal del seed)

### North Star

**Zero doble-venta + sorteo verificable.** Cada número se vende una sola vez (concurrency atómica) y el resultado del sorteo es auditable post-hoc por cualquier visitante (commit-reveal scheme).

### Scope explícito (`Confirmed`)

- **NO** es plataforma SaaS multi-cliente — single-tenant / single-admin
- **NO** maneja pagos online — solo trackea quién vendió qué
- **NO** envía notificaciones automáticas — todo contacto sucede fuera de la app

---

## 2. Users and Roles

| Rol                     | Auth                                                    | Capacidades                                                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Admin**               | URL secreta (token unguessable), sin password           | Crear/editar/archivar rifas. Dar de alta vendedores. **Revertir ventas** (sad path). **Rotar URL** de vendedores. Ejecutar el sorteo. Ver todo.                                                              |
| **Vendedor**            | URL secreta única por vendedor, sin password ("soy yo") | Ver lista de números disponibles. Registrar compradores. Asignar número. Compartir comprobante (ticket digital).                                                                                             |
| **Visitante** (público) | URL pública por rifa, anónima                           | Ver nombre/premio/imagen, countdown, grilla con números disponibles vs vendidos (**iniciales del comprador en vendidos**), verificar `seed_commit` pre-sorteo, ver ganador + replay de animación post-sorteo |

### Auth model — decisión consciente (`Confirmed` — F24)

Sin contraseñas, sin login real. El acceso a cada rol se controla por URLs con tokens unguessables (security-by-obscurity). Para MVP single-org de confianza interna.

**Mitigations en MVP:**

- Tokens en **path** (`/v/{token}`), no en query string
- `Referrer-Policy: no-referrer` en layouts admin/vendedor
- Robots noindex en todas las rutas con token
- **Admin puede rotar URL de vendedor** (F-016) → invalida token leak

**Upgrade path post-MVP:** magic link / password / OAuth.

---

## 3. Core Features

### MVP (in scope)

| ID    | Feature                                                                                                                                                                                 | Notas                    |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| F-001 | **Admin crea rifa:** nombre, premio (texto + imagen), max_tickets, fecha sorteo. Se persiste `seed_commit` (hash de un seed pre-generado)                                               | F1, F2, F5, F10, F26, B5 |
| F-002 | **Admin gestiona vendedores:** alta, archivar, ver URL única (botón copiar), **rotar URL** (regenera token)                                                                             | F3, F14, B8              |
| F-003 | **Vendedor login = selector "soy yo"** (acceso directo por URL única `/v/{token}`)                                                                                                      | F14, F15                 |
| F-004 | **Vendedor registra comprador:** nombre, teléfono, email (todos opcionales)                                                                                                             | F4, F18                  |
| F-005 | **Vendedor asigna número:** ve grilla de números, elige uno disponible para el comprador                                                                                                | F11, F15                 |
| F-006 | **Concurrency atómica:** asignación con `UPDATE…WHERE status='available' RETURNING` single-statement. Si rowCount=0 → 409 → UX _"Ese número ya se vendió, elegí otro"_ + refresh grilla | BR-001, BR-002, B1       |
| F-007 | **Vista pública por rifa:** countdown, premio, grilla de números, iniciales del comprador en vendidos (ej: "47 — J.P."), link compartible                                               | F6, F17, F26, B4         |
| F-008 | **Sorteo manual con animación:** admin presiona "Sortear" en/después de la fecha → rueda de la fortuna gira → revela ganador. Se persiste `rng_seed`, `winner_ticket_id`, `drawn_at`    | F7, F13, F27             |
| F-009 | **Resultado post-sorteo + replay determinista:** vista pública muestra ganador + replay de animación reproducible desde `rng_seed`                                                      | F17, B2 (replay-only)    |
| F-010 | **Ticket digital compartible:** post-venta, el vendedor obtiene un link/imagen con el número asignado para compartir al comprador por WhatsApp                                          | B4 (proof-of-purchase)   |
| F-011 | **Admin revierte venta:** sad path — admin puede liberar un ticket vendido (status `sold` → `available`, limpia `buyer_id`/`seller_id`, log en `admin_actions`)                         | B3                       |
| F-012 | **Admin dashboard con métricas:** lista de rifas activas/archivadas con % vendido, días restantes, total vendedores, total ventas                                                       | PO #5                    |
| F-013 | **Verificación pública del sorteo (commit-reveal):** vista pública muestra `seed_commit` desde apertura; al sortear se publica `rng_seed` → cualquiera valida `sha256(seed) == commit`  | R2, B5                   |
| F-014 | **Mobile-first 375px baseline** (vendedor + público)                                                                                                                                    | F21, SK.md §3.2          |

### Stretch / Post-MVP-v1.0 (out of scope inicial, but next)

| ID    | Feature                                                                          | Razón                          |
| ----- | -------------------------------------------------------------------------------- | ------------------------------ |
| F-S01 | **PWA instalable** (manifest + service worker + vista pública cacheable offline) | F23 + B6 → **SHOULD, no MUST** |
| F-S02 | Sonido en sorteo con toggle mute                                                 | OQ-V1                          |

### Out of scope (post-MVP futuro, no se promete en v1)

- Múltiples premios por rifa (1ro/2do/3ro) — **modelo data ya lo soporta vía tabla `Prize`**, solo falta UI
- Pagos online (Mercado Pago / Stripe)
- Multi-tenant / SaaS
- Auth real (password / magic link / OAuth)
- Notificaciones automáticas (email / WhatsApp / SMS)
- Sorteo vinculado a lotería externa
- Histórico público de rifas pasadas (más allá de la última archivada)
- Offline-write para vendedores (rechazado — garantiza doble-venta)

---

## 4. Data Model

### Entidades

```
Raffle
  id              uuid pk
  name            text
  max_tickets     int
  draw_date       timestamptz
  status          enum('draft', 'open', 'drawn')
  winner_ticket_id uuid?
  rng_seed        text?         (revelado al sortear)
  seed_commit     text          (sha256(rng_seed), publicado desde 'open')
  drawn_at        timestamptz?
  public_slug     text unique   (nanoid 10 chars — URL pública compartible)
  archived_at     timestamptz?  (soft-delete para limpiar dashboard)
  created_at      timestamptz

Prize  ← creada desde MVP (B7-(b)). MVP usa 1 fila/raffle; multi-premio se activa cambiando UI.
  id              uuid pk
  raffle_id       uuid fk → Raffle
  position        int           (1=principal, 2=segundo, …)
  text            text
  image_url       text?         (Vercel Blob)
  unique(raffle_id, position)

Seller
  id              uuid pk
  name            text
  access_token    text unique   (nanoid 32 — URL secreta)
  archived_at     timestamptz?  (soft-delete; preserva ventas históricas)
  created_at      timestamptz

Buyer
  id              uuid pk
  name            text?         (todos opcionales — F18)
  phone           text?
  email           text?
  created_at      timestamptz
  -- Nota: se identifica por id, no por contacto. Iniciales en vista pública
  --       calculadas desde `name` (si existe), fallback "Anónimo".

Ticket
  id              uuid pk
  raffle_id       uuid fk → Raffle
  number          int           (1..max_tickets del raffle)
  status          enum('available', 'sold')
  buyer_id        uuid? fk → Buyer
  seller_id       uuid? fk → Seller
  sold_at         timestamptz?
  unique(raffle_id, number)

AdminAction        ← log liviano para auditabilidad de reversiones (F-011)
  id              uuid pk
  action_type     enum('revert_sale', 'rotate_seller_token', 'archive_raffle', …)
  raffle_id       uuid? fk
  ticket_id       uuid? fk
  seller_id       uuid? fk
  details         jsonb
  created_at      timestamptz
```

### Decisiones de modelo (post-Challenge-Pass)

| Decisión                       | Resolución                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------- |
| Tabla `Prize` desde MVP (B7-b) | ✅ Creada. MVP usa 1 prize por raffle. Permite multi-premio sin migración futura. |
| `archived_at` en Raffle (R4)   | ✅ Soft-delete. Admin dashboard filtra por defecto.                               |
| `seed_commit` en Raffle (B5)   | ✅ Publicado desde `status='open'`. Permite commit-reveal verification.           |
| `public_slug` generation (R5)  | ✅ `nanoid(10)` — alfanumérico, ~58 bits de entropía, evita colisiones humanas.   |
| `AdminAction` log (B3)         | ✅ Tabla simple para trazar reversiones de venta y rotaciones de token.           |

### Sensitive data

- **Contacto del comprador:** opcionales (F18). Si se capturan, son PII. Storage estándar Postgres + Neon defaults. **Retention policy:** se mantiene mientras la rifa no esté archivada >90 días (post-MVP definir purge job).
- **Tokens (`access_token`, `public_slug`):** secretos. Nunca aparecen en logs server. Service worker NO debe cachear rutas con token.

---

## 5. Integrations

**MVP: ninguna integración externa.** (`Confirmed` — sin pagos, sin notificaciones, sin lotería).

### Servicios de infra (stack, no integrations)

- **Neon Postgres** — DB serverless (heredado del starter kit)
- **Vercel Blob** — storage de imagen del premio
- **Sentry** — error monitoring (ya configurado en el kit)

---

## 6. Business Rules

| ID     | Rule                                                                                                                                                                                                                                                       | Source                  |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| BR-001 | Un `Ticket(raffle_id, number)` solo puede tener `status='sold'` una vez (unique + status check)                                                                                                                                                            | F10, F11                |
| BR-002 | Asignación de ticket = **single-statement atomic**: `UPDATE tickets SET status='sold', buyer_id=?, seller_id=?, sold_at=NOW() WHERE id=? AND status='available' RETURNING *`. Si `rowCount=0` → respond 409 → UX pide elegir otro número y refresca grilla | B1, F-006               |
| BR-003 | Si `tickets_sold == max_tickets` antes de `draw_date` → la rifa **NO se cierra**, espera al countdown                                                                                                                                                      | F20                     |
| BR-004 | Llegado `draw_date`, sorteo se hace **entre tickets vendidos** (no entre todo el set 1..max)                                                                                                                                                               | F19                     |
| BR-005 | Sorteo: una sola ejecución por rifa. Se persiste `rng_seed`, `drawn_at`, `winner_ticket_id`. `status` pasa a `drawn`.                                                                                                                                      | F13, F-008              |
| BR-006 | **Commit-reveal verificability:** `seed_commit = sha256(rng_seed)` se publica en vista pública desde que `status='open'`. Al sortear, `rng_seed` queda público → cualquiera valida `sha256(seed) == commit`.                                               | B5, F-013               |
| BR-007 | Si la rifa vendió **0 tickets** al `draw_date` → no se sortea. Admin puede cancelar/archivar manualmente; la rifa permanece `open` indefinidamente.                                                                                                        | edge case, OQ-M2 closed |
| BR-008 | Datos del comprador todos opcionales — vendedor puede registrar un buyer "anónimo" (todos los campos null)                                                                                                                                                 | F18                     |
| BR-009 | Vista pública muestra **iniciales** del nombre del comprador junto al número vendido (ej: "Juan Pérez" → "J.P."). Si `name=null` → "Anónimo". Teléfono/email **nunca** se exponen públicamente.                                                            | B4, PO #4               |
| BR-010 | Una vez `status='drawn'`, la rifa es **inmutable**: no re-sorteo, no edición de tickets, no edición del premio.                                                                                                                                            | implícito F7, BR-008    |
| BR-011 | **Solo admin** puede revertir una venta (`status='sold'` → `'available'`, clear buyer/seller). Se registra en `AdminAction`. Vendedor NO tiene undo.                                                                                                       | B3                      |
| BR-012 | Admin puede **rotar el access_token** de un vendedor; el token anterior queda invalidado inmediatamente. Se registra en `AdminAction`.                                                                                                                     | B8, F-002               |
| BR-013 | Vendedor archivado (`archived_at != null`) → su token deja de funcionar, ventas históricas se preservan asociadas a su `seller_id`.                                                                                                                        | OQ-M3 closed            |
| BR-014 | Admin no puede **borrar** una rifa con tickets vendidos. Solo archivar (`archived_at`).                                                                                                                                                                    | data integrity          |
| BR-015 | Rifa archivada → no aparece en admin dashboard por defecto. URL pública sigue accesible (link compartido en WhatsApp no se rompe).                                                                                                                         | R4                      |

---

## 7. UI/UX

### Pantallas MVP

| Pantalla                          | Audiencia | Notas                                                                                                                                                                                    |
| --------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin Dashboard**               | Admin     | Lista rifas activas (default) + toggle archivadas. Métricas por rifa: % vendido, días restantes, total vendedores, total ventas. (F-012)                                                 |
| **Admin: Crear/Editar Rifa**      | Admin     | Form: nombre, premio (texto + upload imagen → Vercel Blob), max_tickets, draw_date. Pre-genera `rng_seed` + persiste `seed_commit`.                                                      |
| **Admin: Gestionar Vendedores**   | Admin     | Lista + alta + copiar URL única + **rotar URL** + archivar.                                                                                                                              |
| **Admin: Detalle de Rifa**        | Admin     | Vista interna: tabla de tickets vendidos (filtrable por vendedor/comprador), botón "revertir venta" por ticket (con confirmación + razón).                                               |
| **Admin: Panel de Sorteo**        | Admin     | Visible una vez llegada `draw_date`. Botón "Ejecutar Sorteo" → dispara animación + persiste ganador. Solo una vez.                                                                       |
| **Vendedor: Panel de Venta**      | Vendedor  | URL `/v/{token}` → directo. Form de comprador (3 campos opcionales) + grilla visual de números disponibles/vendidos. Tras vender: pantalla "Ticket digital" compartible (link + imagen). |
| **Pública: Landing de Rifa**      | Visitante | Hero con countdown grande + premio (texto + imagen) + grilla con iniciales en vendidos + footer con `seed_commit` visible para verify.                                                   |
| **Pública: Resultado del Sorteo** | Visitante | Misma URL post-sorteo: ganador (nombre completo + N°) + replay animación rueda + `rng_seed` revelado + comprobante visual del hash match.                                                |

### Principios UX

- **Mobile-first 375px baseline** (SK.md §3.2)
- **Vendedor en celular es el caso principal** — la pantalla del vendedor debe operarse con un pulgar
- **Vista pública compartible por WhatsApp** — primer fold con premio + countdown grandes pega visualmente
- **Cero fricción para el comprador** — no crea cuenta, no entra a la app

### Flujos clave

**Flujo 1 — Admin arma rifa:**
`Dashboard → "+ Nueva Rifa" → Form → Agregar vendedores → Copiar URLs → Compartir con vendedores por WhatsApp`

**Flujo 2 — Vendedor vende:**
`Recibe URL → Abre en cel → Cliente le dice "quiero el 47" → Llena nombre/tel del cliente → Toca el 47 → Confirma → Sistema asigna atómicamente → Pantalla "Ticket digital" → Comparte por WhatsApp → Vuelve a grilla con 47 marcado`

**Flujo 2b — Sad path concurrency:**
`Vendedor A y B tocan el 47 al mismo tiempo → A gana (rowCount=1) → B recibe 409 → Toast "Ese número ya se vendió, elegí otro" → grilla refresca → B elige otro número`

**Flujo 3 — Admin revierte venta:**
`Admin detecta error (cliente cambia de número, vendedor se equivocó) → Detalle de Rifa → Tabla tickets → Click "revertir" en ticket → Confirma con razón opcional → Ticket vuelve a 'available' → Log en AdminAction`

**Flujo 4 — Sorteo:**
`Admin abre panel sorteo (post-draw_date) → Comparte vista pública por WhatsApp → Presiona "Sortear" → Rueda gira con animación → Revela ganador → rng_seed se publica → visitante puede validar sha256(seed) == commit (link "verificar este sorteo")`

---

## 8. Infrastructure

### Stack (heredado del TimeKast Starter Kit)

- **Framework:** Next.js 16+ (App Router, Turbopack)
- **Lenguaje:** TypeScript strict
- **DB:** Neon Postgres (serverless)
- **ORM:** Drizzle
- **Auth:** NextAuth.js v5 — **deferred** en MVP (F24). Se mantiene la dep para upgrade futuro.
- **UI:** Tailwind CSS v4 + Lucide React
- **Testing:** Vitest + Playwright
- **Hosting:** Vercel
- **Storage:** Vercel Blob (imagen del premio)
- **Monitoring:** Sentry

### Deployment

- **Pre-release (v0.0.0):** push directo a `main` permitido (GIT.md §4)
- **Post-release:** develop-first, deploys via `/deploy`
- **Vercel:** `main` = production, `develop` = preview

### Jobs / cron / background

**Ninguno en MVP.** El sorteo es manual (admin presiona botón). No hay cierre automático al pasar la fecha. Countdown del cliente refresca con `setInterval` cliente-side (sin polling al server).

### Concurrency strategy

- Asignación de ticket: single-statement atomic UPDATE conditional (BR-002). Drizzle:
  ```ts
  const claimed = await db
    .update(tickets)
    .set({ status: 'sold', buyerId, sellerId, soldAt: new Date() })
    .where(and(eq(tickets.id, ticketId), eq(tickets.status, 'available')))
    .returning();
  if (claimed.length === 0) throw new ConflictError('ticket_already_sold');
  ```
- Buyer se crea **antes** del claim (idempotente).
- Neon HTTP driver soporta single-statement UPDATE → ok sin WebSocket driver.

### Timeline `[OQ-T1 → diferido]`

Diferido a `/estimate` post-discovery. Estimación gruesa preliminar: **3 semanas** para MVP completo (sin PWA stretch).

---

## 9. Branding

- **Nombre:** **Rifatela** (`Confirmed`)
- **Voice:** festivo, abierto, casual, sin formalidad corporativa
- **Audiencia:** organizadores informales de rifas (clubes, escuelas, asociaciones, individuos)
- **Tagline:** `[deferred a /proposal]` — sugerencias preliminares: _"Tu rifa, sin lápiz ni cuaderno"_ / _"La rifa que se ve en vivo"_
- **Logo:** `[deferred a /design]` — sugerencia: ticket numerado o rueda estilizada con "R" como spinner

---

## 10. Mobile / PWA

- **Mobile posture:** mobile-first 375px baseline (SK.md §3.2)
- **PWA instalable:** **SHOULD, no MUST** (F-S01 stretch). MVP v1.0 entrega web responsive completa; install + service worker viene en v1.1.
- **Offline support:**
  - **Vista pública:** cacheable (último snapshot disponible offline) — incluido en F-S01.
  - **Vendedor:** requiere conexión activa (evita doble-venta). NO offline-write.
- **Native capabilities:** ninguna (sin cámara, sin GPS, sin push notifications en MVP)

---

## 11. Visual Direction

- **Vibe / mood:** **Carnaval / feria / festivo** (`Confirmed` — F27)
- **Premium level:** **medio** — festivo y divertido, profesional pero no minimalista premium ni excesivamente kitsch
- **Color palette `[RECOMMENDED]`:**
  - Primario: rojo intenso (tipo carpa de circo) o magenta
  - Acento 1: amarillo dorado (luces de feria)
  - Acento 2: azul cobalto o turquesa (contraste)
  - Neutral: crema/off-white de fondo
- **Tipografía `[RECOMMENDED]`:**
  - Display (titulares, número ganador): retro-feria — opciones: **Bungee**, **Alfa Slab One**, **Lobster**, **Fredoka One**
  - Body: sans-serif legible (Inter / Geist Sans del starter kit)
- **Iconografía:** ticket, rueda, confetti, número grande, estrella
- **Animación del sorteo (`Confirmed`):** rueda de la fortuna con segmentos = boletos vendidos. Gira con motion blur, desacelera, aterriza en el ganador, confetti al revelar. Reproducible desde `rng_seed` para replay determinista (B2).
- **Countdown:** números grandes pulsantes o flip-cards estilo aeropuerto retro
- **Sonido `[OQ-V1 closed]`:** sí, con toggle mute → movido a **F-S02 stretch**

---

## 📎 Appendix A — Reconciliation Checklist

| Check                                                                               | Status |
| ----------------------------------------------------------------------------------- | ------ |
| F14 (sin password vendedor) ↔ §2 ↔ F-003 URL `/v/{token}`                           | ✅     |
| F24 (sin auth admin) ↔ §2 ↔ §8 (NextAuth deferred) ↔ mitigations §2                 | ✅     |
| F10 (max_tickets) ↔ §4 `Ticket.unique(raffle_id, number)` ↔ BR-001                  | ✅     |
| F11 (comprador elige) ↔ §7 Flujo 2 ↔ BR-002 atomic UPDATE                           | ✅     |
| F19 (sorteo entre vendidos) ↔ BR-004                                                | ✅     |
| F20 (espera countdown) ↔ BR-003                                                     | ✅     |
| F12 (sin pagos) ↔ §5 ↔ §3 out-of-scope                                              | ✅     |
| F16 (multi-premio futuro) ↔ §4 tabla `Prize` ya creada                              | ✅     |
| F18 (campos opcionales) ↔ §4 `Buyer` ↔ BR-008 ↔ BR-009 fallback "Anónimo"           | ✅     |
| F23 (PWA) ↔ §10 ↔ §3 F-S01 (movido a stretch B6)                                    | ✅     |
| F26 (premio img+text) ↔ §4 `Prize.text`/`Prize.image_url` ↔ §5 Vercel Blob          | ✅     |
| F27 (rueda) ↔ §11 ↔ §3 F-008 ↔ §3 F-009 replay determinista                         | ✅     |
| F25 (sin notif) ↔ §5 ↔ §3 out-of-scope                                              | ✅     |
| F21 (multi-device) ↔ §10                                                            | ✅     |
| Concurrency (B1) ↔ BR-002 ↔ §8 strategy ↔ §7 Flujo 2b sad path                      | ✅     |
| Replay-only (B2) ↔ F-009 ↔ §11                                                      | ✅     |
| Admin reverts (B3) ↔ F-011 ↔ BR-011 ↔ §4 `AdminAction` ↔ §7 Flujo 3                 | ✅     |
| Proof-of-purchase (B4) ↔ F-010 ticket digital ↔ BR-009 iniciales ↔ §7 Flujo 2       | ✅     |
| Commit-reveal (B5) ↔ F-013 ↔ BR-006 ↔ §4 `seed_commit` ↔ §7 "verificar este sorteo" | ✅     |
| PWA stretch (B6) ↔ §10 SHOULD ↔ §3 F-S01                                            | ✅     |
| Prize table desde MVP (B7-b) ↔ §4                                                   | ✅     |
| Token rotation (B8) ↔ F-002 ↔ BR-012 ↔ §4 `AdminAction`                             | ✅     |

**Contradicciones detectadas:** 0
**OQs sin resolver al cierre:** 0 (todas las OQ originales fueron resueltas o deferidas formalmente)

---

## 📊 Quality Metrics

| Métrica                           | Valor                                           | Target  | OK  |
| --------------------------------- | ----------------------------------------------- | ------- | --- |
| Source Fidelity                   | 100%                                            | 100%    | ✅  |
| Drift introducido                 | 0                                               | 0       | ✅  |
| Open Questions abiertas           | 0                                               | minimal | ✅  |
| High-risk assumptions             | 3 (R1, R2, R3) — todas explícitamente aceptadas | flagged | ✅  |
| Section completeness              | 11/11                                           | ≥ 80%   | ✅  |
| Challenge Pass findings resueltos | 8/8 blockers + 8/8 defaults                     | 100%    | ✅  |

---

## 🔄 Resolution States (cierre)

| Estado                             | Items                                                                                                            |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Firm (from interview)**          | F1-F27 (27 decisiones del usuario)                                                                               |
| **Resolved during Challenge Pass** | B1, B2, B3, B4, B5, B6, B7, B8 + todos los defaults OQ-M2/M3/M4/V1, archived_at, public_slug                     |
| **Working hypothesis**             | Stack starter kit, Vercel Blob, tipografías recomendadas, paleta carnaval                                        |
| **Deferred (downstream)**          | Animación específica de la rueda → `/design` · tagline → `/proposal` · logo → `/design` · timeline → `/estimate` |
| **Open Questions**                 | **0** — discovery cerrada                                                                                        |

---

## 🚦 Risks aceptados (declared, no blocked)

| ID  | Risk                                                         | Aceptación                                                              |
| --- | ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| R1  | Sin auth real — quien tenga la URL admin tiene control total | Aceptado para MVP single-org. Upgrade path: magic link en v2.           |
| R2  | URL leak (history, referrer, screenshots de WhatsApp)        | Mitigado en MVP por token rotation (F-002) + noindex + Referrer-Policy. |
| R3  | "Vendido" sin pago confirmado → posibles fantasmas           | Aceptado: app es tracking, confianza es offline (single-org).           |

---

## ➡️ Next steps (pipeline)

1. **`/estimate`** — estimación interna AI-First en dev-points (no expuesta al cliente). Cierra OQ-T1.
2. **`/proposal`** — propuesta visual para el cliente (Gamma). Cierra tagline.
3. **`/docs`** — generación de docs técnicos (personas, US, BR, data model).
4. **`/design`** — design specs (pantallas, paleta, tipografía, logo, animación de la rueda).
5. **`/backlog`** — issues ejecutables desde docs+design.
6. **`/implement`** — código.

---

_Discovery Brief — Rifatela — v1.0 Final_
_27 decisiones firmes · 8 blockers post-Challenge resueltos · 0 OQs abiertas · Ready para `/estimate` + `/proposal`_
