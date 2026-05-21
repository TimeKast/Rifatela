/**
 * Smoke tests for fixture builders (RIF-008).
 *
 * Verifies each builder:
 *   1. Returns an object with all required fields populated.
 *   2. Applies overrides (last-write-wins on individual properties).
 *   3. Produces distinct rows across calls (no shared state).
 */

import { describe, it, expect, vi } from 'vitest';

import {
  aRaffle,
  aPrize,
  aSeller,
  aBuyer,
  aTicket,
  anAdminAction,
  soldTicketsFor,
  resetDb,
} from './builders';

describe('aRaffle', () => {
  it('returns a Raffle row with happy-path defaults', () => {
    const r = aRaffle();
    expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.name).toBe('Rifa Test');
    expect(r.maxTickets).toBe(100);
    expect(r.status).toBe('open');
    expect(r.drawDate).toBeInstanceOf(Date);
    expect(r.drawDate.getTime()).toBeGreaterThan(Date.now());
    expect(r.seedCommit).toMatch(/^[0-9a-f]{64}$/);
    expect(r.rngSeed).toBeNull();
    expect(r.winnerTicketId).toBeNull();
    expect(r.drawnAt).toBeNull();
    expect(r.deletedAt).toBeNull();
    expect(r.publicSlug).toMatch(/^[A-Za-z0-9_-]{10}$/);
  });

  it('applies overrides on top of defaults', () => {
    const r = aRaffle({ name: 'Custom', status: 'drawn', maxTickets: 50 });
    expect(r.name).toBe('Custom');
    expect(r.status).toBe('drawn');
    expect(r.maxTickets).toBe(50);
  });

  it('generates a distinct id, seedCommit, and publicSlug per call', () => {
    const r1 = aRaffle();
    const r2 = aRaffle();
    expect(r1.id).not.toBe(r2.id);
    expect(r1.seedCommit).not.toBe(r2.seedCommit);
    expect(r1.publicSlug).not.toBe(r2.publicSlug);
  });
});

describe('aPrize', () => {
  it('returns a Prize row at position 1 with no image', () => {
    const p = aPrize();
    expect(p.position).toBe(1);
    expect(p.text).toBe('Premio Test');
    expect(p.imageUrl).toBeNull();
    expect(p.raffleId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('accepts raffleId override (typical use)', () => {
    const p = aPrize({ raffleId: 'fixed-raffle-id', position: 2 });
    expect(p.raffleId).toBe('fixed-raffle-id');
    expect(p.position).toBe(2);
  });
});

describe('aSeller', () => {
  it('returns an active Seller with 32-char access token', () => {
    const s = aSeller();
    expect(s.name).toBe('Diego');
    expect(s.accessToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(s.deletedAt).toBeNull();
  });

  it('can build an archived seller via override', () => {
    const archivedAt = new Date('2026-01-01');
    const s = aSeller({ deletedAt: archivedAt });
    expect(s.deletedAt).toEqual(archivedAt);
  });
});

describe('aBuyer', () => {
  it('defaults to anonymous (all contact fields null)', () => {
    const b = aBuyer();
    expect(b.name).toBeNull();
    expect(b.phone).toBeNull();
    expect(b.email).toBeNull();
  });

  it('accepts partial contact info', () => {
    const b = aBuyer({ name: 'Marta', phone: '+541199' });
    expect(b.name).toBe('Marta');
    expect(b.phone).toBe('+541199');
    expect(b.email).toBeNull();
  });
});

describe('aTicket', () => {
  it('defaults to available status with no sale fields', () => {
    const t = aTicket();
    expect(t.status).toBe('available');
    expect(t.buyerId).toBeNull();
    expect(t.sellerId).toBeNull();
    expect(t.soldAt).toBeNull();
    expect(t.number).toBe(1);
  });

  it('can build a sold ticket via override', () => {
    const now = new Date();
    const t = aTicket({
      status: 'sold',
      buyerId: 'b1',
      sellerId: 's1',
      soldAt: now,
      number: 47,
    });
    expect(t.status).toBe('sold');
    expect(t.buyerId).toBe('b1');
    expect(t.sellerId).toBe('s1');
    expect(t.soldAt).toEqual(now);
    expect(t.number).toBe(47);
  });
});

describe('anAdminAction', () => {
  it('defaults to revert_sale with empty details', () => {
    const a = anAdminAction();
    expect(a.actionType).toBe('revert_sale');
    expect(a.details).toEqual({});
    expect(a.raffleId).toBeNull();
  });

  it('supports each declared action type via override', () => {
    expect(anAdminAction({ actionType: 'rotate_seller_token' }).actionType).toBe(
      'rotate_seller_token'
    );
    expect(anAdminAction({ actionType: 'archive_raffle' }).actionType).toBe('archive_raffle');
    expect(anAdminAction({ actionType: 'archive_seller' }).actionType).toBe('archive_seller');
    expect(anAdminAction({ actionType: 'edit_raffle' }).actionType).toBe('edit_raffle');
  });
});

describe('soldTicketsFor', () => {
  it('produces N sold tickets distributed across sellers round-robin', () => {
    const raffle = aRaffle({ maxTickets: 10 });
    const sellers = [aSeller({ name: 'A' }), aSeller({ name: 'B' })];
    const { tickets, buyers } = soldTicketsFor({ raffle, sellers, count: 5 });

    expect(tickets).toHaveLength(5);
    expect(buyers).toHaveLength(5);
    // All tickets reference the raffle
    expect(tickets.every((t) => t.raffleId === raffle.id)).toBe(true);
    // All tickets are sold + have buyer/seller/soldAt
    expect(tickets.every((t) => t.status === 'sold')).toBe(true);
    expect(tickets.every((t) => t.buyerId !== null)).toBe(true);
    expect(tickets.every((t) => t.sellerId !== null)).toBe(true);
    expect(tickets.every((t) => t.soldAt !== null)).toBe(true);
    // Round-robin: tickets[0] -> seller A, tickets[1] -> seller B, tickets[2] -> A, ...
    expect(tickets[0]!.sellerId).toBe(sellers[0]!.id);
    expect(tickets[1]!.sellerId).toBe(sellers[1]!.id);
    expect(tickets[2]!.sellerId).toBe(sellers[0]!.id);
    // Numbers are consecutive starting at 1
    expect(tickets.map((t) => t.number)).toEqual([1, 2, 3, 4, 5]);
  });

  it('throws when count exceeds raffle.maxTickets', () => {
    const raffle = aRaffle({ maxTickets: 3 });
    const sellers = [aSeller()];
    expect(() => soldTicketsFor({ raffle, sellers, count: 10 })).toThrow(/maxTickets/);
  });

  it('throws when sellers array is empty', () => {
    const raffle = aRaffle();
    expect(() => soldTicketsFor({ raffle, sellers: [], count: 1 })).toThrow(/seller/);
  });
});

describe('resetDb', () => {
  it('calls delete on every Rifatela table in FK-safe order', async () => {
    const schema = await import('@/lib/db/schema');
    const deleteMock = vi.fn<(table: unknown) => Promise<undefined>>(() =>
      Promise.resolve(undefined)
    );
    const fakeDb = { delete: deleteMock };

    await resetDb(fakeDb as unknown as Parameters<typeof resetDb>[0]);

    // 6 tables deleted (one call per Rifatela entity)
    expect(deleteMock).toHaveBeenCalledTimes(6);
    // FK-safe order: children before parents. Compare arg identity to the
    // actual Drizzle table objects re-imported from schema.
    const calls = deleteMock.mock.calls.map((c) => c[0]);
    expect(calls).toEqual([
      schema.adminActions,
      schema.tickets,
      schema.buyers,
      schema.prizes,
      schema.raffles,
      schema.sellers,
    ]);
  });
});
