'use server';

/**
 * createRaffle Server Action — RIF-010
 *
 * Persists a new raffle with its primary prize and pre-generated ticket
 * set. Initializes the commit-reveal scheme (BR-006) by computing
 * `seedCommit = sha256(rngSeed)` server-side and storing both — `rngSeed`
 * stays confidential until draw time; `seedCommit` is public from open.
 *
 * Flow:
 *   1. Validate adminToken (URL-secret per ADR-003) via `withAdminToken`.
 *   2. Validate input shape with Zod.
 *   3. Pre-generate `raffleId` so the prize image filename can reference it.
 *   4. (Optional) upload prize image to Vercel Blob — failures abort the
 *      whole action before any DB writes, so we never persist a partial raffle.
 *   5. Insert Raffle, Prize, and bulk-insert N available tickets.
 *   6. Revalidate the admin dashboard so the new raffle appears.
 *   7. `redirect()` to the raffle detail page (RIF-012, upcoming).
 *
 * Security:
 *   - `rngSeed` is NEVER included in the action response. Only `raffleId`
 *     and `publicSlug` are returned. The seed lives in the DB and is
 *     revealed at draw time only (BR-006).
 *   - Caller passes `adminToken` via `.bind(null, token)` from the RSC
 *     page — not via form input — so users cannot supply their own token.
 *
 * @see project/planning/05_BUSINESS_RULES.md (BR-001, BR-006)
 * @see project/planning/08_API_CONTRACTS.md (createRaffle contract)
 * @see project/backlog/epics/EPIC-002-core-loop/issues/RIF-010-create-raffle-action-form.md
 */

import { randomUUID } from 'node:crypto';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { withAdminToken } from '@/lib/actions/helpers';
import { ActionError } from '@/lib/actions/types';
import { generatePublicSlug, generateRngSeed, sha256Hex } from '@/lib/crypto/seed';
import { db } from '@/lib/db/drizzle';
import { prizes, raffles } from '@/lib/db/schema';
import { bulkInsertTicketsForRaffle } from '@/lib/raffles/bulk-tickets';
import {
  MAX_PRIZE_IMAGE_BYTES,
  PrizeImageUploadError,
  uploadPrizeImage,
} from '@/lib/storage/prize-upload';

// Allowed MIME mirrored from src/lib/storage/prize-upload.ts. Duplicated as
// values (not type-only) so Zod can validate without importing a private set.
const ALLOWED_PRIZE_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * Input schema. Tolerant of form-data shapes — `maxTickets` arrives as a
 * string from `<input type="number">`, so we coerce.
 *
 * The optional `prizeImage` field accepts a File and validates MIME + size
 * up-front; the actual upload happens after the raffle id is generated.
 */
export const CreateRaffleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(120, 'El nombre es demasiado largo'),
  prizeText: z
    .string()
    .trim()
    .min(3, 'Describe el premio (al menos 3 caracteres)')
    .max(500, 'La descripción del premio es demasiado larga'),
  prizeImage: z
    .union([
      z
        .instanceof(File)
        .refine((f) => (ALLOWED_PRIZE_IMAGE_MIMES as readonly string[]).includes(f.type), {
          message: 'Formato no soportado. Usa JPG, PNG o WebP.',
        })
        .refine((f) => f.size <= MAX_PRIZE_IMAGE_BYTES, {
          message: 'La imagen es demasiado grande (máximo 5 MB).',
        }),
      // An empty file input arrives as a File with size 0 from FormData —
      // treat that as "no image" rather than a validation failure.
      z.instanceof(File).refine((f) => f.size === 0, { message: '' }),
      z.null(),
      z.undefined(),
    ])
    .optional()
    .transform((f) => (f && f instanceof File && f.size > 0 ? f : null)),
  maxTickets: z.coerce
    .number()
    .int('La cantidad debe ser un número entero')
    .min(1, 'Debe haber al menos 1 boleto')
    .max(10_000, 'Máximo 10.000 boletos por rifa'),
  drawDate: z.coerce
    .date()
    .refine(
      (d) => d.getTime() > Date.now() + 60 * 60 * 1000,
      'La fecha del sorteo debe ser al menos 1 hora en el futuro'
    ),
});

export type CreateRaffleInput = z.infer<typeof CreateRaffleSchema>;

export interface CreateRaffleResult {
  raffleId: string;
  publicSlug: string;
}

/**
 * Server action — bind the admin token in the RSC page:
 *
 *   <CreateRaffleForm action={createRaffle.bind(null, token)} />
 */
export async function createRaffle(adminToken: string, _prevState: unknown, formData: FormData) {
  const result = await withAdminToken<CreateRaffleInput, CreateRaffleResult>(
    { schema: CreateRaffleSchema, revalidate: '/admin/[token]' },
    adminToken,
    formData,
    async (data) => {
      // Pre-generate the id so prize image filename + DB row stay consistent.
      const raffleId = randomUUID();
      const rngSeed = generateRngSeed();
      const seedCommit = sha256Hex(rngSeed);
      const publicSlug = generatePublicSlug();

      // Upload BEFORE any DB write — if Vercel Blob fails we abort cleanly
      // (no orphaned raffle row).
      let imageUrl: string | null = null;
      if (data.prizeImage) {
        try {
          const uploaded = await uploadPrizeImage(data.prizeImage, raffleId);
          imageUrl = uploaded.url;
        } catch (err) {
          if (err instanceof PrizeImageUploadError) {
            // Surface a user-friendly message based on the upload error code.
            const message =
              err.code === 'invalid_image_type'
                ? 'Formato de imagen no soportado.'
                : err.code === 'image_too_large'
                  ? 'La imagen es demasiado grande (máximo 5 MB).'
                  : 'No pudimos subir la imagen. Intenta de nuevo.';
            throw new ActionError(message);
          }
          throw err;
        }
      }

      // Insert Raffle (rngSeed persisted but NOT returned to caller).
      await db.insert(raffles).values({
        id: raffleId,
        name: data.name,
        maxTickets: data.maxTickets,
        drawDate: data.drawDate,
        status: 'open',
        seedCommit,
        rngSeed,
        publicSlug,
      });

      // Insert Prize (position=1; multi-prize is post-MVP).
      await db.insert(prizes).values({
        raffleId,
        position: 1,
        text: data.prizeText,
        imageUrl,
      });

      // Bulk-create N available tickets (RIF-002 helper, single INSERT).
      await bulkInsertTicketsForRaffle(db, raffleId, data.maxTickets);

      // Response intentionally excludes rngSeed — never leaks pre-draw.
      return { raffleId, publicSlug };
    }
  );

  // On success, navigate to the raffle detail page. `redirect()` throws a
  // special signal Next.js handles — must NOT be inside a try/catch.
  // Use property check (not `'data' in`) because ActionResult declares
  // `data?: never` on the error branch, which keeps `'data' in result`
  // true on both branches.
  if (result.data) {
    redirect(`/admin/${adminToken}/raffles/${result.data.raffleId}`);
  }

  return result;
}
