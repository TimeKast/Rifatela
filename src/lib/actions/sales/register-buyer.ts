'use server';

/**
 * registerBuyer — RIF-020
 *
 * Persists a Buyer with all-optional contact fields (BR-008). Returns the
 * fresh `buyerId` so the seller UI can carry it into the next `claimTicket`
 * call. No uniqueness check: identical "Juan" buyers are allowed because
 * buyers are identified by id, not contact.
 *
 * PII discipline (RSK-003): phone/email NEVER appear in server logs — we
 * only log the actionable failure shape, not the parsed payload.
 *
 * @see project/planning/05_BUSINESS_RULES.md (BR-008)
 * @see project/planning/08_API_CONTRACTS.md (registerBuyer)
 * @see project/backlog/epics/EPIC-002-core-loop/issues/RIF-020-register-buyer-action.md
 */

import { z } from 'zod';

import { withSellerToken } from '@/lib/actions/helpers';
import { db } from '@/lib/db/drizzle';
import { buyers } from '@/lib/db/schema';

// Module-private (Next.js 'use server' restriction — only async exports).
const RegisterBuyerSchema = z.object({
  name: z
    .string()
    .trim()
    .max(80, 'El nombre es demasiado largo')
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  phone: z
    .string()
    .trim()
    .max(40, 'El teléfono es demasiado largo')
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  email: z
    .string()
    .trim()
    .max(160, 'El email es demasiado largo')
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: 'Email inválido',
    }),
});

export interface RegisterBuyerResult {
  buyerId: string;
}

/**
 * Server action. Bind seller token in the RSC page:
 *   `registerBuyer.bind(null, token)`
 */
export async function registerBuyer(sellerToken: string, _prevState: unknown, formData: FormData) {
  return withSellerToken<z.infer<typeof RegisterBuyerSchema>, RegisterBuyerResult>(
    { schema: RegisterBuyerSchema },
    sellerToken,
    formData,
    async (data) => {
      const [buyer] = await db
        .insert(buyers)
        .values({ name: data.name, phone: data.phone, email: data.email })
        .returning({ id: buyers.id });

      // Drizzle returning() is non-empty for a successful insert — guard for TS.
      if (!buyer) {
        throw new Error('No pudimos registrar el comprador. Intenta de nuevo.');
      }

      return { buyerId: buyer.id };
    }
  );
}
