# 09 — Glossary

> **Proyecto:** Rifatela
> **Source:** [`00_DISCOVERY_BRIEF.md`](./00_DISCOVERY_BRIEF.md)
> **Estado:** v1.0
> **Propósito:** SSOT terminológico cross-doc. Si un término aparece en otro doc, usar la definición de acá.

---

## Términos de dominio (negocio)

### Rifa

Unidad de negocio principal. Define un sorteo único con un **set cerrado** de boletos numerados (`1..max_tickets`), un premio, una fecha de sorteo, y una vista pública compartible.

- **Entidad data:** `E-001 Raffle`
- **Estados:** `draft` → `open` → `drawn` (+ `archived_at` soft-delete)

### Boleto / Ticket

Unidad vendible de una rifa. Tiene un número entero único dentro del rango `1..max_tickets` de su rifa. Solo puede estar en uno de dos estados: `available` (disponible para venta) o `sold` (vendido y asignado a un comprador).

- **Entidad data:** `E-005 Ticket`
- Términos equivalentes en UI: "número", "boleto", "ticket"

### Set cerrado

Política de tickets de una rifa: el total de boletos es fijo y conocido desde la creación (definido por `max_tickets`). Contrasta con "lista abierta" donde cualquiera puede comprar sin tope, **modelo NO usado en Rifatela**.

### Sorteo

Evento que ocurre cuando `draw_date` se cumple y el admin presiona "Ejecutar Sorteo". Selecciona aleatoriamente un ticket vendido como ganador usando el `rng_seed`. Se ejecuta **una sola vez** por rifa (BR-005).

### Ganador

Comprador asociado al ticket seleccionado durante el sorteo. Se identifica por `winner_ticket_id` en la rifa. En vista pública se muestra con nombre completo (no iniciales — esto es la única excepción a BR-009).

### Cuenta regresiva / Countdown

Display de tiempo restante hasta `draw_date` en vista pública. Refresca client-side via `setInterval` (no polling server). Cuando llega a 0, el sorteo NO se ejecuta automáticamente — espera acción manual del admin.

---

## Roles (ver `03_USER_PERSONAS.md` para detalle)

### Admin (P-001)

Único administrador del sistema. Crea rifas, gestiona vendedores, ejecuta sorteos, revierte ventas. Acceso via URL secreta. No hay multi-admin en MVP.

### Vendedor (P-002)

Usuario que asigna tickets a compradores. Tiene URL única (`/v/{access_token}`) provista por el admin. No puede deshacer sus ventas (solo admin revierte — BR-011).

### Comprador / Buyer

Persona registrada por un vendedor a la que se le asigna uno o más tickets. Tiene datos opcionales (nombre, teléfono, email — todos pueden ser null per BR-008). Se identifica por `id` interno.

### Visitante (P-003)

Persona anónima que abre la URL pública de una rifa (`/r/{public_slug}`). No se autentica, no se trackea.

---

## Términos técnicos del producto

### URL secreta / access_token

Token largo y unguessable (`nanoid(32)`) que reemplaza el password en MVP. Se transporta en el **path** de la URL (no en query) para minimizar leak por referrer. Admin tiene un token; cada vendedor tiene el suyo. La rifa pública usa `public_slug` (nanoid 10, separado del concepto de auth).

### public_slug

Identificador corto (`nanoid(10)`) que va en la URL pública compartible (`/r/{public_slug}`). Diseñado para compartir por WhatsApp sin exponer IDs internos. NO es secreto — es público por diseño.

### Commit-Reveal (scheme)

Patrón de auditabilidad del sorteo:

1. Al crear la rifa, se pre-genera `rng_seed` y se persiste `seed_commit = sha256(rng_seed)`.
2. `seed_commit` se publica en la vista pública desde que la rifa abre (`status='open'`).
3. Al ejecutar el sorteo, `rng_seed` se revela y se persiste en la rifa.
4. Cualquier visitante puede recalcular `sha256(rng_seed)` cliente-side y verificar que matchea `seed_commit` → prueba de que el seed no fue cambiado post-hoc.

**Implementación cripto:** SHA-256, expuesto via Web Crypto API en el cliente (cero dependencias).

### rng_seed

String aleatorio (≥ 256 bits de entropía, generado server-side con `crypto.randomBytes`) que alimenta el RNG determinista del sorteo. Confidencial **hasta** el sorteo; público desde el momento del sorteo.

### seed_commit

Hash SHA-256 hex del `rng_seed`. Público desde la apertura de la rifa. Permite verificar post-sorteo que el seed no fue manipulado.

### Replay determinista

Propiedad de la animación del sorteo: dada la misma combinación (`rng_seed`, lista de tickets vendidos en orden fijo, `winner_ticket_id`), la animación es 100% reproducible cliente-side. Por eso un visitante que entra post-sorteo ve la **misma** rueda girando que vio el admin en vivo.

- Implicancia: no se necesita websockets ni SSE para sincronizar el sorteo en vivo (decisión B2).

### Ticket digital

Pantalla / link / imagen compartible que el vendedor obtiene después de asignar un número a un comprador. Contiene: nombre rifa, premio, número asignado, nombre del comprador (si se capturó), fecha del sorteo, `public_slug` de la rifa. Se comparte por Web Share API o link directo (FT-010).

### Iniciales

Display público del nombre del comprador en la grilla de la vista pública. Ej: `"Juan Pérez" → "J.P."`. Si `Buyer.name` es null, fallback a `"Anónimo"`. Teléfono y email **nunca** se muestran públicamente (BR-009).

### AdminAction

Log liviano de acciones administrativas con efecto sobre datos sensibles (revertir venta, rotar token, archivar rifa). Tabla `E-006 AdminAction`. Propósito: auditabilidad básica del admin para resolver disputas.

---

## Términos del stack / runtime

### PWA (Progressive Web App)

Web app instalable como icono nativo en mobile + offline-cacheable para vista pública. **SHOULD en MVP** (FT-015, stretch v1.1) — no MUST.

### Server action

Función server-side de Next.js App Router que se invoca desde el cliente como si fuera una función local. Estandarizamos sobre server actions (no REST API público) para todas las mutations (crear rifa, asignar ticket, ejecutar sorteo, revertir, etc.). Ver `08_API_CONTRACTS.md`.

### Atomic UPDATE (Drizzle pattern)

Patrón Drizzle obligatorio para asignar tickets (BR-002):

```ts
const claimed = await db
  .update(tickets)
  .set({ status: 'sold', buyerId, sellerId, soldAt: new Date() })
  .where(and(eq(tickets.id, ticketId), eq(tickets.status, 'available')))
  .returning();
```

Si `claimed.length === 0` → `ConflictError`. Garantiza zero doble-venta sin transactions explícitas (single-statement = atómico en Postgres).

### Neon HTTP driver

Driver de Neon Postgres serverless usado por Drizzle. Soporta single-statement queries pero NO multi-statement transactions. Compatible con el patrón Atomic UPDATE.

---

## Acciones / verbos del dominio

| Verbo                    | Definición                                                                                  | Quién     | Doc relacionado |
| ------------------------ | ------------------------------------------------------------------------------------------- | --------- | --------------- |
| **Crear rifa**           | Configurar nueva rifa, generar `rng_seed`/`seed_commit`, abrir para ventas                  | Admin     | FT-001          |
| **Dar de alta vendedor** | Crear `Seller` con `access_token`                                                           | Admin     | FT-002          |
| **Rotar URL**            | Regenerar `access_token` de un vendedor; invalida el anterior                               | Admin     | FT-002, BR-012  |
| **Archivar**             | Soft-delete (Raffle o Seller). Soft-archive para limpiar dashboard, pero datos se preservan | Admin     | BR-013, BR-015  |
| **Registrar comprador**  | Crear `Buyer` con datos opcionales                                                          | Vendedor  | FT-004          |
| **Asignar número**       | Reclamar atómicamente un ticket disponible para un buyer                                    | Vendedor  | FT-005          |
| **Revertir venta**       | Liberar ticket vendido (`sold` → `available`). Solo pre-sorteo                              | Admin     | FT-011, BR-011  |
| **Ejecutar sorteo**      | Selección aleatoria del ganador entre tickets vendidos                                      | Admin     | FT-008, BR-005  |
| **Verificar sorteo**     | Validar `sha256(rng_seed) === seed_commit` cliente-side                                     | Visitante | FT-013          |

---

## Anti-términos (NO usar)

| Confundible             | Por qué evitarlo                     | Usar en su lugar                                 |
| ----------------------- | ------------------------------------ | ------------------------------------------------ |
| "Cuenta de vendedor"    | Sugiere registro con email/password  | "Vendedor" + "access_token" / "URL del vendedor" |
| "Login del vendedor"    | Implica password flow                | "Acceso del vendedor" o "URL del vendedor"       |
| "Apostador" / "Apuesta" | Implica gambling regulado            | "Comprador" / "Boleto"                           |
| "Premio mayor / menor"  | Sugiere multi-premio (post-MVP)      | "Premio" (singular, en MVP siempre 1)            |
| "Cerrar rifa"           | Ambiguo: ¿cierro ventas? ¿la sortéo? | "Sortear" (FT-008) o "Archivar"                  |
| "Recargar tickets"      | No existe — set cerrado              | n/a                                              |

---

_09 Glossary — Rifatela — 38 términos, mapeo a entidades / features / docs_
