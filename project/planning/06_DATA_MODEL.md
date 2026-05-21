# 06 — Data Model

> **Proyecto:** Rifatela
> **Source:** [`00_DISCOVERY_BRIEF.md`](./00_DISCOVERY_BRIEF.md) §4 + [`05_BUSINESS_RULES.md`](./05_BUSINESS_RULES.md)
> **Estado:** v1.0
> **ID namespace:** `E-XXX`
> **Stack:** Drizzle ORM + Neon Postgres (per `SK.md §1.2`)

---

## Resumen

| ID    | Entity        | Purpose                                                           | Sensitive                          |
| ----- | ------------- | ----------------------------------------------------------------- | ---------------------------------- |
| E-001 | `Raffle`      | Unidad principal: 1 rifa = 1 sorteo                               | No (excepto `rng_seed` pre-sorteo) |
| E-002 | `Prize`       | Premio asociado a una rifa (1:N para soporte multi-premio futuro) | No                                 |
| E-003 | `Seller`      | Vendedor con access_token único                                   | Sí (`access_token`)                |
| E-004 | `Buyer`       | Comprador con datos opcionales                                    | Sí (PII: name/phone/email)         |
| E-005 | `Ticket`      | Boleto numerado dentro de una rifa                                | No (FK al buyer, que sí es PII)    |
| E-006 | `AdminAction` | Log de acciones administrativas auditables                        | No                                 |

Total: **6 tablas**.

---

## ERD (alto nivel)

```
                     ┌──────────────┐
                     │   Raffle     │ E-001
                     │   (1)        │
                     └──────┬───────┘
                            │
                  ┌─────────┼─────────┐
                  │         │         │
            (1:N) │   (1:N) │  (1:N)  │
                  ▼         ▼         ▼
            ┌──────────┐ ┌────────┐ ┌──────────────┐
            │  Prize   │ │ Ticket │ │ AdminAction  │
            │  E-002   │ │ E-005  │ │   E-006      │
            └──────────┘ └───┬─┬──┘ └──────────────┘
                            │ │
                       (N:1)│ │(N:1)
                            ▼ ▼
                     ┌────────┐   ┌────────┐
                     │ Buyer  │   │ Seller │
                     │ E-004  │   │ E-003  │
                     └────────┘   └────────┘
                       (PII)        (token)
```

**Relaciones críticas:**

- `Raffle 1:N Prize` (MVP: 1 prize per raffle; modelo abierto a multi-premio post-MVP)
- `Raffle 1:N Ticket` (un raffle tiene exactamente `max_tickets` tickets, generados al crear)
- `Ticket N:1 Buyer?` (nullable cuando `status='available'`)
- `Ticket N:1 Seller?` (nullable cuando `status='available'`)
- `AdminAction N:1 Raffle?` / `N:1 Ticket?` / `N:1 Seller?` (todos opcionales, depende del action_type)

---

## E-001 — Raffle

### Schema

```ts
// src/lib/db/schema/raffles.ts
import { pgTable, uuid, text, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const raffleStatusEnum = pgEnum('raffle_status', ['draft', 'open', 'drawn']);
// 'draft' reserved for post-MVP preview flow; MVP nace en 'open'.

export const raffles = pgTable('raffles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  maxTickets: integer('max_tickets').notNull(), // 1..10000 validado por Zod
  drawDate: timestamp('draw_date', { withTimezone: true }).notNull(),
  status: raffleStatusEnum('status').notNull().default('open'),
  winnerTicketId: uuid('winner_ticket_id'), // FK→Ticket, nullable pre-sorteo
  rngSeed: text('rng_seed'), // null hasta sorteo; revealed post-draw
  seedCommit: text('seed_commit').notNull(), // sha256(rngSeed), public desde 'open'
  drawnAt: timestamp('drawn_at', { withTimezone: true }),
  publicSlug: text('public_slug').notNull().unique(), // nanoid(10), URL pública
  archivedAt: timestamp('archived_at', { withTimezone: true }), // soft-delete
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### Constraints

| Constraint                                                                                        | Tipo                 | Razón                                         |
| ------------------------------------------------------------------------------------------------- | -------------------- | --------------------------------------------- |
| `public_slug UNIQUE`                                                                              | DB                   | Evita colisiones en URLs públicas             |
| `max_tickets BETWEEN 1 AND 10000`                                                                 | App (Zod)            | MVP cap razonable; no en DB para flexibilidad |
| `draw_date > created_at`                                                                          | App                  | Pasado no tiene sentido                       |
| `status='drawn' → drawn_at IS NOT NULL AND winner_ticket_id IS NOT NULL AND rng_seed IS NOT NULL` | App (BR-010, BR-005) | Invariant de estado final                     |

### Indexes

| Index                                    | Cardinalidad esperada                                 |
| ---------------------------------------- | ----------------------------------------------------- |
| `(public_slug)` UNIQUE                   | High (10⁴ rifas históricas, lookup público frecuente) |
| `(status, archived_at, created_at DESC)` | Dashboard admin (filter + order)                      |
| `(draw_date)`                            | Listado por fecha próxima de sorteo                   |

### Sensitive fields

- `rng_seed`: **CONFIDENCIAL pre-sorteo**. Server NUNCA debe exponerlo vía API hasta que `status='drawn'`. Post-sorteo, es público (BR-006).
- `seed_commit`: público desde creación. Hex string de 64 chars.

---

## E-002 — Prize

### Schema

```ts
// src/lib/db/schema/prizes.ts
import { pgTable, uuid, text, integer } from 'drizzle-orm/pg-core';
import { raffles } from './raffles';

export const prizes = pgTable(
  'prizes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    raffleId: uuid('raffle_id')
      .notNull()
      .references(() => raffles.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(1), // 1 = principal, 2 = segundo, ... (MVP solo usa 1)
    text: text('text').notNull(),
    imageUrl: text('image_url'), // Vercel Blob URL, nullable
  },
  (t) => ({
    uniqueRafflePosition: { columns: [t.raffleId, t.position], unique: true },
  })
);
```

### Constraints

| Constraint                     | Razón                                                                      |
| ------------------------------ | -------------------------------------------------------------------------- |
| `(raffle_id, position) UNIQUE` | Evita duplicado de prize en una posición (ej. dos "primer premio")         |
| `onDelete: 'cascade'`          | Si rifa se borra (caso edge, no hay ventas — BR-014), sus prizes se borran |

### MVP usage

- Cada rifa tiene exactamente **1 prize** con `position=1`.
- UI de creación de rifa: form crea Raffle + 1 Prize en una transacción server action.
- Post-MVP: UI permitirá agregar prizes adicionales (`position=2, 3, ...`) sin migración de schema.

---

## E-003 — Seller

### Schema

```ts
// src/lib/db/schema/sellers.ts
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const sellers = pgTable('sellers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  accessToken: text('access_token').notNull().unique(), // nanoid(32) — URL secreta
  archivedAt: timestamp('archived_at', { withTimezone: true }), // soft-delete
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### Constraints

| Constraint                  | Razón                                 |
| --------------------------- | ------------------------------------- |
| `access_token UNIQUE`       | Cada token identifica un único seller |
| `access_token MIN 32 chars` | App (nanoid 32 = 191 bits entropy)    |

### Indexes

| Index                            | Razón                                                 |
| -------------------------------- | ----------------------------------------------------- |
| `(access_token)` UNIQUE          | Lookup en cada request del vendedor (middleware auth) |
| `(archived_at, created_at DESC)` | Dashboard admin "vendedores activos"                  |

### Sensitive fields

- `access_token`: **NUNCA en logs**, **NUNCA en error messages**, **NUNCA exposed en API responses listas** (el admin solo lo ve en su panel post-creación / post-rotación). Cliente solo lo conoce vía URL inicial.
- Rotation (BR-012): nuevo token reemplaza el viejo; el viejo NO se persiste (no hay tabla de tokens revocados — security through key replacement).

---

## E-004 — Buyer

### Schema

```ts
// src/lib/db/schema/buyers.ts
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const buyers = pgTable('buyers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'), // NULL permitido (BR-008)
  phone: text('phone'), // NULL permitido
  email: text('email'), // NULL permitido, validado por Zod si presente
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### Constraints

| Constraint                      | Razón                                |
| ------------------------------- | ------------------------------------ |
| (todos los campos PII nullable) | BR-008 — comprador anónimo permitido |
| Email format validation         | App (Zod) — solo si valor presente   |

### Sensitive fields

- `phone`, `email`: PII. Nunca en vista pública (BR-009 — solo iniciales del name).
- Retention policy `[INFERRED]`: data se mantiene mientras la rifa exista (no se purga automáticamente). Post-MVP: definir job de purge >90 días desde archivado.

---

## E-005 — Ticket

### Schema

```ts
// src/lib/db/schema/tickets.ts
import { pgTable, uuid, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { raffles } from './raffles';
import { buyers } from './buyers';
import { sellers } from './sellers';

export const ticketStatusEnum = pgEnum('ticket_status', ['available', 'sold']);

export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    raffleId: uuid('raffle_id')
      .notNull()
      .references(() => raffles.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(), // 1..max_tickets del raffle
    status: ticketStatusEnum('status').notNull().default('available'),
    buyerId: uuid('buyer_id').references(() => buyers.id, { onDelete: 'set null' }), // null cuando available
    sellerId: uuid('seller_id').references(() => sellers.id, { onDelete: 'set null' }), // null cuando available
    soldAt: timestamp('sold_at', { withTimezone: true }),
  },
  (t) => ({
    uniqueRaffleNumber: { columns: [t.raffleId, t.number], unique: true },
  })
);
```

### Constraints

| Constraint                                                                        | Razón                                                              |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `(raffle_id, number) UNIQUE`                                                      | BR-001 — un número único por rifa                                  |
| `status='sold' → buyer_id NOT NULL AND seller_id NOT NULL AND sold_at NOT NULL`   | App invariant + check enforceable post-MVP via DB check constraint |
| `status='available' → buyer_id IS NULL AND seller_id IS NULL AND sold_at IS NULL` | App invariant — revert (BR-011) limpia los 3 campos juntos         |

### Indexes

| Index                                     | Razón                                                           |
| ----------------------------------------- | --------------------------------------------------------------- |
| `(raffle_id, number)` UNIQUE              | Lookup directo + uniqueness                                     |
| `(raffle_id, status)`                     | Grilla pública / vendedor (filtra disponibles vs vendidos)      |
| `(seller_id) WHERE status='sold'` PARTIAL | Métricas por vendedor (FT-012)                                  |
| `(buyer_id)`                              | Tickets de un buyer (raro, pero útil para "mis tickets" futuro) |

### Bulk insert al crear rifa

Al crear una rifa con `max_tickets=N`, se insertan **N tickets** en una sola query (bulk INSERT) con `status='available'`. Esto pre-genera todo el set cerrado y simplifica la grilla pública (siempre hay un row por número).

```ts
// Pseudocode (server action `createRaffle`)
const tickets = Array.from({ length: maxTickets }, (_, i) => ({
  raffleId,
  number: i + 1,
  status: 'available' as const,
}));
await db.insert(ticketsTable).values(tickets);
```

---

## E-006 — AdminAction

### Schema

```ts
// src/lib/db/schema/admin-actions.ts
import { pgTable, uuid, text, jsonb, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { raffles } from './raffles';
import { tickets } from './tickets';
import { sellers } from './sellers';

export const adminActionTypeEnum = pgEnum('admin_action_type', [
  'revert_sale',
  'rotate_seller_token',
  'archive_raffle',
  'archive_seller',
  'edit_raffle',
]);

export const adminActions = pgTable('admin_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  actionType: adminActionTypeEnum('action_type').notNull(),
  raffleId: uuid('raffle_id').references(() => raffles.id, { onDelete: 'set null' }),
  ticketId: uuid('ticket_id').references(() => tickets.id, { onDelete: 'set null' }),
  sellerId: uuid('seller_id').references(() => sellers.id, { onDelete: 'set null' }),
  details: jsonb('details').notNull().default({}), // shape varies per actionType
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### Details shape per action_type

| action_type           | Required fields en `details`                                            |
| --------------------- | ----------------------------------------------------------------------- |
| `revert_sale`         | `{ reason?: string, prevBuyerId: uuid, prevSellerId: uuid }`            |
| `rotate_seller_token` | `{ oldTokenHash: string }` (hash del token viejo, NUNCA el token plain) |
| `archive_raffle`      | `{ reason?: string }`                                                   |
| `archive_seller`      | `{ reason?: string }`                                                   |
| `edit_raffle`         | `{ changes: { fieldName: { from, to } } }`                              |

### Constraints / indexes

- Al menos una de (`raffle_id`, `ticket_id`, `seller_id`) debe ser non-null (app invariant)
- Index `(created_at DESC)` para "últimas acciones del admin" UI

---

## Algoritmo: `seedToWinner` (determinista)

Función pura que dada (`rng_seed`, lista ordenada de tickets vendidos) retorna el ticket ganador. Base de:

- BR-004 (sorteo entre vendidos)
- BR-005 (resultado único)
- FT-009 (replay determinista cliente-side)

```ts
// src/lib/draw/seedToWinner.ts
import { sha256 } from '@noble/hashes/sha2';

/**
 * Given an rngSeed and the ordered list of sold ticket IDs,
 * deterministically returns the winning ticket index.
 *
 * Pure function — same input → same output, always.
 * Used both server-side (at draw time) and client-side (replay).
 */
export function seedToWinner(
  rngSeed: string,
  soldTicketIds: string[]
): {
  winnerIndex: number;
  winnerTicketId: string;
} {
  if (soldTicketIds.length === 0) {
    throw new Error('no_tickets_sold');
  }
  // Hash the seed → take first 8 bytes → bigint → modulo over sold count
  const hashBytes = sha256(rngSeed);
  const num = BigInt(
    '0x' +
      Array.from(hashBytes.slice(0, 8))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
  );
  const winnerIndex = Number(num % BigInt(soldTicketIds.length));
  return { winnerIndex, winnerTicketId: soldTicketIds[winnerIndex] };
}
```

### Properties

- **Deterministic:** `sha256(seed) % N` produces the same result siempre. Crítico para replay (FT-009).
- **Uniform-enough distribution:** sha256 garantiza distribución uniforme; modulo bias es ≤ 2⁻⁵⁵ para N ≤ 10⁴ (trivially fair).
- **No external state:** función pura, no DB calls, no random. Test trivial.
- **Soldering:** `soldTicketIds` debe estar ORDENADO consistente entre server (sorteo) y client (replay). Convención: `ORDER BY tickets.number ASC`.

### Verification de commit-reveal (cliente-side)

```ts
// src/lib/draw/verifyDraw.ts
export async function verifyDraw(
  publishedSeedCommit: string,
  revealedSeed: string
): Promise<{ valid: boolean; computedHash: string }> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(revealedSeed));
  const computedHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return { valid: computedHash === publishedSeedCommit, computedHash };
}
```

Usado en FT-013 / US-025 — verificación pública del sorteo.

---

## Migrations strategy

Per `SK.md §1.1`:

1. `pnpm db:generate` — genera migration SQL
2. `pnpm db:migrate` — aplica
3. ❌ NUNCA `pnpm db:push` sin aprobación explícita

### Orden de creación de tablas (dependencies)

1. `raffles`
2. `sellers`
3. `buyers`
4. `prizes` (FK → raffles)
5. `tickets` (FK → raffles, buyers, sellers)
6. `admin_actions` (FK → raffles, tickets, sellers)

---

## Sample data (seeds para dev)

```ts
// src/lib/db/seeds/dev.ts
const rngSeed = generateSeed(); // 256-bit
await db
  .insert(raffles)
  .values({
    name: 'Rifa Test',
    maxTickets: 100,
    drawDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
    status: 'open',
    seedCommit: sha256Hex(rngSeed),
    publicSlug: nanoid(10),
  })
  .returning({ id });
// + 100 tickets bulk insert
// + 1 prize
// + 3 sellers con nanoid(32)
```

---

## Decisiones de modelo (post-Challenge-Pass)

| Decisión                                             | Trade-off                                                                                                   |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Tabla `Prize` desde MVP (B7-b)                       | +1 tabla hoy, evita migración cuando se active multi-premio                                                 |
| `archived_at` soft-delete en Raffle y Seller         | Permite preservar URLs públicas y ventas históricas (BR-013, BR-015)                                        |
| `seed_commit` siempre persisted, `rng_seed` nullable | Permite que el commit sea público inmediatamente sin revelar el seed                                        |
| `AdminAction` table separada                         | Audit trail liviano sin polucionar las tablas de negocio                                                    |
| Bulk insert de tickets al crear rifa                 | Simplifica grilla pública; trade-off vs lazy-create (~100 rows × ~100 bytes = ~10KB por rifa, despreciable) |
| `Buyer` con campos nullable                          | BR-008 — comprador anónimo permitido                                                                        |
| Status enum (no booleans)                            | Extensibilidad: pre-MVP `draft` reservado para preview futuro                                               |

---

## Cross-references

| Entity            | Used by                        | Brief refs                 | BR refs                                        |
| ----------------- | ------------------------------ | -------------------------- | ---------------------------------------------- |
| E-001 Raffle      | FT-001, FT-007, FT-008, FT-013 | F1-F27 (core), B5, B7      | BR-003, BR-005, BR-006, BR-010, BR-014, BR-015 |
| E-002 Prize       | FT-001                         | F26, B7                    | (none direct, derived from E-001)              |
| E-003 Seller      | FT-002, FT-003                 | F3, F14, B8                | BR-012, BR-013                                 |
| E-004 Buyer       | FT-004                         | F18, B4                    | BR-008, BR-009                                 |
| E-005 Ticket      | FT-005, FT-006, FT-011         | F10, F11, F19, F20, B1, B3 | BR-001, BR-002, BR-003, BR-004, BR-011         |
| E-006 AdminAction | FT-002, FT-011                 | B3, B8                     | BR-011, BR-012, BR-013                         |

---

_06 Data Model — Rifatela — 6 entities + seedToWinner algorithm + commit-reveal verification_
