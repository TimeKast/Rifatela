# RIF-010: Create raffle (server action + SCR-002 form)

| Field              | Value                                       |
| ------------------ | ------------------------------------------- |
| **Epic**           | EPIC-002 Core Loop                          |
| **Priority**       | P0                                          |
| **Story Points**   | 5                                           |
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

- [ ] Server action `createRaffle` implementada per contract doc 08
- [ ] Zod schema `CreateRaffleSchema` con validations
- [ ] `<CreateRaffleForm>` component con `useActionState`
- [ ] `<PrizeImageUpload>` (CMP-006) integrado
- [ ] Component test del form (validations, submit happy path)
- [ ] E2E (parte de E2E-001) crear rifa + verificar DB
- [ ] Unit test: rng_seed NUNCA aparece en response del client
- [ ] `pnpm verify` pasa
