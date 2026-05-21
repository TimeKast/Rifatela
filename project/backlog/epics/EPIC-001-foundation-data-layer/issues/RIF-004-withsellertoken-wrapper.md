# RIF-004: `withSellerToken` server action wrapper

| Field              | Value                                     |
| ------------------ | ----------------------------------------- |
| **Epic**           | EPIC-001 Foundation & Data Layer          |
| **Priority**       | P0                                        |
| **Story Points**   | 3                                         |
| **Status**         | To Do                                     |
| **Dependencies**   | RIF-001                                   |
| **User Stories**   | (preparatory para US-007..US-010)         |
| **Business Rules** | BR-013 (vendedor archivado → token muere) |
| **Agents**         | `backend-specialist`                      |
| **Skills**         | `sk-actions-helpers`                      |
| **ADR**            | ADR-003 (URL-secret auth)                 |

## Problem

El starter kit ya provee `withAuth()` (RBAC admin) y `withSelf()` (self-service). Para vendedores necesitamos un tercer wrapper que valide el `access_token` de seller y resuelva el `seller_id` automáticamente.

Per `SK.md §2.3` — evitar reescribir auth + validation + revalidatePath en cada action de vendedor.

## Acceptance Criteria

```gherkin
Given una server action que usa withSellerToken
When recibe un input con sellerToken válido (matching un Seller con archived_at=NULL)
Then ejecuta el callback con (data, sellerId, raffleContext)
And revalidatePath se invoca con la path configurada

Given el sellerToken es inválido (no matchea ningún seller)
When la action se invoca
Then retorna { ok: false, code: 'unauthorized' } sin ejecutar el callback

Given el sellerToken matchea un Seller pero archived_at != NULL (BR-013)
When la action se invoca
Then retorna { ok: false, code: 'unauthorized' } (mismo error que token inválido — no filtra info)

Given el input falla la validation Zod
When la action se invoca
Then retorna { ok: false, code: 'validation_failed', field, message } sin tocar la DB
```

## Implementation notes

```ts
// src/lib/actions/helpers.ts (extiende lo que ya hay del kit)
export function withSellerToken<TInput, TOutput>(
  config: {
    schema: ZodSchema<TInput>;
    revalidate?: string;
  },
  input: unknown,
  callback: (data: TInput, sellerId: string) => Promise<TOutput>
): Promise<ActionResult<TOutput>> {
  // 1. Parse input con schema (incluyendo sellerToken: string)
  // 2. db.query.sellers.findFirst(where eq(token) and isNull(archived_at))
  // 3. Si no encuentra → { ok: false, code: 'unauthorized' }
  // 4. Ejecutar callback(data, seller.id)
  // 5. revalidatePath si configurado
  // 6. Return { ok: true, data: result }
}
```

- Pattern matches `withAuth` / `withSelf` del kit — consistency es la prioridad
- 404 ambiguous (no diferencia archived vs invalid) per security note del doc 07 §3.4
- Schema debe incluir `sellerToken: z.string().length(32)` para validate longitud nanoid

## Done when

- [ ] Helper exportado desde `src/lib/actions/helpers.ts`
- [ ] Unit test: token válido → callback ejecuta
- [ ] Unit test: token inválido → unauthorized
- [ ] Unit test: token de vendedor archivado → unauthorized (mismo response)
- [ ] Unit test: validation failure → validation_failed sin tocar DB
- [ ] `pnpm verify` pasa
