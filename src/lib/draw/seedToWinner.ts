/**
 * seedToWinner — RIF-027 ⭐ CRITICAL (BR-004, BR-005)
 *
 * Pure function that derives the winning ticket from a raffle's secret
 * `rngSeed` plus the ORDERED list of sold ticket IDs. This is the heart
 * of the commit-reveal scheme — `seed_commit = sha256(rngSeed)` is
 * published from `status='open'`, and at draw time the seed is revealed
 * so anyone can re-run this function and confirm the winner is not
 * tampered with (RSK-005 mitigation).
 *
 * Algorithm:
 *   1. sha256(rngSeed) → 32 bytes
 *   2. First 8 bytes → uint64 → bigint
 *   3. winnerIndex = bigint mod soldTicketIds.length
 *   4. winnerTicketId = soldTicketIds[winnerIndex]
 *
 * Modulo-bias for any realistic N (≤ 10⁴) is negligible (≤ 2⁻⁵⁵).
 *
 * **Ordering contract:** caller MUST pass `soldTicketIds` ordered by
 * `tickets.number ASC` (the natural ticket order). Determinism + replay
 * verifiability both depend on it. The function does NOT sort — it
 * trusts the caller — because the same caller (server at draw time and
 * future client replay) must agree on the order, and a defensive sort
 * here could mask a caller-side ordering bug.
 *
 * **Runtime:** today this uses `node:crypto` so it's server-only. When
 * RIF-031 (`<DrawWheel>` client replay) lands, this will be refactored
 * to `crypto.subtle.digest` (async, available in both Node ≥18 and
 * the browser). The signature change to `Promise<…>` is acceptable then.
 *
 * @see project/planning/05_BUSINESS_RULES.md (BR-004, BR-005)
 * @see project/planning/07_ARCHITECTURE.md (ADR-002 Replay + Commit-Reveal)
 * @see project/planning/13_RISK_REGISTER.md (RSK-005 replay tampering)
 */

import { createHash } from 'node:crypto';

export interface SeedToWinnerResult {
  winnerIndex: number;
  winnerTicketId: string;
}

export function seedToWinner(
  rngSeed: string,
  soldTicketIds: readonly string[]
): SeedToWinnerResult {
  if (soldTicketIds.length === 0) {
    throw new Error('no_tickets_sold');
  }

  // sha256(rngSeed) — utf-8 encoding to match `sha256Hex` in seed.ts so
  // that a future verifier hashing the revealed seed gets the same digest.
  const hash = createHash('sha256').update(rngSeed, 'utf8').digest();

  // First 8 bytes as a big-endian uint64. Read as a hex string then
  // convert to BigInt — portable across runtimes.
  const hexPrefix = hash.subarray(0, 8).toString('hex');
  const value = BigInt('0x' + hexPrefix);

  const winnerIndex = Number(value % BigInt(soldTicketIds.length));
  // Safe non-null assertion: winnerIndex is in [0, length), length >= 1.
  const winnerTicketId = soldTicketIds[winnerIndex]!;

  return { winnerIndex, winnerTicketId };
}
