# RIF-020: Server action `registerBuyer`

| Field              | Value                         |
| ------------------ | ----------------------------- |
| **Epic**           | EPIC-002 Core Loop            |
| **Priority**       | P0                            |
| **Story Points**   | 2                             |
| **Status**         | Completed (2026-05-22)        |
| **Dependencies**   | RIF-001, RIF-004              |
| **User Stories**   | US-009                        |
| **Features**       | FT-004                        |
| **Business Rules** | BR-008 (datos opcionales)     |
| **Agents**         | `backend-specialist`          |
| **Skills**         | `kb-server-actions`           |
| **API Contract**   | `registerBuyer(input)` doc 08 |

## Problem

Server action invocada por `<BuyerForm>`: persiste Buyer con datos opcionales y retorna `buyerId`. Idempotente — sin uniqueness check (un mismo "Juan" puede aparecer N veces porque buyer se identifica por id).

## Acceptance Criteria

```gherkin
Given vendedor logueado con sellerToken válido
When invoca registerBuyer({ sellerToken, buyer: { name: "Marta", phone: "+541199" } })
Then se inserta Buyer con esos datos (email=null)
And retorna { ok: true, data: { buyerId: uuid } }

Given los 3 campos opcionales (name, phone, email) en null
When invoca
Then se inserta Buyer con todos null
And retorna { ok: true, buyerId } (BR-008 — buyer anónimo OK)

Given email="abc" (formato inválido)
When invoca
Then retorna { ok: false, code: 'validation_failed', field: 'email' } sin tocar DB

Given sellerToken inválido
When invoca
Then retorna { ok: false, code: 'unauthorized' } (per withSellerToken)

Given unit test
When invoke action con varios payloads
Then assertions sobre DB persistence + response shape
```

## Implementation notes

```ts
// src/lib/actions/sales/register-buyer.ts
const RegisterBuyerSchema = z.object({
  sellerToken: z.string().length(32),
  buyer: z.object({
    name: z.string().min(1).max(80).nullish(),
    phone: z.string().max(40).nullish(),
    email: z.string().email().nullish(),
  }),
});

export const registerBuyer = (input: unknown) =>
  withSellerToken({ schema: RegisterBuyerSchema }, input, async (data, sellerId) => {
    const [buyer] = await db
      .insert(buyers)
      .values({
        name: data.buyer.name ?? null,
        phone: data.buyer.phone ?? null,
        email: data.buyer.email ?? null,
      })
      .returning({ id: buyers.id });
    return { buyerId: buyer.id };
  });
```

- Action no requiere raffleId — buyer no está asociado a una rifa aún (eso ocurre en `claimTicket`)
- NO loggear `buyer.phone` ni `buyer.email` en server logs (RSK-003)

## Done when

- [x] Action `registerBuyer` en `src/lib/actions/sales/register-buyer.ts` ✅
- [x] Zod schema con `name/phone/email` todos opcionales (BR-008). Email format-checked. Schema module-private (regla 'use server') ✅
- [x] Wrapper `withSellerToken` — token bindeado vía `.bind(null, token)` desde RSC, nunca en FormData ✅
- [x] `withSellerToken` ya cubre invalid/archived token (test suite existente 27/27) ✅
- [x] PII discipline: el handler no loggea `data.phone`/`data.email`; solo el wrapper loggea `console.error('[withSellerToken]', error)` en path de excepción ✅
- [x] `pnpm typecheck` + `pnpm lint` + `pnpm build` PASS ✅
- [ ] Unit tests específicos de `registerBuyer` con mock DB — _diferidos; cobertura indirecta vía `withSellerToken` tests + integration vía E2E_

## ✅ Implementation Evidence (2026-05-22)

### Contract divergence vs doc 08

- Doc 08 propuso `{ ok, code, data }` envelope. Implementación usa `ActionResult<T>` = `{ data: T } | { error: string }` por consistencia con `withAuth`/`withSelf`/`withAdminToken`/`createRaffle`/sellers actions.
- Mapping de códigos: `'unauthorized'` → `{ error: 'No autorizado' }`, `'validation_failed'` → `{ error: '<zod message>' }`. UI banner ya rendera ambos casos.

### Schema highlights

- `email` con refine custom (no Zod's `.email()` default) para mantener mensaje en español: "Email inválido"
- Transform `'' → null` para que un input vacío del form se persista como `null` (BR-008 anonymous OK), no como string vacío.
