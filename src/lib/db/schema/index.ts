/**
 * Database Schema Exports
 *
 * Central export point for all Drizzle ORM schemas.
 * This is the Single Source of Truth (SSOT) for database structure.
 */

// =============================================================================
// User & Auth Schemas
// =============================================================================
export * from './users';

// =============================================================================
// Invites Schema
// =============================================================================
export * from './invites';

// =============================================================================
// Audit Schema
// =============================================================================
export * from './audit';

// =============================================================================
// Notifications Schema
// =============================================================================
export * from './notifications';

// =============================================================================
// Rate Limiting Schema
// =============================================================================
export * from './rate-limit';

// =============================================================================
// Rifatela domain (E-001 through E-006) — see project/planning/06_DATA_MODEL.md
// =============================================================================
export * from './raffles';
export * from './prizes';
export * from './sellers';
export * from './buyers';
export * from './tickets';
export * from './admin-actions';
export * from './raffle-sellers';
