/**
 * Crypto Primitives for Rifatela (server-only)
 *
 * Shared helpers used by server actions to:
 *   - Generate the per-raffle RNG seed for the commit-reveal scheme (BR-006).
 *   - Compute SHA-256 hashes (commit publication, audit-log token hashing).
 *   - Mint URL-secret tokens (seller access tokens) and public slugs.
 *
 * These primitives are SERVER-ONLY by virtue of importing `node:crypto`,
 * which Next.js refuses to bundle for the client (the build fails if you
 * try to import this module from a Client Component). Client-side
 * verification of commit-reveal uses the Web Crypto API instead (RIF-028).
 *
 * @see project/planning/05_BUSINESS_RULES.md (BR-006 commit-reveal, BR-012 token rotation)
 * @see project/planning/07_ARCHITECTURE.md (ADR-002, ADR-003)
 * @see project/backlog/epics/EPIC-001-foundation-data-layer/issues/RIF-003-crypto-helpers.md
 */

import { randomBytes, createHash } from 'node:crypto';
import { nanoid } from 'nanoid';

/**
 * Generate a 256-bit (32-byte) hex string suitable as a raffle RNG seed.
 *
 * The hex output is 64 characters. Stored in `raffles.rng_seed` and kept
 * CONFIDENTIAL until draw time (BR-006). At draw time it is revealed in
 * the API response and persisted publicly so visitors can verify
 * `sha256(rngSeed) === seedCommit`.
 */
export function generateRngSeed(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Compute the lowercase hex SHA-256 digest of a UTF-8 input string.
 *
 * Pure (deterministic): same input always yields the same output. Output is
 * always 64 characters. Used for:
 *   - `seedCommit = sha256Hex(rngSeed)` published from `status='open'`
 *   - `oldTokenHash` in `AdminAction.details` after token rotation (BR-012)
 */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Generate a 32-character URL-safe access token (≈191 bits of entropy).
 *
 * Used as the secret in seller URLs (`/v/{accessToken}`). Per ADR-003 this
 * IS the auth credential in MVP. Treat as a password: never log, never
 * expose in API responses (other than the initial create/rotate handoff).
 */
export const generateAccessToken = (): string => nanoid(32);

/**
 * Generate a 10-character URL-safe public slug (≈58 bits of entropy).
 *
 * Public by design — appears in shareable raffle URLs (`/r/{publicSlug}`).
 * Not a secret; collision-safe for the kit's max scale (10⁴ raffles).
 */
export const generatePublicSlug = (): string => nanoid(10);

/**
 * Hash a token for audit-log retention (BR-012).
 *
 * When rotating a seller token we persist `sha256Hex(oldToken)` to the
 * `AdminAction.details` jsonb — never the plain old token. Re-exports
 * `sha256Hex` to make intent explicit at call sites.
 */
export const hashTokenForAudit = sha256Hex;
