'use server';

/**
 * Server Action Helpers
 *
 * Reusable wrappers that eliminate boilerplate in server actions:
 * - `withAuth()` — For admin actions (auth + permissions + validation)
 * - `withSelf()` — For self-service actions (auth + validation, no permissions)
 *
 * @example
 * // Admin action with permissions
 * export const createUser = (input: unknown) =>
 *   withAuth(
 *     { resource: 'users', action: 'create', schema: createUserSchema, revalidate: '/settings/users' },
 *     input,
 *     async (data, userId) => {
 *       await db.insert(users).values({ ...data, createdBy: userId });
 *     }
 *   );
 *
 * @example
 * // Self-service action (no permissions check)
 * export const updateProfile = (formData: FormData) =>
 *   withSelf(
 *     { schema: profileSchema, revalidate: '/profile' },
 *     formData,
 *     async (data, userId) => {
 *       await db.update(users).set(data).where(eq(users.id, userId));
 *     }
 *   );
 *
 * @see SK-001
 */

import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { requirePermission, type Resource, type Action } from '@/lib/auth/permissions';
import { ActionError, type ActionResult } from '@/lib/actions/types';
import { db } from '@/lib/db/drizzle';
import { sellers } from '@/lib/db/schema';
import type { ZodSchema } from 'zod';

// =============================================================================
// Options
// =============================================================================

/** Options for withAuth — requires resource/action for permission check */
interface WithAuthOptions<TInput> {
  /** RBAC resource (e.g. 'users', 'posts') */
  resource: Resource;
  /** RBAC action (e.g. 'create', 'update', 'delete') */
  action: Action;
  /** Zod schema to validate input */
  schema: ZodSchema<TInput>;
  /** Path to revalidate after successful mutation */
  revalidate?: string;
}

/** Options for withSelf — no permissions, just auth */
interface WithSelfOptions<TInput> {
  /** Zod schema to validate input */
  schema: ZodSchema<TInput>;
  /** Path to revalidate after successful mutation */
  revalidate?: string;
}

/** Options for withSelf when no input validation is needed */
interface WithSelfNoSchemaOptions {
  /** Path to revalidate after successful mutation */
  revalidate?: string;
}

/**
 * Options for withSellerToken.
 *
 * The schema MUST include a `sellerToken: z.string()` field (length 32 by
 * convention since seller tokens are `nanoid(32)` per ADR-003). The wrapper
 * extracts it from the parsed input to look up the calling seller, then
 * strips it before invoking the handler.
 */
interface WithSellerTokenOptions<TInput extends { sellerToken: string }> {
  /** Zod schema to validate input — must contain `sellerToken: z.string()` */
  schema: ZodSchema<TInput>;
  /** Path to revalidate after successful mutation */
  revalidate?: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Parse input that may be FormData or a plain object.
 *
 * @param schema - Zod schema to validate against
 * @param input - Raw input (FormData or object)
 * @returns Parsed data or error string
 */
function parseInput<TInput>(
  schema: ZodSchema<TInput>,
  input: unknown
): { data: TInput } | { error: string } {
  const raw = input instanceof FormData ? Object.fromEntries(input) : input;
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { error: firstError?.message || 'Datos inválidos' };
  }

  return { data: parsed.data };
}

/**
 * Server action wrapper with auth + permissions + schema validation.
 *
 * Use for actions that require RBAC permission checks (admin CRUD operations).
 *
 * @param options - Resource, action, schema, and optional revalidate path
 * @param input - Raw input (FormData or plain object)
 * @param handler - Business logic function receiving parsed data and userId
 * @returns ActionResult with data or error
 */
export async function withAuth<TInput, TOutput = void>(
  options: WithAuthOptions<TInput>,
  input: unknown,
  handler: (parsed: TInput, userId: string) => Promise<TOutput>
): Promise<ActionResult<TOutput>> {
  // 1. Auth check
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Debes iniciar sesión' };
  }

  // 2. Permission check
  try {
    requirePermission(session.user.role, options.resource, options.action);
  } catch {
    // requirePermission() throws on denial — return user-friendly message (intentional)
    return { error: `No tienes permiso para ${options.action} en ${options.resource}` };
  }

  // 3. Schema validation
  const parsed = parseInput(options.schema, input);
  if ('error' in parsed) {
    return { error: parsed.error };
  }

  // 4. Execute handler
  try {
    const result = await handler(parsed.data, session.user.id);

    // 5. Revalidate cache
    if (options.revalidate) {
      revalidatePath(options.revalidate);
    }

    return { data: result };
  } catch (error) {
    if (error instanceof ActionError) {
      return { error: error.message };
    }
    console.error(`[withAuth:${options.resource}:${options.action}]`, error);
    return { error: 'Ocurrió un error. Intenta de nuevo.' };
  }
}

/**
 * Server action wrapper with auth only (no permissions).
 *
 * Use for self-service actions where the user modifies their own data
 * (profile, password, settings).
 *
 * @param options - Schema and optional revalidate path
 * @param input - Raw input (FormData or plain object)
 * @param handler - Business logic function receiving parsed data and userId
 * @returns ActionResult with data or error
 */
export async function withSelf<TInput, TOutput = void>(
  options: WithSelfOptions<TInput>,
  input: unknown,
  handler: (parsed: TInput, userId: string) => Promise<TOutput>
): Promise<ActionResult<TOutput>>;

/**
 * Server action wrapper with auth only, no input validation.
 *
 * Use for actions that only need authentication but have no user input
 * (e.g. send reset email, get current user).
 *
 * @param options - Optional revalidate path
 * @param handler - Business logic function receiving userId
 * @returns ActionResult with data or error
 */
export async function withSelf<TOutput = void>(
  options: WithSelfNoSchemaOptions,
  handler: (userId: string, email: string) => Promise<TOutput>
): Promise<ActionResult<TOutput>>;

// Implementation
export async function withSelf<TInput, TOutput = void>(
  options: WithSelfOptions<TInput> | WithSelfNoSchemaOptions,
  inputOrHandler: unknown,
  maybeHandler?: (parsed: TInput, userId: string) => Promise<TOutput>
): Promise<ActionResult<TOutput>> {
  // 1. Auth check
  const session = await auth();
  if (!session?.user?.id) {
    return { error: 'Debes iniciar sesión' };
  }

  const hasSchema = 'schema' in options && options.schema != null;

  try {
    let result: TOutput;

    if (hasSchema && maybeHandler) {
      // Overload 1: withSelf(options, input, handler)
      const parsed = parseInput((options as WithSelfOptions<TInput>).schema, inputOrHandler);
      if ('error' in parsed) {
        return { error: parsed.error };
      }
      result = await maybeHandler(parsed.data, session.user.id);
    } else {
      // Overload 2: withSelf(options, handler) — no schema
      const handler = inputOrHandler as (userId: string, email: string) => Promise<TOutput>;
      result = await handler(session.user.id, session.user.email ?? '');
    }

    // Revalidate cache
    if (options.revalidate) {
      revalidatePath(options.revalidate);
    }

    return { data: result };
  } catch (error) {
    if (error instanceof ActionError) {
      return { error: error.message };
    }
    console.error('[withSelf]', error);
    return { error: 'Ocurrió un error. Intenta de nuevo.' };
  }
}

/**
 * Server action wrapper for seller flows (URL-secret auth per ADR-003).
 *
 * Reads `sellerToken` from the parsed input, resolves it against the
 * `sellers` table (filtering archived rows via `deletedAt IS NULL`), and
 * executes the handler with the resolved `sellerId`. The token is stripped
 * from the data object handed to the handler — handlers receive a clean
 * payload of business fields only.
 *
 * Returns an ambiguous `{ error: 'No autorizado' }` for BOTH
 *   - token doesn't match any seller, AND
 *   - token matches an archived seller (BR-013)
 * by design — leaking archive status would help attackers enumerate sellers.
 *
 * Note on return shape: aligned with `withAuth` / `withSelf` (`ActionResult`
 * discriminated union with `data`/`error`). The original spec in doc 08
 * proposed a `{ ok, code, ... }` envelope, but consistency with the kit
 * wins — callers can map errors however they need at the UI layer.
 *
 * @example
 * const ClaimTicketSchema = z.object({
 *   sellerToken: z.string().length(32),
 *   ticketId: z.string().uuid(),
 *   buyerId: z.string().uuid(),
 * });
 *
 * export const claimTicket = (input: unknown) =>
 *   withSellerToken(
 *     { schema: ClaimTicketSchema, revalidate: '/v' },
 *     input,
 *     async ({ ticketId, buyerId }, sellerId) => {
 *       // sellerToken already stripped — only business fields here
 *     }
 *   );
 *
 * @see project/planning/05_BUSINESS_RULES.md (BR-012 rotation, BR-013 archive)
 * @see project/planning/07_ARCHITECTURE.md (ADR-003 URL-secret auth)
 */
export async function withSellerToken<TInput extends { sellerToken: string }, TOutput = void>(
  options: WithSellerTokenOptions<TInput>,
  input: unknown,
  handler: (parsed: Omit<TInput, 'sellerToken'>, sellerId: string) => Promise<TOutput>
): Promise<ActionResult<TOutput>> {
  // 1. Schema validation (Zod parse). The schema must include `sellerToken`.
  const parsed = parseInput(options.schema, input);
  if ('error' in parsed) {
    return { error: parsed.error };
  }

  // 2. Resolve active seller by access_token. Archived sellers (deletedAt
  //    non-null) are filtered out — they return the same ambiguous error
  //    as invalid tokens (BR-013).
  const { sellerToken, ...businessData } = parsed.data;
  const seller = await db.query.sellers.findFirst({
    where: and(eq(sellers.accessToken, sellerToken), isNull(sellers.deletedAt)),
    columns: { id: true },
  });
  if (!seller) {
    return { error: 'No autorizado' };
  }

  // 3. Execute handler with sellerToken stripped.
  try {
    const result = await handler(businessData as Omit<TInput, 'sellerToken'>, seller.id);

    if (options.revalidate) {
      revalidatePath(options.revalidate);
    }

    return { data: result };
  } catch (error) {
    if (error instanceof ActionError) {
      return { error: error.message };
    }
    console.error('[withSellerToken]', error);
    return { error: 'Ocurrió un error. Intenta de nuevo.' };
  }
}
