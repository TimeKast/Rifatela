# RIF-004: `withSellerToken` server action wrapper

| Field              | Value                                     |
| ------------------ | ----------------------------------------- |
| **Epic**           | EPIC-001 Foundation & Data Layer          |
| **Priority**       | P0                                        |
| **Story Points**   | 3                                         |
| **Status**         | ✅ Completed (2026-05-21)                 |
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

- [x] Helper exportado desde `src/lib/actions/helpers.ts` ✅
- [x] Unit test: token válido → callback ejecuta con sellerId ✅
- [x] Unit test: token inválido → `{ error: 'No autorizado' }` ✅
- [x] Unit test: token de vendedor archivado → mismo `{ error: 'No autorizado' }` (BR-013 ambiguity) ✅
- [x] Unit test: validation failure → error de Zod sin tocar DB ✅
- [x] Bonus: Unit test ActionError passthrough + Unit test generic error ✅
- [x] `pnpm typecheck` + `pnpm lint` + 19/19 tests PASS ✅

## ✅ Implementation Evidence (2026-05-21)

### Files modified

- **EDIT:** `src/lib/actions/helpers.ts` — agregado `withSellerToken` + tipo `WithSellerTokenOptions`. Imports nuevos: `and, eq, isNull` de drizzle-orm, `db` de drizzle, `sellers` de schema.
- **EDIT:** `tests/unit/helpers.test.ts` — agregado mock de `@/lib/db/drizzle` + bloque `describe('withSellerToken')` con 6 tests.

### Return shape: diverge de doc 08 spec, alinea con kit

- Doc 08 proponía `{ ok: false, code: 'unauthorized', ... }` envelope
- Adopto el `ActionResult<T>` del kit (`{ data: T }` | `{ error: string }`) — consistencia con `withAuth`/`withSelf`
- Tradeoff documentado en JSDoc del wrapper. Callers convierten `error: string` a UX errors según necesiten.

### Test results (todos los tests del archivo)

```
✓ withAuth (8 tests)
✓ withSelf (5 tests)
✓ withSellerToken (6 tests)
  ✓ executes handler with sellerId when token resolves to an active seller
  ✓ returns ambiguous "No autorizado" when token does not match any seller
  ✓ returns ambiguous "No autorizado" when seller is archived (BR-013)
  ✓ returns validation error and does NOT touch the DB when input is invalid
  ✓ returns ActionError message when handler throws ActionError
  ✓ returns generic message when handler throws unexpected error

Test Files  1 passed (1)  ·  Tests  19 passed (19)
```

### Sellertoken handling

- Schema-required field: `sellerToken: z.string()` (caller agrega `.length(32)` por convención nanoid)
- Wrapper **strips** `sellerToken` del payload antes de pasarlo al handler — handler recibe solo business fields + `sellerId`
- DB query filtra `archivedAt IS NULL` → ambigüedad intencional (BR-013)

### Pending follow-up (NOT blocking)

- Consumido por `registerBuyer` (RIF-020), `claimTicket` (RIF-021) — los primeros use cases
- Integration test contra DB real diferido a RIF-008 (test fixtures + builders)
