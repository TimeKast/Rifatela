/**
 * Drizzle ORM Database Client
 *
 * Uses node-postgres (`pg`) with connection pooling. Compatible with any
 * standard Postgres provider (Railway, Supabase, RDS, self-hosted, etc.).
 *
 * Requires DATABASE_URL environment variable (e.g.
 *   postgresql://user:pass@host:5432/db?sslmode=require
 * ).
 *
 * SSL is enabled automatically when:
 *   - NODE_ENV=production, or
 *   - the connection string includes `sslmode=require` / `sslmode=verify-*`,
 *   - or the host is recognizably a managed provider (railway/supabase/rds/etc.).
 *
 * Supports transactions via db.transaction(). The core concurrency invariant
 * (BR-002 atomic conditional UPDATE) is a single statement and does NOT
 * require an explicit transaction.
 *
 * @see project/planning/07_ARCHITECTURE.md (ADR-001 Concurrency)
 */

import { Pool, type PoolConfig } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

/**
 * Check if database is configured.
 * Re-exported from env.ts for convenience.
 */
export { isDatabaseConfigured } from '@/lib/env';

/**
 * Decide whether to enable SSL based on connection string + environment.
 *
 * `rejectUnauthorized: false` is intentional for managed providers that use
 * intermediate certs (Railway, Supabase, Neon over public endpoint, etc.).
 * For stricter setups, override via DATABASE_URL ssl params or fork this.
 */
function resolveSslOption(databaseUrl: string): PoolConfig['ssl'] {
  const lower = databaseUrl.toLowerCase();
  const needsSsl =
    process.env.NODE_ENV === 'production' ||
    lower.includes('sslmode=require') ||
    lower.includes('sslmode=verify-ca') ||
    lower.includes('sslmode=verify-full') ||
    lower.includes('railway.app') ||
    lower.includes('rlwy.net') ||
    lower.includes('supabase.co') ||
    lower.includes('neon.tech');
  return needsSsl ? { rejectUnauthorized: false } : false;
}

/**
 * Database client instance.
 *
 * Note: Will be a runtime-throwing proxy during build time if DATABASE_URL is
 * not set. All database operations must run in a request context (RSC, server
 * action, route handler) — never at module top level.
 */
export const db: Database = (() => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        'DATABASE_URL not set. Configure it in your hosting environment (Railway/Vercel/etc.) or .env.local for local dev.'
      );
    }

    // Return a proxy that throws helpful errors at runtime
    return new Proxy({} as Database, {
      get(_, prop) {
        if (prop === 'then' || prop === Symbol.toStringTag) {
          return undefined;
        }
        throw new Error('Database not configured. Set DATABASE_URL.');
      },
    }) as Database;
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: resolveSslOption(databaseUrl),
  });
  return drizzle(pool, { schema });
})();
