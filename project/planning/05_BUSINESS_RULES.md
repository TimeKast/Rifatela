# 05 — Business Rules

> **Proyecto:** Rifatela
> **Source:** [`00_DISCOVERY_BRIEF.md`](./00_DISCOVERY_BRIEF.md) §6
> **Estado:** v1.0
> **ID namespace:** `BR-XXX` (preservado verbatim del brief — cero drift)

---

## Resumen

| Categoría                      | Count  | IDs                            |
| ------------------------------ | ------ | ------------------------------ |
| **Integrity invariants**       | 3      | BR-001, BR-002, BR-010         |
| **Lifecycle / state machines** | 4      | BR-003, BR-005, BR-014, BR-015 |
| **Draw logic**                 | 3      | BR-004, BR-006, BR-007         |
| **Privacy / public exposure**  | 2      | BR-008, BR-009                 |
| **Admin operations**           | 3      | BR-011, BR-012, BR-013         |
| **Seller scoping**             | 1      | BR-016                         |
| **Total**                      | **16** | BR-001 → BR-016                |

> **IDs son shared** con `00_DISCOVERY_BRIEF.md` §6. Si una BR se modifica acá, el brief debe actualizarse (cross-check obligatorio en doc 14).

---

## Integrity invariants

### BR-001 — Uniqueness de tickets

**Rule:** Un `Ticket(raffle_id, number)` solo puede tener `status='sold'` una vez en su lifetime.

- **Trigger:** intento de vender un ticket
- **Mechanism:** combinación de constraint DB (`unique(raffle_id, number)`) + BR-002 atomic UPDATE
- **Exception:** ninguna. Ni siquiera el admin puede crear duplicados (FT-011 revierte, no duplica)
- **Source:** Brief F10, F11
- **Validated by:** US-012 (concurrency test), US-005 (atomic UPDATE)
- **Enforced at:** DB (unique constraint) + server (atomic update WHERE clause)

---

### BR-002 — Asignación atómica (zero double-sale)

**Rule:** La asignación de un ticket a un buyer se hace en **single-statement atomic SQL** con conditional UPDATE.

**Pattern obligatorio:**

```sql
UPDATE tickets
   SET status='sold', buyer_id=?, seller_id=?, sold_at=NOW()
 WHERE id=? AND status='available'
 RETURNING *
```

- **Trigger:** vendedor toca un número en la grilla
- **Behavior cuando `rowCount=0`:**
  - Server retorna HTTP 409 con `code='ticket_already_sold'`
  - UX muestra toast: _"Ese número ya se vendió, elegí otro"_
  - Grilla del cliente refresca automáticamente
- **Behavior cuando `rowCount=1`:**
  - Ticket queda vendido; retorna ticket actualizado
  - Vendedor avanza a "Ticket digital" (FT-010)
- **Exception:** ninguna. Aplica a TODA mutación de `status='available' → 'sold'`.
- **NO usar:** `SELECT ... FOR UPDATE` + `UPDATE` separados (no atómico en Neon HTTP driver sin transaction)
- **Source:** Brief B1, F-006
- **Validated by:** US-012 (E2E concurrency con `Promise.all`)
- **Enforced at:** server action `claimTicket(...)` en Drizzle

---

### BR-007 — Rifa con 0 ventas al draw_date

**Rule:** Si la rifa vendió **0 tickets** al `draw_date` → el sorteo NO se ejecuta. La rifa permanece en `status='open'` indefinidamente; el admin puede archivarla manualmente.

- **Trigger:** `executeDraw` con `count(sold tickets) == 0`
- **Behavior:** server retorna error `code='no_tickets_sold'`; admin recibe sugerencia "cancelar o extender fecha"
- **Rationale:** mantener consistency con BR-005 (no se sortea entre 0 candidatos); evita estados absurdos como "ganador: ningún ticket".
- **Source:** Brief BR-007 (verbatim)
- **Validated by:** unit test `executeDraw` con `soldCount=0`

---

### BR-010 — Inmutabilidad post-sorteo

**Rule:** Una vez `Raffle.status='drawn'`, la rifa y sus tickets son inmutables: no re-sorteo, no edición del premio, no revertir ventas, no modificar tickets.

- **Trigger:** cualquier intento de mutación sobre rifa drawn o sus tickets
- **Behavior:** server action retorna error `code='raffle_immutable'`
- **Mutations bloqueadas:**
  - Edit raffle (US-003)
  - Revert sale (BR-011 / US-020)
  - Re-execute draw (BR-005 / US-017)
- **Mutations PERMITIDAS post-sorteo:**
  - `archived_at` toggle (archivar/desarchivar es metadata, no afecta integridad)
- **Source:** Brief BR-010 (verbatim)
- **Validated by:** US-003 (edit blocked), US-017 (re-draw blocked), US-020 (revert blocked)
- **Enforced at:** middleware en cada server action de mutación

---

## Lifecycle / state machines

### BR-003 — Espera al countdown

**Rule:** Si `tickets_sold == max_tickets` antes de `draw_date`, la rifa **NO se cierra automáticamente**. Permanece en `status='open'` hasta que `draw_date` se cumpla.

- **Trigger:** venta que completa el set
- **Behavior:**
  - Rifa sigue `status='open'`, pero NO se pueden vender más tickets (no hay disponibles)
  - Vista pública muestra banner "Boletos agotados — sorteo en {countdown}" (US-014)
  - Admin puede ejecutar sorteo recién cuando `draw_date <= now()` (BR-005)
- **Rationale:** transparencia. El countdown público es el contrato visible; cerrar antes rompería la promesa.
- **Source:** Brief F20
- **Validated by:** US-014

---

### BR-005 — Sorteo único e irreversible

**Rule:** El sorteo de una rifa se ejecuta **una sola vez**. Resultado inmutable (ver BR-010).

- **Trigger:** admin presiona "Ejecutar Sorteo"
- **Preconditions** (todas TRUE):
  - `raffle.status == 'open'`
  - `raffle.draw_date <= now()`
  - `count(tickets WHERE raffle_id=R AND status='sold') >= 1`
- **Behavior on success:**
  - Selecciona aleatoriamente un ticket vendido usando `rng_seed` (algoritmo determinista, ver `06_DATA_MODEL.md` función `seedToWinner`)
  - Persiste `winner_ticket_id`, `drawn_at`, `status='drawn'`
  - `rng_seed` queda público a partir de este momento (revelación)
- **Behavior on failure:**
  - Si `draw_date` no llegó → error `code='draw_date_not_reached'`
  - Si 0 tickets vendidos → error `code='no_tickets_sold'` (BR-007 — admin debe cancelar/archivar manual)
  - Si rifa ya en `drawn` → error `code='already_drawn'` (BR-010)
- **Source:** Brief F7, F13, BR-005 (verbatim)
- **Validated by:** US-016, US-017

---

### BR-014 — No borrar rifas con ventas

**Rule:** El admin NO puede borrar (delete) una rifa que tenga al menos 1 ticket vendido. Solo puede archivar (`archived_at`).

- **Trigger:** intento de delete via API
- **Behavior:**
  - Si `count(tickets WHERE raffle_id=R AND status='sold') > 0` → error `code='raffle_has_sales'`
  - Action correcta: archivar (soft-delete via `archived_at`)
- **Rationale:** preservar data para disputas y trazabilidad. Buyers tienen tickets digitales con el `public_slug` que debe seguir resolviendo (BR-015).
- **Source:** Brief BR-014 (verbatim), R4
- **Validated by:** US adicional implícita en `revert_sale` / `archive` paths

---

### BR-015 — Rifa archivada sigue siendo accesible públicamente

**Rule:** Una rifa con `archived_at != null` no aparece por defecto en el admin dashboard, pero su URL pública (`/r/{public_slug}`) sigue resolviendo con estado 200.

- **Trigger:** archivar rifa
- **Behavior:**
  - Admin dashboard filtra `archived_at IS NULL` por defecto (toggle "incluir archivadas")
  - URL pública: response normal — visitante con link viejo de WhatsApp ve la rifa (ganador si fue sorteada, o estado si no)
- **Rationale:** los links compartidos por WhatsApp no se rompen meses después. La "papelera" del admin es metadata interna.
- **Source:** Brief R4, BR-015
- **Validated by:** US-015

---

## Seller scoping

### BR-016 — Vendedores operan solo en rifas asignadas

**Rule:** Un vendedor solo puede ver y vender en rifas a las que el admin lo asignó explícitamente vía la tabla `raffle_sellers` (M:N). Tokens válidos no implican acceso global.

- **Trigger:** apertura del portal `/v/{token}` + cualquier invocación de `claimTicket`
- **Mechanism:**
  - `/v/{token}` lista `raffles WHERE status='open' AND deleted_at IS NULL AND id IN (SELECT raffle_id FROM raffle_sellers WHERE seller_id = ?)`
  - `claimTicket` re-verifica defense-in-depth: si `(raffleId, sellerId) ∉ raffle_sellers` → error `'No estás asignado a esta rifa.'`
  - Sellers archivados (deletedAt) conservan filas históricas pero no aparecen en UI de asignación ni pueden ser re-asignados.
  - ON DELETE CASCADE en ambas FKs: borrado físico de raffle o seller limpia el join. Soft-delete NO toca asignaciones (preserva forensics).
- **Idempotencia:** `assignSellerToRaffle` usa `INSERT … ON CONFLICT DO NOTHING`. `unassignSellerFromRaffle` es un DELETE no-op si la fila no existe.
- **Backfill al introducir la regla (2026-05-22):** se asignaron todos los sellers activos a todas las rifas abiertas existentes para preservar el comportamiento previo. A partir de ahí, cada raffle nueva requiere asignación explícita desde `/admin/{token}/raffles/{id}`.
- **Rationale:** el dueño de la rifa controla quién vende qué. Sin esto, cualquier seller con token válido podría vender en cualquier rifa abierta — el admin pierde el control de equipos por rifa.
- **Source:** decisión de producto 2026-05-22 (post-MVP refinement)
- **Validated by:** sin US específica todavía (test E2E pendiente)

---

## Draw logic

### BR-004 — Sorteo entre tickets vendidos

**Rule:** El sorteo selecciona ganador **entre los tickets vendidos**, NO entre todos los del set 1..max.

- **Trigger:** ejecución del sorteo (BR-005)
- **Mechanism:**
  - Set candidato: `tickets WHERE raffle_id=R AND status='sold' ORDER BY number ASC`
  - Selección determinista: `winnerIndex = mulberry32(seed)(0, soldTickets.length)`
  - `winner_ticket_id = soldTickets[winnerIndex].id`
- **Edge case:** si vendieron 1 solo ticket, ese gana (no se sortea sobre todo el set).
- **Rationale:** preserva fairness — solo pueden ganar quienes participaron.
- **Source:** Brief F19, BR-004 (verbatim)
- **Validated by:** US-016, función `seedToWinner` unit test

---

### BR-006 — Commit-Reveal verificability

**Rule:** El `seed_commit = sha256(rng_seed)` se publica en vista pública **desde `status='open'`** y nunca antes. Al ejecutar el sorteo, `rng_seed` se revela públicamente.

- **Trigger:** creación de rifa + ejecución de sorteo
- **Mechanism:**
  1. Al crear rifa: server genera `rng_seed` (256-bit `crypto.randomBytes`) y calcula `seed_commit = sha256(rng_seed)`. Persiste `seed_commit`; **no expone `rng_seed`** vía API.
  2. Desde `status='open'`: vista pública lee `seed_commit` y lo muestra.
  3. Al ejecutar sorteo: server expone `rng_seed` en la response y en futuras lecturas de la rifa drawn.
  4. Cliente puede recalcular `sha256(rng_seed)` y comparar con `seed_commit` → ✅/❌.
- **Crypto:** SHA-256, Web Crypto API en cliente para verificación.
- **Security implication:** el server NUNCA debe regenerar `rng_seed` después de `status='open'`. Si lo hace, el commit no matchea y el visitante detectaría manipulación.
- **Source:** Brief B5, BR-006 (verbatim)
- **Validated by:** US-024, US-025 (verify post-sorteo)

---

## Privacy / public exposure

### BR-008 — Datos de comprador opcionales

**Rule:** Todos los campos de contacto del `Buyer` (`name`, `phone`, `email`) son opcionales (nullable). Un buyer puede tener los 3 nulls (comprador anónimo).

- **Trigger:** registro de buyer (FT-004)
- **Behavior:**
  - `Buyer.id` siempre se genera (PK no-null)
  - `name`, `phone`, `email` aceptan null
  - Si `email` tiene valor, debe pasar validación de formato (no se permite "abc")
  - Si `phone` tiene valor, no se valida formato (LATAM tiene formatos heterogéneos)
- **Exception:** ninguna en MVP. Post-MVP podríamos requerir al menos 1 campo si se activan notificaciones (FUERA DE SCOPE).
- **Source:** Brief BR-008 (verbatim), F18
- **Validated by:** US-009 (registrar buyer vacío / con name solo / con email inválido)
- **Display impact:** vista pública muestra iniciales (BR-009)

---

### BR-009 — Exposición de iniciales en vista pública

**Rule:** En la grilla de la vista pública, los tickets vendidos muestran las **iniciales** del comprador junto al número. Teléfono y email **nunca** se exponen públicamente. Si `Buyer.name` es null, fallback a "Anónimo".

- **Trigger:** render de la grilla en vista pública
- **Mechanism:**
  ```ts
  function publicInitials(buyer) {
    if (!buyer.name) return 'Anónimo';
    return (
      buyer.name
        .split(' ')
        .map((w) => w[0].toUpperCase())
        .slice(0, 2)
        .join('.') + '.'
    );
  }
  // "Juan Pérez" → "J.P."
  // "María de los Ángeles García" → "M.D."
  // null → "Anónimo"
  ```
- **Exception ganador:** post-sorteo, el ganador se muestra con **nombre completo** en la vista pública (transparencia del resultado supera privacidad del individuo, decisión consciente).
- **Source:** Brief B4, PO #4, BR-009
- **Validated by:** US-011, US-013, función `publicInitials` unit test

---

## Admin operations

### BR-011 — Reversal solo por admin

**Rule:** Solo el admin puede revertir una venta (`status='sold' → 'available'`). El vendedor NO tiene undo dentro de la app.

- **Trigger:** intento de revertir
- **Behavior:**
  - Admin: ticket libera; persiste `AdminAction(action_type='revert_sale')` con `details = {reason?, prev_buyer_id, prev_seller_id}`
  - Vendedor (programático): 403 Forbidden
- **Precondition:** rifa NO drawn (BR-010)
- **Side effects:**
  - Buyer NO se borra (puede tener otros tickets en otras rifas)
  - Vendedor NO se notifica automáticamente (sin notificaciones en MVP, BR implícita)
- **Source:** Brief B3, BR-011 (verbatim)
- **Validated by:** US-020, US-021

---

### BR-012 — Rotación de access_token del vendedor

**Rule:** El admin puede regenerar el `access_token` de un vendedor en cualquier momento. La rotación invalida inmediatamente el token anterior. Las ventas históricas se preservan (asociadas a `seller_id`, no al token).

- **Trigger:** admin presiona "Rotar URL" en FT-002
- **Behavior:**
  - Nuevo `access_token = nanoid(32)`
  - Token anterior queda invalidado (URL `/v/{old_token}` → 404)
  - URL nueva `/v/{new_token}` → 200 y muestra el panel del mismo vendedor
  - Tickets vendidos previamente NO se tocan (mantienen `seller_id` original)
  - Persiste `AdminAction(action_type='rotate_seller_token', seller_id, details={old_token_hash})`
- **Rationale:** mitigation contra leak de URL (R2 del brief).
- **Source:** Brief B8, BR-012 (verbatim)
- **Validated by:** US-005

---

### BR-013 — Archivado de vendedor preserva ventas

**Rule:** Vendedor con `archived_at != null`: su `access_token` deja de funcionar, pero sus ventas históricas (`Ticket.seller_id`) se preservan intactas.

- **Trigger:** admin archiva vendedor (FT-002)
- **Behavior:**
  - `Seller.archived_at = now()`
  - URL `/v/{access_token}` → 404 (igual que token inválido — no filtra info)
  - Tickets vendidos siguen mostrando el nombre del vendedor en dashboard
  - Dashboard del admin filtra vendedores activos por default
- **Source:** Brief OQ-M3 (resolved), BR-013
- **Validated by:** US-006

---

## State machines (compactos)

### Raffle states

```
            [admin creates]
                 │
                 ▼
              ┌──────┐
              │ open │◄──────── (default; rifa abierta a ventas)
              └──┬───┘
                 │ admin executes draw (BR-005)
                 │ (preconditions: draw_date<=now AND ≥1 sold)
                 ▼
              ┌──────┐
              │ drawn│  ← inmutable (BR-010)
              └──────┘

archived_at:  soft-delete flag (BR-014, BR-015), ortogonal al status.
              Puede aplicarse en 'open' o 'drawn'.
```

> El estado `draft` mencionado en el brief queda como reserved en MVP — no se usa en MVP (la rifa nace `open`). Se conserva en el enum para evolución futura (preview pre-publicación).

### Ticket states

```
              ┌───────────┐
              │ available │◄────────┐ (default al crear rifa)
              └─────┬─────┘         │
                    │               │
                    │ vendedor      │ admin reverts (BR-011)
                    │ claims        │ pre-draw only
                    │ (atomic)      │
                    ▼               │
              ┌──────┐              │
              │ sold ├──────────────┘
              └──────┘
                    │
                    │ raffle drawn → inmutable (BR-010)
                    ▼
              [frozen]
```

### Seller states

```
            [admin creates]
                 │
                 ▼
              ┌────────┐
              │ active │◄────────┐
              └───┬────┘         │
                  │              │ (no UN-archive en MVP;
                  │ archive      │  data preservada igual)
                  ▼              │
              ┌──────────┐       │
              │ archived ├───────┘
              └──────────┘

rotate_token: action ortogonal a active/archived.
              Solo aplicable a active (archived no necesita token).
```

---

## Cross-references

| BR     | Features afectadas | User stories           | Entities            | Tests críticos                            |
| ------ | ------------------ | ---------------------- | ------------------- | ----------------------------------------- |
| BR-001 | FT-005             | US-010                 | Ticket              | DB unique constraint                      |
| BR-002 | FT-005, FT-006     | US-010, US-012         | Ticket              | Concurrency E2E (no-negociable)           |
| BR-003 | FT-007             | US-014                 | Raffle              | E2E "agotado pero countdown sigue"        |
| BR-004 | FT-008             | US-016                 | Raffle, Ticket      | Unit test `seedToWinner`                  |
| BR-005 | FT-008             | US-016, US-017         | Raffle              | E2E sorteo + intento doble                |
| BR-006 | FT-013             | US-024, US-025         | Raffle              | Unit test sha256 + E2E verify             |
| BR-007 | FT-008             | US-016                 | Raffle              | Unit test `executeDraw` con `soldCount=0` |
| BR-008 | FT-004             | US-009                 | Buyer               | Component test campos vacíos              |
| BR-009 | FT-007             | US-013                 | Buyer               | Unit test `publicInitials`                |
| BR-010 | FT-008, FT-011     | US-003, US-017, US-020 | Raffle              | Middleware test mutations bloqueadas      |
| BR-011 | FT-011             | US-020, US-021         | Ticket, AdminAction | E2E revert + 403 vendedor                 |
| BR-012 | FT-002             | US-005                 | Seller, AdminAction | E2E rotate token                          |
| BR-013 | FT-002             | US-006                 | Seller, Ticket      | E2E archive + token dead                  |
| BR-014 | (data integrity)   | —                      | Raffle              | API test delete bloqueado                 |
| BR-015 | FT-007             | US-015                 | Raffle              | E2E archivada + URL pública 200           |

---

## Anti-rules (NO violar)

| ❌ Anti-rule                                                       | Por qué NO                                                                               |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| "Si el admin tarda en sortear, hacerlo automático con cron"        | Brief §8: `Jobs / cron / background: Ninguno en MVP`. El sorteo es decisión manual.      |
| "Cuando se agotan los boletos, cerrar la rifa"                     | Contradice BR-003                                                                        |
| "Para evitar disputas, ocultar las iniciales en la grilla pública" | Contradice BR-009 + intención de transparencia (B4)                                      |
| "Si dos vendedores tocan el mismo número, hacer una cola FIFO"     | Sobre-engineering. BR-002 atomic UPDATE es la solución (gana el primero, otro reintenta) |
| "Permitir re-ejecutar el sorteo si el admin se arrepiente"         | Contradice BR-005, BR-010 — destruye trust del commit-reveal                             |
| "Borrar al Buyer cuando se revierte su ticket"                     | El Buyer puede tener otros tickets (BR-011 side effects)                                 |

---

_05 Business Rules — Rifatela — 15 BR con triggers/mechanism/exceptions + state machines + cross-refs_
