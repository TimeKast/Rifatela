/**
 * seedToWinner — RIF-027 unit tests
 *
 * The function is the heart of the commit-reveal scheme. Bugs here mean
 * the published `seed_commit` doesn't actually pin a unique winner →
 * trust broken (RSK-005). Tests assert:
 *
 *   - determinism: same input → same output (always)
 *   - edge cases: 0 → throws, 1 → that one wins
 *   - distribution: many random seeds spread across many indices
 *   - cross-validation: hand-computed hash agrees with implementation
 */

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { seedToWinner } from '@/lib/draw/seedToWinner';

const TICKET = (n: number) => `t-${n.toString().padStart(4, '0')}`;
const tickets = (n: number) => Array.from({ length: n }, (_, i) => TICKET(i + 1));

describe('seedToWinner', () => {
  describe('determinism', () => {
    it('returns the same result on repeated calls with same input', () => {
      const seed = 'deadbeef'.repeat(8);
      const ids = tickets(50);
      const first = seedToWinner(seed, ids);
      for (let i = 0; i < 100; i++) {
        const next = seedToWinner(seed, ids);
        expect(next).toEqual(first);
      }
    });

    it('matches hand-computed sha256 modulo length', () => {
      const seed = 'deadbeef'.repeat(8);
      const ids = tickets(10);

      const hash = createHash('sha256').update(seed, 'utf8').digest();
      const value = BigInt('0x' + hash.subarray(0, 8).toString('hex'));
      const expectedIndex = Number(value % BigInt(ids.length));

      const result = seedToWinner(seed, ids);
      expect(result.winnerIndex).toBe(expectedIndex);
      expect(result.winnerTicketId).toBe(ids[expectedIndex]);
    });
  });

  describe('edge cases', () => {
    it('throws on empty soldTicketIds', () => {
      expect(() => seedToWinner('anyseed', [])).toThrow('no_tickets_sold');
    });

    it('returns the single ticket when N=1', () => {
      const ids = tickets(1);
      expect(seedToWinner('seed-a', ids)).toEqual({
        winnerIndex: 0,
        winnerTicketId: ids[0],
      });
      expect(seedToWinner('any-other-seed', ids)).toEqual({
        winnerIndex: 0,
        winnerTicketId: ids[0],
      });
    });

    it('produces winnerIndex within [0, length)', () => {
      const ids = tickets(7);
      for (let i = 0; i < 50; i++) {
        const seed = `seed-${i}-${'x'.repeat(20)}`;
        const r = seedToWinner(seed, ids);
        expect(r.winnerIndex).toBeGreaterThanOrEqual(0);
        expect(r.winnerIndex).toBeLessThan(ids.length);
        expect(r.winnerTicketId).toBe(ids[r.winnerIndex]);
      }
    });
  });

  describe('distribution', () => {
    it('spreads across most buckets over 200 random seeds (N=10)', () => {
      const ids = tickets(10);
      const buckets = new Set<number>();
      for (let i = 0; i < 200; i++) {
        const seed = createHash('sha256').update(`probe-${i}`).digest('hex');
        buckets.add(seedToWinner(seed, ids).winnerIndex);
      }
      // With 200 trials over 10 buckets, hitting <8 distinct buckets
      // would suggest a non-uniform distribution.
      expect(buckets.size).toBeGreaterThanOrEqual(8);
    });

    it('different seeds usually produce different winners', () => {
      const ids = tickets(100);
      const seedA = 'a'.repeat(64);
      const seedB = 'b'.repeat(64);
      // Probabilistically these collide ~1% of the time over N=100.
      // Hard-coded seeds make this deterministic — verify they differ.
      expect(seedToWinner(seedA, ids).winnerIndex).not.toBe(seedToWinner(seedB, ids).winnerIndex);
    });
  });
});
