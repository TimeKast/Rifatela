import { describe, it, expect, vi } from 'vitest';
import { bulkInsertTicketsForRaffle } from './bulk-tickets';
import type { Database } from '@/lib/db/drizzle';

/**
 * Build a minimal mock DB that returns chainable insert/values. The helper
 * only uses `db.insert(table).values(rows)`, so we don't need a full Drizzle
 * mock — just the two methods.
 */
function mockDb() {
  const values = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn().mockReturnValue({ values });
  const db = { insert } as unknown as Database;
  return { db, insert, values };
}

describe('bulkInsertTicketsForRaffle', () => {
  it('inserts 1 ticket with number=1 and status=available', async () => {
    const { db, insert, values } = mockDb();
    await bulkInsertTicketsForRaffle(db, 'raffle-id', 1);
    expect(insert).toHaveBeenCalledOnce();
    expect(values).toHaveBeenCalledWith([
      { raffleId: 'raffle-id', number: 1, status: 'available' },
    ]);
  });

  it('inserts 100 tickets with consecutive numbers 1..100', async () => {
    const { db, insert, values } = mockDb();
    await bulkInsertTicketsForRaffle(db, 'raffle-id', 100);
    expect(insert).toHaveBeenCalledOnce();
    const rows = values.mock.calls[0]?.[0] as Array<{
      raffleId: string;
      number: number;
      status: 'available';
    }>;
    expect(rows).toHaveLength(100);
    expect(rows[0]).toEqual({
      raffleId: 'raffle-id',
      number: 1,
      status: 'available',
    });
    expect(rows[99]).toEqual({
      raffleId: 'raffle-id',
      number: 100,
      status: 'available',
    });
    // Verify all rows have consecutive numbers (no gaps, no duplicates)
    const numbers = rows.map((r) => r.number);
    expect(numbers).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
  });

  it('inserts 10000 tickets at the upper bound', async () => {
    const { db, values } = mockDb();
    await bulkInsertTicketsForRaffle(db, 'raffle-id', 10_000);
    const rows = values.mock.calls[0]?.[0] as unknown[];
    expect(rows).toHaveLength(10_000);
  });

  it('throws RangeError when maxTickets is 0 and does NOT touch the DB', async () => {
    const { db, insert } = mockDb();
    await expect(bulkInsertTicketsForRaffle(db, 'r', 0)).rejects.toBeInstanceOf(RangeError);
    expect(insert).not.toHaveBeenCalled();
  });

  it('throws RangeError when maxTickets is 10001 (above upper bound)', async () => {
    const { db, insert } = mockDb();
    await expect(bulkInsertTicketsForRaffle(db, 'r', 10_001)).rejects.toBeInstanceOf(RangeError);
    expect(insert).not.toHaveBeenCalled();
  });

  it('throws RangeError when maxTickets is negative', async () => {
    const { db, insert } = mockDb();
    await expect(bulkInsertTicketsForRaffle(db, 'r', -5)).rejects.toBeInstanceOf(RangeError);
    expect(insert).not.toHaveBeenCalled();
  });

  it('throws RangeError when maxTickets is a float (non-integer)', async () => {
    const { db, insert } = mockDb();
    await expect(bulkInsertTicketsForRaffle(db, 'r', 50.5)).rejects.toBeInstanceOf(RangeError);
    expect(insert).not.toHaveBeenCalled();
  });
});
