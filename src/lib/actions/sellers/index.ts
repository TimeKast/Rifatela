'use server';

/**
 * Seller Server Actions — RIF-014
 *
 * Admin-only mutations over sellers:
 *
 *   - `createSeller(name)` → new Seller with `nanoid(32)` access_token
 *   - `rotateSellerToken(sellerId)` → fresh token, invalidates the previous one
 *   - `archiveSeller(sellerId, reason?)` → soft-delete via `deletedAt`,
 *     preserves historical ticket associations (BR-013)
 *
 * Each action:
 *   - Validates `adminToken` (URL-secret, bound from page via `.bind()`).
 *   - Validates input shape with Zod.
 *   - Persists the change.
 *   - Logs to `admin_actions` where applicable (rotate, archive).
 *   - Revalidates `/admin/[token]/sellers` so the page refreshes.
 *
 * Returns `ActionResult<...>` shape (data | error). Re-rendered as banner
 * or toast by the SellersManagement client component.
 *
 * @see project/planning/05_BUSINESS_RULES.md (BR-012 rotation, BR-013 archive)
 * @see project/planning/08_API_CONTRACTS.md (Seller actions)
 * @see project/backlog/epics/EPIC-002-core-loop/issues/RIF-014-seller-actions.md
 */

import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { withAdminToken } from '@/lib/actions/helpers';
import { ActionError } from '@/lib/actions/types';
import { generateAccessToken, hashTokenForAudit } from '@/lib/crypto/seed';
import { db } from '@/lib/db/drizzle';
import { adminActions, sellers } from '@/lib/db/schema';

// ─────────────────────────────────────────────────────────────────────────────
// createSeller
// ─────────────────────────────────────────────────────────────────────────────

// Zod schemas in this file are NOT exported — Next.js "use server" modules
// can only export async functions. Schemas stay module-private.
const CreateSellerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(80, 'El nombre es demasiado largo'),
});

export interface CreateSellerResult {
  sellerId: string;
  accessToken: string;
  /** Pre-built URL ready to share via WhatsApp. */
  url: string;
}

/**
 * Server action. Bind admin token in the RSC page:
 *   `createSeller.bind(null, token)`
 */
export async function createSeller(adminToken: string, _prevState: unknown, formData: FormData) {
  return withAdminToken<z.infer<typeof CreateSellerSchema>, CreateSellerResult>(
    { schema: CreateSellerSchema, revalidate: '/admin/[token]/sellers' },
    adminToken,
    formData,
    async (data) => {
      const accessToken = generateAccessToken();

      const [seller] = await db
        .insert(sellers)
        .values({ name: data.name, accessToken })
        .returning({ id: sellers.id });

      if (!seller) {
        throw new ActionError('No pudimos crear el vendedor. Intenta de nuevo.');
      }

      const origin = process.env.NEXT_PUBLIC_APP_URL ?? '';
      const url = origin ? `${origin}/v/${accessToken}` : `/v/${accessToken}`;

      return { sellerId: seller.id, accessToken, url };
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// rotateSellerToken
// ─────────────────────────────────────────────────────────────────────────────

const RotateSellerSchema = z.object({
  sellerId: z.string().uuid('ID de vendedor inválido'),
});

export interface RotateSellerResult {
  sellerId: string;
  newAccessToken: string;
  newUrl: string;
}

export async function rotateSellerToken(
  adminToken: string,
  _prevState: unknown,
  formData: FormData
) {
  return withAdminToken<z.infer<typeof RotateSellerSchema>, RotateSellerResult>(
    { schema: RotateSellerSchema, revalidate: '/admin/[token]/sellers' },
    adminToken,
    formData,
    async (data) => {
      // Read current row first so we can hash the old token for audit.
      // Restrict to active sellers — rotating an archived seller doesn't
      // make sense (their token is already invalidated).
      const [existing] = await db
        .select({ accessToken: sellers.accessToken })
        .from(sellers)
        .where(and(eq(sellers.id, data.sellerId), isNull(sellers.deletedAt)))
        .limit(1);

      if (!existing) {
        throw new ActionError('Vendedor no encontrado o ya archivado.');
      }

      const newAccessToken = generateAccessToken();

      // Atomic-ish update: WHERE clause re-checks active status to avoid
      // racing an archive operation that lands between SELECT and UPDATE.
      const updated = await db
        .update(sellers)
        .set({ accessToken: newAccessToken, modifiedAt: new Date() })
        .where(and(eq(sellers.id, data.sellerId), isNull(sellers.deletedAt)))
        .returning({ id: sellers.id });

      if (updated.length === 0) {
        throw new ActionError('El vendedor fue archivado durante la rotación.');
      }

      // Audit log — NEVER store the old token plain, only its sha256 hash.
      await db.insert(adminActions).values({
        actionType: 'rotate_seller_token',
        sellerId: data.sellerId,
        details: { oldTokenHash: hashTokenForAudit(existing.accessToken) },
      });

      const origin = process.env.NEXT_PUBLIC_APP_URL ?? '';
      const newUrl = origin ? `${origin}/v/${newAccessToken}` : `/v/${newAccessToken}`;

      return { sellerId: data.sellerId, newAccessToken, newUrl };
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// archiveSeller
// ─────────────────────────────────────────────────────────────────────────────

const ArchiveSellerSchema = z.object({
  sellerId: z.string().uuid('ID de vendedor inválido'),
  reason: z
    .string()
    .trim()
    .max(500, 'La razón es demasiado larga')
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

export interface ArchiveSellerResult {
  sellerId: string;
}

export async function archiveSeller(adminToken: string, _prevState: unknown, formData: FormData) {
  return withAdminToken<z.infer<typeof ArchiveSellerSchema>, ArchiveSellerResult>(
    { schema: ArchiveSellerSchema, revalidate: '/admin/[token]/sellers' },
    adminToken,
    formData,
    async (data) => {
      // Idempotent-ish: only update sellers that are still active.
      const updated = await db
        .update(sellers)
        .set({ deletedAt: new Date() })
        .where(and(eq(sellers.id, data.sellerId), isNull(sellers.deletedAt)))
        .returning({ id: sellers.id });

      if (updated.length === 0) {
        throw new ActionError('El vendedor ya está archivado o no existe.');
      }

      await db.insert(adminActions).values({
        actionType: 'archive_seller',
        sellerId: data.sellerId,
        details: data.reason ? { reason: data.reason } : {},
      });

      return { sellerId: data.sellerId };
    }
  );
}
