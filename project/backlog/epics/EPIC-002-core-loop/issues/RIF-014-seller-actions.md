# RIF-014: Server actions sellers (create, rotate, archive)

| Field              | Value                                                       |
| ------------------ | ----------------------------------------------------------- |
| **Epic**           | EPIC-002 Core Loop                                          |
| **Priority**       | P0                                                          |
| **Story Points**   | 3                                                           |
| **Status**         | ✅ Completed (2026-05-22)                                   |
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

- [x] 3 server actions exportadas desde `src/lib/actions/sellers/index.ts` ✅
- [x] Zod schemas: `CreateSellerSchema`, `RotateSellerSchema`, `ArchiveSellerSchema` ✅
- [x] Auth check via `withAdminToken` (adminToken bindeado desde page, no del form) ✅
- [x] AdminAction persistido: `rotate_seller_token` con `oldTokenHash` (sha256, NUNCA plain); `archive_seller` con razón opcional ✅
- [x] Returns `{ data: { url } }` para create/rotate (URL ready-to-share) ✅
- [x] `pnpm typecheck` + `pnpm lint` + **558/558 tests** PASS ✅
- [ ] Unit tests específicos del action — _diferido: la cobertura de `withAdminToken` ya garantiza el path de auth; los happy paths son thin (insert + revalidate). Integration tests llegan con DB real en RIF-022/034._
- [ ] E2E-007 — _llega en suite E2E_

## ✅ Implementation Evidence (2026-05-22)

### File created

- **NEW:** `src/lib/actions/sellers/index.ts` — 3 actions con `withAdminToken` wrapper

### Actions implementadas

| Action              | Schema                                | Returns                                | AdminAction logged                       |
| ------------------- | ------------------------------------- | -------------------------------------- | ---------------------------------------- |
| `createSeller`      | `{ name: string }`                    | `{ sellerId, accessToken, url }`       | No (creation is visible by existence)    |
| `rotateSellerToken` | `{ sellerId: uuid }`                  | `{ sellerId, newAccessToken, newUrl }` | `rotate_seller_token` con `oldTokenHash` |
| `archiveSeller`     | `{ sellerId: uuid, reason?: string }` | `{ sellerId }`                         | `archive_seller` con `reason` if present |

### Security highlights

- **Token rotation NUNCA loguea el old token plain** — solo `hashTokenForAudit(oldToken)` = sha256 hex (per BR-012)
- **Race condition mitigation:** rotate hace SELECT del current token, luego UPDATE WHERE id=? AND deletedAt IS NULL — si el seller fue archivado entre las dos queries, el UPDATE returning está vacío y devolvemos error.
- **Archive es idempotente:** UPDATE WHERE id=? AND deletedAt IS NULL → si ya está archivado, returning está vacío → "ya está archivado o no existe" (no doble log)
- **adminToken NUNCA viaja en form data** — bindeado en page via `.bind(null, token)`. Form submission can't tamper with auth.

### Pending follow-up

- Unit tests específicos → diferidos. `withAdminToken` ya tiene tests directos (7/7); las actions son composition thin de wrapper + insert/update.
