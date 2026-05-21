# RIF-014: Server actions sellers (create, rotate, archive)

| Field              | Value                                                       |
| ------------------ | ----------------------------------------------------------- |
| **Epic**           | EPIC-002 Core Loop                                          |
| **Priority**       | P0                                                          |
| **Story Points**   | 3                                                           |
| **Dependencies**   | RIF-001, RIF-003                                            |
| **User Stories**   | US-004, US-005, US-006                                      |
| **Features**       | FT-002                                                      |
| **Business Rules** | BR-012 (rotation), BR-013 (archive preserves history)       |
| **Agents**         | `backend-specialist`                                        |
| **Skills**         | `kb-server-actions`                                         |
| **API Contracts**  | `createSeller`, `rotateSellerToken`, `archiveSeller` doc 08 |

## Problem

3 server actions admin-only:

- `createSeller(name)` → nuevo Seller con `nanoid(32)` token
- `rotateSellerToken(sellerId)` → nuevo token, invalida el anterior, log a AdminAction
- `archiveSeller(sellerId, reason?)` → soft-delete via `archived_at`, log a AdminAction

## Acceptance Criteria

```gherkin
Given admin en SCR-005
When invoke createSeller({ name: "Diego" })
Then se inserta Seller con name="Diego", access_token=nanoid(32), archived_at=NULL
And retorna { sellerId, accessToken, url: '{origin}/v/{accessToken}' }
And revalidatePath('/admin/sellers')

Given seller "Diego" existente con accessToken="abc123"
When invoke rotateSellerToken({ sellerId })
Then se update Seller con nuevo accessToken (diferente al anterior)
And se insert AdminAction(action_type='rotate_seller_token', sellerId, details={ oldTokenHash: sha256Hex('abc123') })
And la URL vieja /v/abc123 retorna 404 (E2E verifica)
And la URL nueva funciona
And retorna { newAccessToken, newUrl }

Given seller archivado o no admin
When intento rotateSellerToken
Then 403 forbidden (no admin) o 404 (seller no encontrado activo)

Given seller "Diego" activo con 24 ventas
When invoke archiveSeller({ sellerId, reason: "ya no participa" })
Then se setea archived_at
And se insert AdminAction(action_type='archive_seller', details={reason})
And tickets con seller_id="diego_id" se preservan intactos (no se modifican)
And URL /v/{dieoToken} retorna 404 (E2E)
```

## Implementation notes

- Todas con `withAuth({ resource: 'sellers', action })` per starter kit pattern
- `AdminAction` insert dentro de cada action — atomicidad single-statement (no transactions necesarias)
- Old token NUNCA en plain en logs ni AdminAction — solo `sha256Hex(oldToken)` (per BR-012)

## Done when

- [ ] 3 server actions exportadas
- [ ] Zod schemas para cada input
- [ ] Unit tests: happy paths + auth check + admin actions persisted
- [ ] E2E-007 (rotación) cubre createSeller + rotateSellerToken
- [ ] `pnpm verify` pasa
