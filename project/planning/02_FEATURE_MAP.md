# 02 — Feature Map

> **Proyecto:** Rifatela
> **Source:** [`00_DISCOVERY_BRIEF.md`](./00_DISCOVERY_BRIEF.md) §3
> **Estado:** v1.0
> **ID namespace:** `FT-XXX` (features)

---

## Resumen MoSCoW

| Priority                  | Count | IDs                           |
| ------------------------- | ----- | ----------------------------- |
| **MUST** (MVP v1.0)       | 14    | FT-001 → FT-014               |
| **SHOULD** (stretch v1.1) | 2     | FT-015, FT-016                |
| **COULD / WON'T**         | —     | Ver §3 out-of-scope del brief |

> **Cross-ref ID brief → doc:** `F-001` brief = `FT-001` doc. Misma numeración, prefix cambia per skill convention.

---

## MUST — MVP v1.0

### FT-001 — Admin crea rifa

- **Persona:** Admin (P-001)
- **Goal:** Configurar una rifa con premio, capacidad y fecha de sorteo
- **Inputs:** nombre, premio (texto + imagen), `max_tickets`, `draw_date`
- **Outputs:** Rifa persistida con `status='draft'` → `'open'`; `seed_commit = sha256(rng_seed)` pre-publicado; `public_slug` generado (`nanoid(10)`)
- **Dependencies:** —
- **Acceptance shorthand:** admin puede crear rifa válida y aparece en dashboard
- **Source:** Brief F1, F2, F5, F10, F26, B5

### FT-002 — Admin gestiona vendedores

- **Persona:** Admin (P-001)
- **Goal:** Dar de alta, copiar URL, **rotar URL** y archivar vendedores
- **Inputs:** nombre del vendedor; action `rotate` / `archive`
- **Outputs:** `Seller` con `access_token` (`nanoid(32)`); rotation invalida el token anterior; archive setea `archived_at`
- **Dependencies:** —
- **Source:** Brief F3, F14, B8

### FT-003 — Vendedor login "soy yo"

- **Persona:** Vendedor (P-002)
- **Goal:** Acceder a su panel sin password
- **Trigger:** URL `/v/{access_token}` (nanoid 32)
- **Outputs:** Session cookie scoped al `seller_id` (sin password, sin email). Si el token no matchea ningún vendedor activo → 404.
- **Dependencies:** FT-002
- **Source:** Brief F14, F15

### FT-004 — Vendedor registra comprador

- **Persona:** Vendedor (P-002)
- **Goal:** Capturar datos del comprador (todos opcionales)
- **Inputs:** `name?`, `phone?`, `email?` (cualquier subset, incluso vacío)
- **Outputs:** `Buyer` creado con `id` (PK siempre presente, contacto opcional)
- **Dependencies:** FT-003
- **Source:** Brief F4, F18

### FT-005 — Vendedor asigna número

- **Persona:** Vendedor (P-002)
- **Goal:** Asignar un número disponible al comprador recién creado
- **Inputs:** `ticket_id` (elegido en grilla)
- **Outputs:** Ticket pasa a `status='sold'`, con `buyer_id`, `seller_id`, `sold_at`
- **Dependencies:** FT-004, FT-006
- **Source:** Brief F11, F15

### FT-006 — Concurrency atómica (zero doble-venta)

- **Persona:** Sistema (invariant técnico)
- **Goal:** Garantizar que un número solo se vende una vez bajo concurrencia
- **Mechanism:** Single-statement `UPDATE tickets SET … WHERE id=? AND status='available' RETURNING *`. Si `rowCount=0` → HTTP 409.
- **UX side:** Toast _"Ese número ya se vendió, elegí otro"_ + refresh de grilla
- **Dependencies:** crítico para FT-005, FT-010
- **Source:** Brief BR-001, BR-002, B1

### FT-007 — Vista pública por rifa

- **Persona:** Visitante (P-003)
- **Goal:** Ver el estado completo de la rifa sin autenticarse
- **URL:** `/r/{public_slug}` (compartible por WhatsApp)
- **Outputs:** Hero (premio + countdown), grilla de números (vendidos muestran **iniciales** del comprador, ej "47 — J.P."), `seed_commit` visible
- **Dependencies:** FT-001
- **Source:** Brief F6, F17, F26, B4

### FT-008 — Sorteo manual con animación

- **Persona:** Admin (P-001)
- **Goal:** Ejecutar el sorteo en/después de `draw_date`
- **Inputs:** action `draw` (botón)
- **Outputs:** Selecciona ganador entre tickets vendidos usando `rng_seed`; persiste `winner_ticket_id`, `drawn_at`; revela `rng_seed`; `status` → `drawn`. Anima rueda de la fortuna.
- **Constraint:** ejecutable una sola vez por rifa (BR-005)
- **Dependencies:** FT-001, ≥1 ticket vendido (BR-007)
- **Source:** Brief F7, F13, F27

### FT-009 — Resultado post-sorteo + replay determinista

- **Persona:** Visitante (P-003)
- **Goal:** Ver el sorteo aunque no haya estado conectado en vivo
- **Mechanism:** Vista pública post-sorteo reproduce la animación de la rueda usando `rng_seed` revelado (replay determinista, no real-time sync)
- **Dependencies:** FT-008
- **Source:** Brief F17, B2

### FT-010 — Ticket digital compartible

- **Persona:** Vendedor (P-002) → Comprador (externo)
- **Goal:** Dar al comprador prueba de su número
- **Outputs:** Después de FT-005, pantalla con ticket visual (rifa + premio + N° + nombre + fecha sorteo) compartible vía Web Share API / link directo
- **Dependencies:** FT-005
- **Source:** Brief B4 proof-of-purchase

### FT-011 — Admin revierte venta

- **Persona:** Admin (P-001)
- **Goal:** Liberar un ticket vendido por error
- **Inputs:** `ticket_id`, razón (opcional)
- **Outputs:** Ticket → `status='available'`, limpia `buyer_id`/`seller_id`/`sold_at`. Log en `AdminAction`.
- **Constraint:** Solo admin (no vendedor). Solo pre-sorteo (BR-010 inmutabilidad post-`drawn`).
- **Dependencies:** FT-005
- **Source:** Brief B3, BR-011

### FT-012 — Admin dashboard con métricas

- **Persona:** Admin (P-001)
- **Goal:** Ver de un vistazo el estado de todas las rifas
- **Outputs:** Tabla/cards con: rifa, status, `% vendido` (sold/max_tickets), `días restantes` (draw_date - now), total vendedores, total ventas. Filtro toggle "incluir archivadas".
- **Dependencies:** FT-001, FT-002
- **Source:** Brief PO #5

### FT-013 — Verificación pública (commit-reveal)

- **Persona:** Visitante (P-003)
- **Goal:** Validar que el sorteo no fue manipulado
- **Mechanism:**
  1. Pre-sorteo: vista pública muestra `seed_commit` (sha256 del seed)
  2. Post-sorteo: `rng_seed` se revela
  3. UI ofrece botón "Verificar este sorteo" → calcula `sha256(seed)` cliente-side y compara con `seed_commit` → muestra ✅/❌
- **Dependencies:** FT-001, FT-008
- **Source:** Brief BR-006, B5

### FT-014 — Mobile-first baseline (cross-cutting)

- **Persona:** Todas
- **Goal:** Usabilidad completa desde 375px (iPhone SE) sin scroll horizontal
- **Scope:** Todas las pantallas (admin, vendedor, pública). Aplica a TODOS los FT anteriores como AC transversal.
- **Source:** Brief F21, SK.md §3.2 (política TimeKast durable)

---

## SHOULD — Stretch v1.1

### FT-015 — PWA instalable

- **Persona:** Visitante + Vendedor
- **Goal:** Instalar la app como icono nativo + vista pública cacheable offline
- **Scope:** Manifest + service worker. Cache vista pública (último snapshot). NO offline-write para vendedor (rechazado por riesgo doble-venta).
- **Dependencies:** todas las MUST funcionando como web
- **Source:** Brief F23 + B6 (downgraded MUST→SHOULD)

### FT-016 — Sonido sorteo con mute

- **Persona:** Visitante + Admin durante FT-008
- **Goal:** Audio en la animación (tick de rueda + fanfarria al revelar) con toggle mute persistido
- **Dependencies:** FT-008
- **Source:** Brief OQ-V1

---

## Out of scope (WON'T en MVP)

Per brief §3 "Out of scope":

- Múltiples premios por rifa (modelo data ya lo soporta vía `Prize` table; falta UI)
- Pagos online (Mercado Pago / Stripe)
- Multi-tenant / SaaS
- Auth real (password / magic link / OAuth)
- Notificaciones automáticas (email / WhatsApp / SMS)
- Sorteo vinculado a lotería externa
- Histórico público de rifas pasadas más allá de archivadas
- Offline-write para vendedores

---

## Dependency graph (alto nivel)

```
FT-001 (admin crea rifa)
  ├─→ FT-007 (vista pública)
  ├─→ FT-008 (sorteo)
  ├─→ FT-012 (dashboard)
  └─→ FT-013 (commit-reveal)

FT-002 (gestiona vendedores)
  └─→ FT-003 (vendedor login)
        └─→ FT-004 (registra comprador)
              └─→ FT-005 (asigna número)  ←── FT-006 (concurrency invariant)
                    ├─→ FT-010 (ticket digital)
                    └─→ FT-011 (admin revierte)

FT-008 (sorteo)
  ├─→ FT-009 (replay)
  └─→ FT-013 (reveal seed)

FT-014 (mobile-first) ─── cross-cutting a todas
FT-015 (PWA) ─── depende de todas las MUST funcionando
FT-016 (sonido) ─── depende de FT-008
```

---

## Implementation sequencing (recomendado por Planner Challenge Pass)

| Fase                          | Features                                       | Duración estimada | Demoable                                                                                 |
| ----------------------------- | ---------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------- |
| **Fase 0 — Core loop**        | FT-001, FT-002, FT-003, FT-004, FT-005, FT-006 | ~1 semana         | Vendedor puede vender, sistema previene doble-venta. Sin UI bonita.                      |
| **Fase 1 — Pública + Sorteo** | FT-007, FT-008, FT-009, FT-010, FT-013         | ~1 semana         | Vista pública con countdown, sorteo + replay, commit-reveal verificable, ticket digital. |
| **Fase 2 — Operacional**      | FT-011, FT-012, FT-014 (pulido mobile)         | ~3-5 días         | Admin tools (revert, dashboard métricas) + pulido mobile-first.                          |
| **Fase 3 — Stretch**          | FT-015 PWA, FT-016 Sonido                      | post-MVP          | Solo si timeline lo permite.                                                             |

---

_02 Feature Map — Rifatela — 16 features (14 MUST + 2 SHOULD), dependency graph, sequencing por fases_
