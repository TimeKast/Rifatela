/**
 * Test Entity Builders (RIF-008)
 *
 * Pure factory functions that return plain objects matching the shape of
 * each Rifatela entity. Used by:
 *   - Unit tests (mocking)
 *   - Component tests (rendering with deterministic data)
 *   - Integration / E2E tests (via `await db.insert(...).values(aRaffle(...))`)
 *
 * Conventions:
 *   - All builders accept `Partial<T>` overrides as their only argument.
 *   - Defaults model the "happy path" (open raffle, active seller, etc.).
 *   - Random fields (UUIDs, slugs, seeds) are regenerated per call so two
 *     calls without overrides produce two distinct rows.
 *   - Builders return ROWS (Drizzle `$inferSelect` shape), not insert
 *     payloads. Audit fields (`createdAt`, etc.) are populated. Insert-
 *     compatible because Drizzle accepts a superset on `.values()`.
 *
 * @see project/planning/11_TEST_STRATEGY.md §6
 * @see project/planning/06_DATA_MODEL.md (E-001 through E-006)
 */

import { randomUUID, randomBytes, createHash } from 'node:crypto';

import type { Raffle, Prize, Seller, Buyer, Ticket, AdminAction } from '@/lib/db/schema';

// =============================================================================
// Local helpers — duplicated from src/lib/crypto/seed.ts to keep fixtures
// runnable from any test environment (jsdom + node) without coupling to the
// server-only module.
// =============================================================================

function localSeed(): string {
  return randomBytes(32).toString('hex');
}

function localSha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function localNanoid(length: number): string {
  // URL-safe alphabet identical to nanoid's. Cryptographic randomness via
  // randomBytes; biased modulo accepted because fixtures don't need
  // production-grade uniform distribution.
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

// =============================================================================
// Builders — one per entity
// =============================================================================

/**
 * Build a Raffle row. Defaults: open status, 100 tickets, draw in 7 days,
 * fresh `seedCommit`, no `rngSeed` revealed (pre-draw).
 */
export function aRaffle(overrides?: Partial<Raffle>): Raffle {
  const now = new Date();
  const rngSeed = localSeed();
  const base: Raffle = {
    id: randomUUID(),
    name: 'Rifa Test',
    maxTickets: 100,
    drawDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    status: 'open',
    winnerTicketId: null,
    rngSeed: null, // not revealed until draw
    seedCommit: localSha256Hex(rngSeed),
    drawnAt: null,
    publicSlug: localNanoid(10),
    deletedAt: null,
    deletedBy: null,
    createdAt: now,
    createdBy: null,
    modifiedAt: now,
    modifiedBy: null,
  };
  return { ...base, ...overrides };
}

/**
 * Build a Prize row. Defaults: position 1, generic text prize, no image.
 */
export function aPrize(overrides?: Partial<Prize>): Prize {
  const now = new Date();
  const base: Prize = {
    id: randomUUID(),
    raffleId: randomUUID(),
    position: 1,
    text: 'Premio Test',
    imageUrl: null,
    createdAt: now,
    createdBy: null,
    modifiedAt: now,
    modifiedBy: null,
  };
  return { ...base, ...overrides };
}

/**
 * Build a Seller row. Defaults: active (not archived), 32-char access token.
 */
export function aSeller(overrides?: Partial<Seller>): Seller {
  const now = new Date();
  const base: Seller = {
    id: randomUUID(),
    name: 'Diego',
    accessToken: localNanoid(32),
    deletedAt: null,
    deletedBy: null,
    createdAt: now,
    createdBy: null,
    modifiedAt: now,
    modifiedBy: null,
  };
  return { ...base, ...overrides };
}

/**
 * Build a Buyer row. Defaults: anonymous (all contact fields null). Override
 * with `aBuyer({ name: 'Marta' })` for a named buyer.
 */
export function aBuyer(overrides?: Partial<Buyer>): Buyer {
  const now = new Date();
  const base: Buyer = {
    id: randomUUID(),
    name: null,
    phone: null,
    email: null,
    createdAt: now,
    createdBy: null,
    modifiedAt: now,
    modifiedBy: null,
  };
  return { ...base, ...overrides };
}

/**
 * Build a Ticket row. Defaults: status 'available', number 1, no buyer/seller.
 * Override with `aTicket({ status: 'sold', buyerId, sellerId, soldAt: new Date() })`
 * for a sold ticket — all three sale fields should be set together.
 */
export function aTicket(overrides?: Partial<Ticket>): Ticket {
  const now = new Date();
  const base: Ticket = {
    id: randomUUID(),
    raffleId: randomUUID(),
    number: 1,
    status: 'available',
    buyerId: null,
    sellerId: null,
    soldAt: null,
    createdAt: now,
    createdBy: null,
    modifiedAt: now,
    modifiedBy: null,
  };
  return { ...base, ...overrides };
}

/**
 * Build an AdminAction row. Defaults: revert_sale type with empty details
 * jsonb. Override `actionType` and `details` per scenario.
 */
export function anAdminAction(overrides?: Partial<AdminAction>): AdminAction {
  const base: AdminAction = {
    id: randomUUID(),
    actionType: 'revert_sale',
    raffleId: null,
    ticketId: null,
    sellerId: null,
    details: {},
    createdAt: new Date(),
  };
  return { ...base, ...overrides };
}

// =============================================================================
// Composed helpers — common scenarios
// =============================================================================

/**
 * Build a list of N sold tickets for a raffle, distributed across the given
 * sellers (round-robin). Each ticket gets a fresh buyer.
 *
 * Useful for setting up draw scenarios:
 *   const raffle = aRaffle({ maxTickets: 10 });
 *   const sellers = [aSeller(), aSeller()];
 *   const { tickets, buyers } = soldTicketsFor({ raffle, sellers, count: 5 });
 */
export function soldTicketsFor({
  raffle,
  sellers,
  count,
}: {
  raffle: Raffle;
  sellers: Seller[];
  count: number;
}): { tickets: Ticket[]; buyers: Buyer[] } {
  if (sellers.length === 0) {
    throw new Error('soldTicketsFor: need at least 1 seller');
  }
  if (count > raffle.maxTickets) {
    throw new Error(
      `soldTicketsFor: count (${count}) cannot exceed raffle.maxTickets (${raffle.maxTickets})`
    );
  }

  const buyers: Buyer[] = [];
  const tickets: Ticket[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const buyer = aBuyer({ name: `Buyer ${i + 1}` });
    const seller = sellers[i % sellers.length]!;
    buyers.push(buyer);
    tickets.push(
      aTicket({
        raffleId: raffle.id,
        number: i + 1,
        status: 'sold',
        buyerId: buyer.id,
        sellerId: seller.id,
        soldAt: now,
      })
    );
  }

  return { tickets, buyers };
}

// =============================================================================
// Database reset (integration / E2E)
// =============================================================================

/**
 * Truncate all Rifatela tables in dependency-safe order. Use in `beforeEach`
 * of integration / E2E tests against a real Postgres (or test branch) to
 * guarantee data isolation between tests.
 *
 * Order matters: foreign-key children before parents. Cascades from the
 * schema cover most paths, but explicit deletion makes intent clear and
 * doesn't depend on cascade semantics across providers.
 *
 * Type kept loose (`DrizzleLike`) so this works against any Drizzle DB
 * instance — including the production `db` and Neon-branch test DBs.
 *
 * @example
 * ```ts
 * import { db } from '@/lib/db/drizzle';
 * import { resetDb } from '@/tests/fixtures/builders';
 *
 * beforeEach(async () => { await resetDb(db); });
 * ```
 */
type DeletableDb = {
  delete: (table: unknown) => { execute?: () => Promise<unknown> } & PromiseLike<unknown>;
};

export async function resetDb(database: DeletableDb): Promise<void> {
  const { adminActions, tickets, buyers, prizes, raffles, sellers } =
    await import('@/lib/db/schema');
  // FK-safe order: children → parents
  await database.delete(adminActions);
  await database.delete(tickets);
  await database.delete(buyers);
  await database.delete(prizes);
  await database.delete(raffles);
  await database.delete(sellers);
}
