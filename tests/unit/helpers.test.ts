/**
 * Server Action Helpers Tests
 *
 * Unit tests for withAuth(), withSelf(), ActionError, and parseInput.
 *
 * @see SK-001
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// --- Mocks -------------------------------------------------------------------

// Mock auth
const mockAuth = vi.fn();
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

// Mock requirePermission
const mockRequirePermission = vi.fn();
vi.mock('@/lib/auth/permissions', () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args),
}));

// Mock revalidatePath
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock db (used by withSellerToken to look up the seller)
const mockSellerFindFirst = vi.fn();
vi.mock('@/lib/db/drizzle', () => ({
  db: {
    query: {
      sellers: {
        findFirst: (...args: unknown[]) => mockSellerFindFirst(...args),
      },
    },
  },
}));

// --- Import after mocks -----------------------------------------------------
// Dynamic import to ensure mocks are in place
const { withAuth, withSelf, withSellerToken } = await import('@/lib/actions/helpers');
const { ActionError } = await import('@/lib/actions/types');

// --- Test schemas ------------------------------------------------------------
const testSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  email: z.string().email('Email inválido'),
});

// --- Helpers -----------------------------------------------------------------

function mockSession(overrides?: Partial<{ id: string; role: string; email: string }>) {
  return {
    user: {
      id: overrides?.id ?? 'user-123',
      role: overrides?.role ?? 'admin',
      email: overrides?.email ?? 'admin@test.com',
      ...overrides,
    },
  };
}

// =============================================================================
// withAuth Tests
// =============================================================================

describe('withAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);

    const result = await withAuth(
      { resource: 'users', action: 'create', schema: testSchema },
      { name: 'Test', email: 'test@test.com' },
      async () => {}
    );

    expect(result).toEqual({ error: 'Debes iniciar sesión' });
  });

  it('returns error when no permission', async () => {
    mockAuth.mockResolvedValue(mockSession({ role: 'user' }));
    mockRequirePermission.mockImplementation(() => {
      throw new Error('Permission denied');
    });

    const result = await withAuth(
      { resource: 'users', action: 'create', schema: testSchema },
      { name: 'Test', email: 'test@test.com' },
      async () => {}
    );

    expect(result.error).toContain('No tienes permiso');
  });

  it('returns error when schema validation fails', async () => {
    mockAuth.mockResolvedValue(mockSession());
    mockRequirePermission.mockImplementation(() => {});

    const result = await withAuth(
      { resource: 'users', action: 'create', schema: testSchema },
      { name: '', email: 'bad' },
      async () => {}
    );

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
  });

  it('returns data on success', async () => {
    mockAuth.mockResolvedValue(mockSession());
    mockRequirePermission.mockImplementation(() => {});

    const result = await withAuth(
      { resource: 'users', action: 'create', schema: testSchema },
      { name: 'Test', email: 'test@test.com' },
      async (data) => ({ created: data.name })
    );

    expect(result).toEqual({ data: { created: 'Test' } });
  });

  it('returns void data when handler returns nothing', async () => {
    mockAuth.mockResolvedValue(mockSession());
    mockRequirePermission.mockImplementation(() => {});

    const result = await withAuth(
      { resource: 'users', action: 'create', schema: testSchema },
      { name: 'Test', email: 'test@test.com' },
      async () => {}
    );

    expect(result).toEqual({ data: undefined });
    expect(result.error).toBeUndefined();
  });

  it('returns ActionError message when handler throws ActionError', async () => {
    mockAuth.mockResolvedValue(mockSession());
    mockRequirePermission.mockImplementation(() => {});

    const result = await withAuth(
      { resource: 'users', action: 'create', schema: testSchema },
      { name: 'Test', email: 'test@test.com' },
      async () => {
        throw new ActionError('Email ya existe');
      }
    );

    expect(result).toEqual({ error: 'Email ya existe' });
  });

  it('returns generic error when handler throws unexpected error', async () => {
    mockAuth.mockResolvedValue(mockSession());
    mockRequirePermission.mockImplementation(() => {});

    const result = await withAuth(
      { resource: 'users', action: 'create', schema: testSchema },
      { name: 'Test', email: 'test@test.com' },
      async () => {
        throw new Error('DB connection failed');
      }
    );

    expect(result).toEqual({ error: 'Ocurrió un error. Intenta de nuevo.' });
  });

  it('passes userId to handler', async () => {
    mockAuth.mockResolvedValue(mockSession({ id: 'admin-456' }));
    mockRequirePermission.mockImplementation(() => {});

    let receivedUserId = '';
    await withAuth(
      { resource: 'users', action: 'create', schema: testSchema },
      { name: 'Test', email: 'test@test.com' },
      async (_data, userId) => {
        receivedUserId = userId;
      }
    );

    expect(receivedUserId).toBe('admin-456');
  });
});

// =============================================================================
// withSelf Tests
// =============================================================================

describe('withSelf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);

    const result = await withSelf(
      { schema: testSchema },
      { name: 'Test', email: 'test@test.com' },
      async () => {}
    );

    expect(result).toEqual({ error: 'Debes iniciar sesión' });
  });

  it('does NOT check permissions (unlike withAuth)', async () => {
    mockAuth.mockResolvedValue(mockSession({ role: 'user' }));

    const result = await withSelf(
      { schema: testSchema },
      { name: 'Test', email: 'test@test.com' },
      async () => ({ updated: true })
    );

    expect(mockRequirePermission).not.toHaveBeenCalled();
    expect(result).toEqual({ data: { updated: true } });
  });

  it('handles FormData input', async () => {
    mockAuth.mockResolvedValue(mockSession());

    const formData = new FormData();
    formData.set('name', 'Test User');
    formData.set('email', 'test@test.com');

    let receivedData: unknown = null;
    await withSelf({ schema: testSchema }, formData, async (data) => {
      receivedData = data;
    });

    expect(receivedData).toEqual({ name: 'Test User', email: 'test@test.com' });
  });

  it('works without schema (no-schema overload)', async () => {
    mockAuth.mockResolvedValue(mockSession({ email: 'user@test.com' }));

    let receivedEmail = '';
    const result = await withSelf({}, async (_userId, email) => {
      receivedEmail = email;
    });

    expect(result.error).toBeUndefined();
    expect(receivedEmail).toBe('user@test.com');
  });

  it('returns ActionError message from handler', async () => {
    mockAuth.mockResolvedValue(mockSession());

    const result = await withSelf(
      { schema: testSchema },
      { name: 'Test', email: 'test@test.com' },
      async () => {
        throw new ActionError('Contraseña incorrecta');
      }
    );

    expect(result).toEqual({ error: 'Contraseña incorrecta' });
  });
});

// =============================================================================
// withSellerToken Tests
// =============================================================================

describe('withSellerToken', () => {
  const sellerSchema = z.object({
    sellerToken: z.string().length(32),
    ticketId: z.string().uuid(),
  });

  beforeEach(() => {
    mockSellerFindFirst.mockReset();
  });

  it('executes handler with sellerId when token resolves to an active seller', async () => {
    mockSellerFindFirst.mockResolvedValueOnce({ id: 'seller-uuid-1' });
    const handler = vi.fn().mockResolvedValue({ ok: true });

    const result = await withSellerToken(
      { schema: sellerSchema },
      {
        sellerToken: 'a'.repeat(32),
        ticketId: '123e4567-e89b-42d3-a456-426614174000',
      },
      handler
    );

    expect(result).toEqual({ data: { ok: true } });
    // Handler receives business data with sellerToken stripped
    expect(handler).toHaveBeenCalledWith(
      { ticketId: '123e4567-e89b-42d3-a456-426614174000' },
      'seller-uuid-1'
    );
  });

  it('returns ambiguous "No autorizado" when token does not match any seller', async () => {
    mockSellerFindFirst.mockResolvedValueOnce(undefined);
    const handler = vi.fn();

    const result = await withSellerToken(
      { schema: sellerSchema },
      {
        sellerToken: 'a'.repeat(32),
        ticketId: '123e4567-e89b-42d3-a456-426614174000',
      },
      handler
    );

    expect(result).toEqual({ error: 'No autorizado' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns ambiguous "No autorizado" when seller is archived (BR-013)', async () => {
    // The DB query filters by `isNull(deletedAt)` — an archived seller is
    // simply not returned, identical to "token not found" from this layer's
    // perspective. The wrapper must NOT leak the difference.
    mockSellerFindFirst.mockResolvedValueOnce(undefined);
    const handler = vi.fn();

    const result = await withSellerToken(
      { schema: sellerSchema },
      {
        sellerToken: 'b'.repeat(32),
        ticketId: '123e4567-e89b-42d3-a456-426614174000',
      },
      handler
    );

    expect(result).toEqual({ error: 'No autorizado' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns validation error and does NOT touch the DB when input is invalid', async () => {
    const handler = vi.fn();

    const result = await withSellerToken(
      { schema: sellerSchema },
      { sellerToken: 'too-short', ticketId: 'not-a-uuid' },
      handler
    );

    expect(result).toHaveProperty('error');
    expect(handler).not.toHaveBeenCalled();
    expect(mockSellerFindFirst).not.toHaveBeenCalled();
  });

  it('returns ActionError message when handler throws ActionError', async () => {
    mockSellerFindFirst.mockResolvedValueOnce({ id: 'seller-uuid-1' });

    const result = await withSellerToken(
      { schema: sellerSchema },
      {
        sellerToken: 'a'.repeat(32),
        ticketId: '123e4567-e89b-42d3-a456-426614174000',
      },
      async () => {
        throw new ActionError('Ese número ya se vendió');
      }
    );

    expect(result).toEqual({ error: 'Ese número ya se vendió' });
  });

  it('returns generic message when handler throws unexpected error', async () => {
    mockSellerFindFirst.mockResolvedValueOnce({ id: 'seller-uuid-1' });

    // Suppress console.error noise in test output
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await withSellerToken(
      { schema: sellerSchema },
      {
        sellerToken: 'a'.repeat(32),
        ticketId: '123e4567-e89b-42d3-a456-426614174000',
      },
      async () => {
        throw new Error('unexpected DB error');
      }
    );

    expect(result).toEqual({ error: 'Ocurrió un error. Intenta de nuevo.' });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
