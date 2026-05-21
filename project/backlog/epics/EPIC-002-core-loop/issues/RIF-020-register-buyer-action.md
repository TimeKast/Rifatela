# RIF-020: Server action `registerBuyer`

| Field              | Value                         |
| ------------------ | ----------------------------- |
| **Epic**           | EPIC-002 Core Loop            |
| **Priority**       | P0                            |
| **Story Points**   | 2                             |
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

- [ ] Action implementada per contract doc 08
- [ ] Unit tests: valid inputs + invalid email + invalid token
- [ ] PII smoke: assert que server logs no contengan phone/email
- [ ] `pnpm verify` pasa
