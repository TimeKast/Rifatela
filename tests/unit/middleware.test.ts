/**
 * Middleware Unit Tests (RIF-007)
 *
 * Exercises the middleware function directly with synthesized NextRequest
 * instances. Edge-safe — no DB or NextAuth imports required.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../../middleware';

const ADMIN_TOKEN = 'super-secret-admin-token-32chars';

function fakeRequest(pathname: string, headers?: Record<string, string>): NextRequest {
  const url = `https://rifatela.test${pathname}`;
  return new NextRequest(url, { headers: headers ?? {} });
}

describe('middleware — /admin/{token}', () => {
  const originalEnv = process.env.ADMIN_ACCESS_TOKEN;

  beforeEach(() => {
    process.env.ADMIN_ACCESS_TOKEN = ADMIN_TOKEN;
  });

  afterEach(() => {
    process.env.ADMIN_ACCESS_TOKEN = originalEnv;
  });

  it('allows /admin/{validToken} with security headers + correlation ID', () => {
    const res = middleware(fakeRequest(`/admin/${ADMIN_TOKEN}`));

    expect(res.status).toBe(200);
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(res.headers.get('x-correlation-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('allows nested /admin/{validToken}/raffles/.../draw with same headers', () => {
    const res = middleware(fakeRequest(`/admin/${ADMIN_TOKEN}/raffles/abc/draw`));

    expect(res.status).toBe(200);
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('returns 404 when /admin token does not match ADMIN_ACCESS_TOKEN', () => {
    const res = middleware(fakeRequest('/admin/wrong-token'));
    expect(res.status).toBe(404);
  });

  it('returns 404 for /admin/ with no token', () => {
    const res = middleware(fakeRequest('/admin/'));
    expect(res.status).toBe(404);
  });

  it('returns 404 for /admin with no trailing slash + no token', () => {
    const res = middleware(fakeRequest('/admin'));
    expect(res.status).toBe(404);
  });

  it('returns 404 when ADMIN_ACCESS_TOKEN env var is not set (fail-closed)', () => {
    delete process.env.ADMIN_ACCESS_TOKEN;
    const res = middleware(fakeRequest(`/admin/${ADMIN_TOKEN}`));
    expect(res.status).toBe(404);
  });
});

describe('middleware — /v/{token}', () => {
  it('passes /v/{anyToken} with security headers (DB validation deferred to RSC)', () => {
    const res = middleware(fakeRequest('/v/any-seller-token-32-chars-xyz1'));

    expect(res.status).toBe(200);
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(res.headers.get('x-correlation-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('passes nested /v/{token}/ticket/{ticketId} with same headers', () => {
    const res = middleware(fakeRequest('/v/abc/ticket/xyz'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
  });
});

describe('middleware — /r/{slug} (public)', () => {
  it('passes /r/{slug} WITHOUT security headers (shareable URL)', () => {
    const res = middleware(fakeRequest('/r/abc123xyz'));

    expect(res.status).toBe(200);
    expect(res.headers.get('Referrer-Policy')).toBeNull();
    expect(res.headers.get('X-Robots-Tag')).toBeNull();
    expect(res.headers.get('x-correlation-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('passes /r/{slug}/verify subroute without privacy headers', () => {
    const res = middleware(fakeRequest('/r/abc/verify'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Referrer-Policy')).toBeNull();
  });
});

describe('middleware — other routes', () => {
  it('passes / (landing) without privacy headers', () => {
    const res = middleware(fakeRequest('/'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Referrer-Policy')).toBeNull();
    expect(res.headers.get('x-correlation-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('passes kit pages like /login without privacy headers (kit still works)', () => {
    const res = middleware(fakeRequest('/login'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Referrer-Policy')).toBeNull();
  });

  it('passes kit /dashboard without privacy headers (no auth gating in MVP)', () => {
    const res = middleware(fakeRequest('/dashboard'));
    expect(res.status).toBe(200);
  });
});

describe('middleware — correlation ID', () => {
  it('propagates incoming x-correlation-id header through to response', () => {
    const existingId = '12345678-1234-1234-1234-123456789abc';
    const res = middleware(fakeRequest('/', { 'x-correlation-id': existingId }));
    expect(res.headers.get('x-correlation-id')).toBe(existingId);
  });

  it('generates a UUID v4 when no x-correlation-id is present', () => {
    const res = middleware(fakeRequest('/'));
    const id = res.headers.get('x-correlation-id');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('each call without an incoming ID produces a different correlation ID', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const res = middleware(fakeRequest('/'));
      ids.add(res.headers.get('x-correlation-id')!);
    }
    expect(ids.size).toBe(50);
  });
});
