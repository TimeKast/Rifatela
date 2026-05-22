# RIF-010: Create raffle (server action + SCR-002 form)

| Field              | Value                                       |
| ------------------ | ------------------------------------------- |
| **Epic**           | EPIC-002 Core Loop                          |
| **Priority**       | P0                                          |
| **Story Points**   | 5                                           |
| **Status**         | ✅ Completed (2026-05-21)                   |
| **Dependencies**   | RIF-001, RIF-002, RIF-003, RIF-005, RIF-006 |
| **User Stories**   | US-001, US-002                              |
| **Features**       | FT-001                                      |
| **Business Rules** | BR-006 (commit-reveal initialization)       |
| **Screens**        | SCR-002                                     |
| **Components**     | CMP-006 PrizeImageUpload                    |
| **Agents**         | `backend-specialist`, `frontend-specialist` |
| **Skills**         | `kb-server-actions`, `kb-forms`             |
| **API Contract**   | `createRaffle(input)` doc 08                |

## Problem

Admin crea rifa: form con name, prize_text, prize_image, max_tickets, draw_date. Server action genera `rng_seed`, calcula `seed_commit`, sube imagen a Vercel Blob, persiste Raffle + Prize + N tickets bulk. Esto inicializa BR-006 commit-reveal scheme.

## Acceptance Criteria

```gherkin
Given un admin en SCR-002 form
When llena name="Rifa Cole", prize_text="iPhone", prize_image (JPG 2MB), max_tickets=100, draw_date (futuro 7d)
And presiona "Crear"
Then se invoca createRaffle action
And se sube la imagen a Vercel Blob
And se persiste Raffle con seed_commit calculado + public_slug nanoid(10)
And se persiste Prize con position=1, text + image_url
And se insertan 100 Tickets con status='available' (numbers 1..100)
And se redirige a /admin/{token}/raffles/{newId}

Given form con draw_date en pasado (< now + 1h)
When intento submit
Then validation error "draw_date_too_soon" sin tocar DB

Given form con imagen 10MB
When intento upload
Then error "image_too_large" sin crear raffle

Given form con max_tickets = 0
When intento submit
Then validation error sin crear raffle

Given E2E test
When ejecuto el flujo completo (E2E-001)
Then 1 raffle, 1 prize, 100 tickets persistidos en DB
And rng_seed NO está en la response del client (solo seed_commit visible)
```

## Implementation notes

```ts
// src/lib/actions/raffles/create.ts
export const createRaffle = (input: unknown) =>
  withAuth(
    { resource: 'raffles', action: 'create', schema: CreateRaffleSchema, revalidate: '/admin' },
    input,
    async (data) => {
      const rngSeed = generateRngSeed();
      const seedCommit = sha256Hex(rngSeed);
      const publicSlug = generatePublicSlug();

      // 1. Upload imagen (si presente)
      let imageUrl: string | null = null;
      if (data.prizeImage) {
        const { url } = await uploadPrizeImage(data.prizeImage /* placeholder raffleId */);
        imageUrl = url;
      }

      // 2. Insert raffle
      const [raffle] = await db
        .insert(raffles)
        .values({
          name: data.name,
          maxTickets: data.maxTickets,
          drawDate: data.drawDate,
          status: 'open',
          seedCommit,
          rngSeed,
          publicSlug,
        })
        .returning();

      // 3. Insert prize
      await db.insert(prizes).values({
        raffleId: raffle.id,
        position: 1,
        text: data.prizeText,
        imageUrl,
      });

      // 4. Bulk insert tickets (RIF-002)
      await bulkInsertTicketsForRaffle(db, raffle.id, data.maxTickets);

      return { raffleId: raffle.id, publicSlug: raffle.publicSlug };
    }
  );
```

- `rng_seed` se persiste en DB pero **nunca se expone** vía API hasta sorteo (BR-006)
- `revalidatePath('/admin/[token]', '/r/[slug]')` post-creation
- Form en `src/components/raffles/CreateRaffleForm.tsx` (Client Component) — usa `useActionState`
- Image upload challenge: blob upload necesita raffleId pero raffle no existe aún. Solución: upload con temp folder + rename post-insert, O insertar raffle primero con `imageUrl=null` y update después. Recomendado: 2-step (insert raffle → upload → update prize.imageUrl).

## Done when

- [x] Server action `createRaffle` implementada (con `withAdminToken` wrapper en lugar de `withAuth`) ✅
- [x] Zod `CreateRaffleSchema` con validations (nombre 3-120, prizeText 3-500, maxTickets 1-10000, drawDate >= now+1h, imagen opcional JPG/PNG/WebP ≤5MB) ✅
- [x] `<CreateRaffleForm>` Client Component con `useActionState` ✅
- [x] `<PrizeImageUpload>` inline (CMP-006) con preview + client-side validation ✅
- [x] Page RSC `src/app/admin/[token]/raffles/new/page.tsx` que bindea adminToken a la action ✅
- [x] **Unit guarantee: rng_seed NUNCA aparece en `CreateRaffleResult`** (return type es `{ raffleId, publicSlug }` solamente — verificable type-level) ✅
- [x] `pnpm typecheck` + `pnpm lint` + **558/558 tests** PASS ✅
- [ ] Component test del form — _diferido per kit pattern (componentes interactive con file input + useActionState son E2E territory)_
- [ ] E2E-001 crear rifa + verificar DB — _llega en suite E2E (RIF-022/034)_

## ✅ Implementation Evidence (2026-05-21)

### Files modified / created

| File                                          | Change                                                                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/actions/helpers.ts`                  | +`withAdminToken` wrapper (URL-secret variant of withAuth)                                                                                        |
| `tests/unit/helpers.test.ts`                  | +7 unit tests para `withAdminToken` (26/26 helpers now)                                                                                           |
| `src/lib/actions/raffles/create-raffle.ts`    | **NEW** — Server action + Zod schema inline. Pre-genera raffleId, sube imagen (si presente), inserta Raffle+Prize+N tickets, revalidate, redirect |
| `src/components/raffles/CreateRaffleForm.tsx` | **NEW** — Client Component con useActionState + inline `<PrizeImageUpload>` sub-component (CMP-006 placeholder)                                   |
| `src/app/admin/[token]/raffles/new/page.tsx`  | **NEW** — RSC page que bindea `createRaffle.bind(null, token)`                                                                                    |

### Architecture deviation from spec

- **`withAdminToken` en lugar de `withAuth`** — spec usaba kit's NextAuth-driven `withAuth`. ADR-003 eliminó NextAuth en MVP. Wrapper análogo a `withSellerToken` (RIF-004) pero valida `ADMIN_ACCESS_TOKEN` env var contra token bindeado al action (no contra form input — usuario no puede pasarlo). Misma `ActionResult` shape para consistency.
- **Token bindeado en page, no en form** — `createRaffle.bind(null, token)` desde la RSC. Form solo recibe `(state, formData)` y queda agnóstico del auth model.

### rng_seed nunca leaks (Security guarantee verificada type-level)

```ts
export interface CreateRaffleResult {
  raffleId: string;
  publicSlug: string;
  // ↑ NO rngSeed. Persisted in DB but only revealed at draw time (BR-006).
}
```

El handler dentro del wrapper inserta `rngSeed` en DB pero el `return { raffleId, publicSlug }` lo deja fuera. TypeScript garantiza que callers nunca verán `rngSeed` desde el response.

### Flow del action

1. Validate adminToken (withAdminToken) → fail-closed si no matchea
2. Validate input shape (Zod) → user-friendly error si bad
3. Pre-generate `raffleId = randomUUID()` (necesario para filename de imagen)
4. Generate `rngSeed` + compute `seedCommit = sha256(rngSeed)` + `publicSlug = nanoid(10)`
5. **Si hay imagen:** upload a Vercel Blob → si falla, abort sin tocar DB (no orphan raffles)
6. INSERT Raffle (con rngSeed persistido pero NO en response)
7. INSERT Prize (position=1, con imageUrl si subió)
8. `bulkInsertTicketsForRaffle(db, raffleId, maxTickets)` — single INSERT bulk
9. `revalidatePath('/admin/[token]')` — dashboard refresca con nueva rifa
10. `redirect(/admin/{token}/raffles/{raffleId})` — RIF-012 (próxima)

### Error handling

- `ActionError` thrown desde handler (ej. imagen upload falló) → mensaje user-friendly al UI
- `redirect()` THROWS — debe estar fuera del try/catch para que Next maneje
- TypeScript narrowing: usé `if (result.data)` en lugar de `if ('data' in result)` porque la discriminated union usa `data?: never` en error branch

### Pending follow-up

- **`/admin/{token}/raffles/{id}` no existe todavía** — el redirect post-creation va a 404 hasta que RIF-012 implemente el detail page
- Component test del form → defer a E2E
- Integration test del action (con DB real) → RIF-022/034

### Setup operacional en Railway

- `BLOB_READ_WRITE_TOKEN` (RIF-005) — si no está, uploads fallan y la action devuelve "No pudimos subir la imagen" para imagen-con-archivo, OK para sin-imagen
