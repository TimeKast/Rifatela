# 08 — API Contracts

> **Proyecto:** Rifatela
> **Source:** [`07_ARCHITECTURE.md`](./07_ARCHITECTURE.md) + [`05_BUSINESS_RULES.md`](./05_BUSINESS_RULES.md)
> **Estado:** v1.0
> **Convención:** Server actions de Next.js (NO REST API público en MVP)

---

## Filosofía

Rifatela **no expone API REST público** en MVP. Toda mutación pasa por **server actions** de Next.js, invocadas desde Server Components o Client Components vía `useActionState` / form actions. Esto:

- Elimina necesidad de docs OpenAPI / Postman collections / SDK clients
- Elimina CSRF protection manual (Next.js lo hace)
- Mantiene typesafe end-to-end (input/output TypeScript inferidos)
- Permite `revalidatePath` automático post-mutación

Este doc define los **contratos** (inputs Zod, outputs, errors) de cada server action — es el equivalente a un OpenAPI spec.

---

## Conventions

### Naming

- Server actions viven en `src/lib/actions/{domain}/*.ts`
- Exportadas como `export const actionName = withAuth/withSelf(...)` (helpers per `SK.md §2.3`)
- Naming: `verbNoun` en camelCase (`createRaffle`, `claimTicket`, `revertSale`)

### Helper wrappers (per `SK.md §2.3`)

```ts
// Admin-only actions
export const someAdminAction = (input: unknown) =>
  withAuth(
    { resource: 'raffles', action: 'edit', schema: SomeSchema, revalidate: '/admin' },
    input,
    async (data, _userId) => {
      /* ... */
    }
  );

// Per-role actions (vendedor identified by token)
export const someSellerAction = (input: unknown) =>
  withSellerToken(
    { schema: SomeSchema, revalidate: '/v/[token]' },
    input,
    async (data, sellerId) => {
      /* ... */
    }
  );
```

> **Note:** `withAuth` y `withSelf` son los wrappers shipped por el kit. Para MVP con auth URL-secret necesitamos un wrapper extra `withSellerToken` (custom — ver `kb-actions` SK skill al implementar).

### Error envelope

Todos los errores siguen un shape consistente:

```ts
type ActionError = {
  code: ErrorCode;
  message: string; // i18n key o mensaje user-facing
  field?: string; // si es validation error
  details?: unknown;
};

type ErrorCode =
  // Auth/auth
  | 'unauthorized' // 401
  | 'forbidden' // 403
  | 'not_found' // 404
  // Validation
  | 'validation_failed' // 400
  // Business
  | 'ticket_already_sold' // 409 — BR-002 concurrency
  | 'raffle_immutable' // 409 — BR-010
  | 'raffle_has_sales' // 409 — BR-014
  | 'draw_date_not_reached' // 409 — BR-005
  | 'no_tickets_sold' // 409 — BR-005
  | 'already_drawn' // 409 — BR-005
  // Infra
  | 'upload_failed'
  | 'internal_error';
```

### Success envelope

```ts
type ActionSuccess<T> = { ok: true; data: T };
type ActionResult<T> = ActionSuccess<T> | ({ ok: false } & ActionError);
```

---

## Raffle domain

### `createRaffle(input)`

**Wrapper:** `withAuth({ resource: 'raffles', action: 'create', schema })`
**Used by:** US-001, US-002

**Input schema (Zod):**

```ts
const CreateRaffleSchema = z.object({
  name: z.string().min(3).max(120),
  prizeText: z.string().min(3).max(500),
  prizeImage: z
    .instanceof(File)
    .optional()
    .refine((f) => !f || f.size <= 5_000_000, 'image_too_large')
    .refine((f) => !f || /^image\/(jpeg|png|webp)$/.test(f.type), 'invalid_image_type'),
  maxTickets: z.number().int().min(1).max(10_000),
  drawDate: z.coerce
    .date()
    .refine((d) => d > new Date(Date.now() + 60 * 60 * 1000), 'draw_date_too_soon'),
});
```

**Output:**

```ts
{ ok: true, data: { raffleId: string; publicSlug: string; adminUrl: string } }
```

**Errors:** `validation_failed`, `upload_failed`, `internal_error`

**Side effects:**

- INSERT 1 Raffle (con `seedCommit` calculado server-side)
- INSERT 1 Prize (position=1)
- INSERT N Tickets (bulk, status='available')
- Si imagen: upload a Vercel Blob → persisted en `Prize.imageUrl`
- `revalidatePath('/admin')`

**Anti-pattern:** retornar `rngSeed` en la response. NUNCA.

---

### `editRaffle(input)`

**Wrapper:** `withAuth({ resource: 'raffles', action: 'edit', schema })`
**Used by:** US-003

**Input:**

```ts
{
  raffleId: string;
  changes: {
    name?: string;
    prizeText?: string;
    prizeImage?: File;
    drawDate?: Date;  // solo permitido si maxTickets no se redujo bajo sold_count
    maxTickets?: number;  // solo si nadie vendió (sold_count==0)
  };
}
```

**Output:** `{ ok: true, data: { raffle: Raffle } }`

**Errors:**

- `raffle_immutable` si `status='drawn'` (BR-010)
- `validation_failed` si reducir maxTickets bajo sold_count

**Side effects:** persiste `AdminAction(action_type='edit_raffle', details={ changes })`

---

### `executeDraw(input)`

**Wrapper:** `withAuth({ resource: 'raffles', action: 'draw', schema })`
**Used by:** US-016, US-017

**Input:** `{ raffleId: string }`

**Output:**

```ts
{
  ok: true,
  data: {
    winnerTicketId: string;
    winnerNumber: number;
    winnerBuyer: { id: string; name: string | null };
    rngSeed: string;        // ← revelado en esta response
    drawnAt: string;        // ISO
  }
}
```

**Errors:**

- `draw_date_not_reached` (BR-005)
- `no_tickets_sold` (BR-005, BR-007)
- `already_drawn` (BR-005)
- `forbidden` si no admin

**Side effects:**

- Atomic UPDATE: `UPDATE raffles SET ... WHERE id=? AND status='open' RETURNING *`
- `revalidatePath('/admin', '/r/{publicSlug}')`

---

### `archiveRaffle(input)`

**Input:** `{ raffleId: string; reason?: string }`
**Output:** `{ ok: true, data: { archivedAt: string } }`
**Side effects:** persists `AdminAction(action_type='archive_raffle', details={ reason })`. Aplica a rifas en `open` o `drawn`.

---

## Seller domain

### `createSeller(input)`

**Input:** `{ name: string }` (3-80 chars)
**Output:** `{ ok: true, data: { sellerId: string; accessToken: string; url: string } }`
**Side effects:** INSERT Seller con `nanoid(32)` token.

> **Important:** `accessToken` se retorna **solo en esta response** y al rotar. NUNCA en lecturas posteriores (admin solo ve los últimos 4 chars en la tabla, con botón "copiar URL" que reabre flow específico).

---

### `rotateSellerToken(input)`

**Input:** `{ sellerId: string }`
**Output:** `{ ok: true, data: { newAccessToken: string; newUrl: string } }`
**Side effects:**

- UPDATE Seller con nuevo `accessToken = nanoid(32)`
- INSERT AdminAction(action_type='rotate_seller_token', details={ oldTokenHash: sha256(oldToken) })
- **Old token immediately invalid** (lookup by accessToken returns 0 rows)

---

### `archiveSeller(input)`

**Input:** `{ sellerId: string; reason?: string }`
**Output:** `{ ok: true, data: { archivedAt: string } }`
**Side effects:** UPDATE seller `archivedAt`, persists `AdminAction`.

---

## Sale domain (CRITICAL — BR-001, BR-002)

### `registerBuyer(input)`

**Wrapper:** `withSellerToken({ schema })`
**Used by:** US-009

**Input:**

```ts
{
  sellerToken: string;  // de la URL, validado por middleware
  buyer: {
    name?: string;       // todos opcionales (BR-008)
    phone?: string;
    email?: string;      // si presente, validar email format
  };
}
```

**Output:** `{ ok: true, data: { buyerId: string } }`

**Errors:** `validation_failed` (email format), `unauthorized` (token inválido)

**Side effects:** INSERT Buyer (idempotente — sin uniqueness check; un mismo "Juan" puede aparecer 2 veces porque es identificado por id)

---

### `claimTicket(input)` ⚠️ CONCURRENCY-CRITICAL

**Wrapper:** `withSellerToken({ schema })`
**Used by:** US-010, US-012

**Input:**

```ts
{
  sellerToken: string;
  ticketId: string;
  buyerId: string;
}
```

**Output:**

```ts
{
  ok: true,
  data: {
    ticket: { id, number, soldAt, raffleId };
    ticketDigitalUrl: string;  // → FT-010
  }
}
```

**Errors:**

- `ticket_already_sold` (HTTP 409) — el flow más importante de toda la app
- `raffle_immutable` si la rifa fue archivada/sorteada mid-flow
- `unauthorized` si token inválido

**Server logic (BR-002 strict):**

```ts
export const claimTicket = (input: unknown) =>
  withSellerToken({ schema: ClaimTicketSchema }, input, async (data, sellerId) => {
    // 1) Verify raffle is still open
    const raffle = await db.query.raffles.findFirst({
      where: (r, { eq, and, isNull }) =>
        and(eq(r.id, ticketRaffleId), eq(r.status, 'open'), isNull(r.archivedAt)),
    });
    if (!raffle) return fail('raffle_immutable');

    // 2) ATOMIC UPDATE (BR-002)
    const claimed = await db
      .update(tickets)
      .set({
        status: 'sold',
        buyerId: data.buyerId,
        sellerId,
        soldAt: new Date(),
      })
      .where(and(eq(tickets.id, data.ticketId), eq(tickets.status, 'available')))
      .returning();

    if (claimed.length === 0) return fail('ticket_already_sold');

    revalidatePath(`/r/${raffle.publicSlug}`);
    return ok({
      ticket: claimed[0],
      ticketDigitalUrl: `/v/${sellerToken}/ticket/${claimed[0].id}`,
    });
  });
```

**Anti-patterns prohibidos:**

```ts
// ❌ PROHIBIDO — race condition garantizada
const ticket = await db.query.tickets.findFirst({ where: eq(id, ticketId) });
if (ticket.status === 'sold') return fail('already_sold');
await db.update(tickets).set({ status: 'sold' });

// ❌ PROHIBIDO — SELECT FOR UPDATE sin TX no funciona en Neon HTTP
const ticket = await db.execute(sql`SELECT * FROM tickets WHERE id=${id} FOR UPDATE`);
```

---

### `revertSale(input)`

**Wrapper:** `withAuth({ resource: 'tickets', action: 'revert' })`
**Used by:** US-020, US-021

**Input:** `{ ticketId: string; reason?: string }`

**Output:** `{ ok: true, data: { ticket: Ticket } }`

**Errors:**

- `forbidden` si caller no es admin (US-021)
- `raffle_immutable` si rifa drawn (BR-010)

**Side effects:**

- UPDATE ticket → `status='available'`, NULL buyer/seller/soldAt
- INSERT AdminAction con `prev_buyer_id`, `prev_seller_id`
- `revalidatePath('/admin', '/r/{slug}')`

---

## Public query endpoints (read-only, no server actions — RSC)

Estas son páginas RSC (`async function Page`), no server actions. Listadas por completitud del contrato cliente↔server.

### `GET /r/{publicSlug}` (RSC page)

**Auth:** ninguna (público)
**Returns (props):**

```ts
{
  raffle: {
    name, status, drawDate, archivedAt,
    seedCommit, rngSeed: status === 'drawn' ? string : null,  // ← revealed only when drawn
    winnerTicketId: status === 'drawn' ? string : null,
  };
  prize: { text, imageUrl };
  tickets: Array<{
    id, number, status,
    buyerInitials: status === 'sold' ? string : null,  // BR-009
    // ⚠️ NO buyer.name, NO buyer.phone, NO buyer.email
  }>;
  winnerBuyer: status === 'drawn' ? { name: string } : null; // exception BR-009 — full name
}
```

**Errors:** 404 si slug no existe.

---

### `GET /r/{publicSlug}/verify` (RSC page)

**Auth:** ninguna
**Returns:**

```ts
{
  raffle: { seedCommit, rngSeed, drawnAt };  // ambos visibles
  verificationGuide: { algorithm: 'SHA-256', sample: { seed, expectedHash } };
}
```

Cliente ejecuta `verifyDraw(seedCommit, rngSeed)` via Web Crypto y muestra ✅/❌.

---

### `GET /v/{accessToken}` (RSC page)

**Auth:** middleware valida token → seller activo
**Returns:**

```ts
{
  seller: {
    (id, name);
  }
  activeRaffles: Array<RaffleSummary>;
  selectedRaffle: {
    (id, name, drawDate, ticketsByStatus);
  }
}
```

**Errors:** 404 si token inválido o seller archivado (NO filtrar info entre ambos casos).

---

### `GET /v/{accessToken}/ticket/{ticketId}` (RSC page — ticket digital)

**Returns:**

```ts
{
  ticket: {
    number;
  }
  raffle: {
    (name, drawDate, publicSlug);
  }
  prize: {
    (text, imageUrl);
  }
  seller: {
    name;
  }
  buyer: {
    name | null;
  } // full name OK aquí (es para el comprador propio)
  shareUrl: string; // deeplink to /r/{publicSlug}
}
```

UI invoca `navigator.share()` con este payload.

---

## Image upload (Vercel Blob)

### `uploadPrizeImage(file)`

**Not a server action per se** — uses Vercel Blob's `put()` from server context durante `createRaffle` / `editRaffle`.

**Flow:**

1. Form action en client recibe File
2. Server action valida (MIME + size, ver `CreateRaffleSchema`)
3. Server invoca `put(filename, fileBuffer, { access: 'public' })` de `@vercel/blob`
4. URL retornada se persiste en `Prize.imageUrl`

**Sanitización:**

- Filename derivado server-side: `prizes/{raffleId}-{nanoid(8)}.{ext}` (no nombre original del user)
- MIME enforcement strict (jpeg/png/webp solo)
- Size cap 5MB (validación Zod)

---

## Rate limiting

**MVP:** Sin rate limiting custom. Confiamos en Vercel Edge defaults.

**Post-MVP (si abuso):** `@vercel/edge-config` o `upstash/ratelimit` por IP en routes públicas (`/r/*`).

---

## Versioning

**MVP:** sin versioning explícito. Server actions son internal (no public API).

Si en el futuro se expone API público (mobile app nativa, integraciones), versionar con `/api/v1/*` namespace.

---

## Contract testing

Cada server action documentada acá debe tener:

1. **Unit test** del wrapper (mockear DB):
   - Happy path
   - Cada error code documentado
2. **Integration test** con DB real (test container o Neon branch):
   - Side effects validados (rows persistidas)
   - `revalidatePath` invocado
3. **E2E test** (Playwright) para el flow user-facing principal

Ver `11_TEST_STRATEGY.md` para coverage matrix.

---

## Summary table

| Action              | Wrapper         | Domain | Critical     | BR enforced            |
| ------------------- | --------------- | ------ | ------------ | ---------------------- |
| `createRaffle`      | withAuth        | Raffle | Medium       | BR-006 (seed_commit)   |
| `editRaffle`        | withAuth        | Raffle | Low          | BR-010                 |
| `executeDraw`       | withAuth        | Raffle | **CRITICAL** | BR-004, BR-005, BR-006 |
| `archiveRaffle`     | withAuth        | Raffle | Low          | BR-014, BR-015         |
| `createSeller`      | withAuth        | Seller | Low          | —                      |
| `rotateSellerToken` | withAuth        | Seller | Medium       | BR-012                 |
| `archiveSeller`     | withAuth        | Seller | Low          | BR-013                 |
| `registerBuyer`     | withSellerToken | Sale   | Low          | BR-008                 |
| `claimTicket`       | withSellerToken | Sale   | **CRITICAL** | BR-001, BR-002, BR-010 |
| `revertSale`        | withAuth        | Sale   | High         | BR-010, BR-011         |

---

_08 API Contracts — Rifatela — 10 server actions documented + RSC page contracts + error envelope_
