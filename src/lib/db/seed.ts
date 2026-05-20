// ⚠️ CRITICAL: Load env vars FIRST, before any other imports
// This must be at the very top so DATABASE_URL is available when drizzle.ts loads
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

/**
 * Database Seed Orchestrator
 *
 * Runs all seed functions in the correct order.
 * Run with: pnpm db:seed
 *
 * @example
 * ```bash
 * # Full seed (all functions)
 * pnpm db:seed
 *
 * # Admin only (standalone)
 * pnpm db:seed:admin
 * ```
 *
 * ## Seed Order
 *
 * 1. Admin — Creates the superadmin user (required for audit fields)
 * 2. (Add more seeds here as needed)
 *
 * ## Idempotency
 *
 * All seeds are idempotent — safe to run multiple times.
 */

import { seedAdmin } from './seeds';
import { db } from './drizzle';
import { sql } from 'drizzle-orm';

async function seed() {
  console.log('🌱 Starting database seed...\n');

  // 1. Ensure PG SEQUENCE for human IDs exists BEFORE any seed consumes it.
  //    Migration 0003 creates it via `db:migrate`, but this is a defensive
  //    safety net for fresh installs that ran `db:push` (which skips raw SQL)
  //    or seeded before migrating.
  await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS user_human_id_seq`);

  // 2. Admin seed (required first for audit field references; consumes the sequence)
  await seedAdmin();

  // 3. Sync sequence to current user count (idempotent; aligns seq after admin insert)
  await db.execute(
    sql`SELECT setval('user_human_id_seq', GREATEST((SELECT COUNT(*) FROM users), 1))`
  );
  console.log('✅ user_human_id_seq synced');

  // 4. Add more seeds here as needed:
  // await seedDemoData();

  console.log('\n✅ All seeds complete');
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
