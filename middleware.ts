/**
 * Rifatela Middleware (replaces the kit's NextAuth-driven one)
 *
 * Per ADR-003, Rifatela uses URL-secret tokens instead of real auth.
 * Responsibilities:
 *
 *   1. /admin/{token}/...  — Compare token against ADMIN_ACCESS_TOKEN env
 *      var (Edge-safe). Mismatch returns a 404 (no leak of admin
 *      existence). Sets `Referrer-Policy: no-referrer` and noindex on
 *      authorized responses.
 *
 *   2. /v/{token}/...      — Sets security headers only. The token-to-
 *      seller lookup hits the DB via `pg` (node-postgres), which is NOT
 *      Edge-compatible — that resolution happens inside the RSC page
 *      (or its withSellerToken-wrapped server actions).
 *
 *   3. /r/{slug}/...       — Public. Pass through without privacy headers
 *      (it's a shareable raffle landing). No `noindex` here on purpose:
 *      visitors share these URLs in WhatsApp + want previews to work.
 *
 *   4. Everything else     — Pass through unchanged. Kit pages (/login,
 *      /register, /dashboard) keep working without auth in MVP. They
 *      contain no Rifatela data; full purge in a follow-up issue.
 *
 * Correlation ID propagation is preserved from the kit baseline — it
 * threads through Sentry breadcrumbs and Vercel/Railway logs for traceable
 * cross-service debugging.
 *
 * Runtime: Edge (default). Avoid imports that require Node APIs (no `pg`,
 * no `crypto.createHash` — those are server-action territory).
 *
 * @see project/planning/07_ARCHITECTURE.md (ADR-003 URL-secret auth)
 * @see project/backlog/epics/EPIC-001-foundation-data-layer/issues/RIF-007-middleware-auth-headers.md
 */

import { NextResponse, type NextRequest } from 'next/server';

const TOKEN_HEADERS = {
  // Tokens are in the URL path — kill referrer leakage to third parties.
  'Referrer-Policy': 'no-referrer',
  // Search engines must never index any token-bearing URL.
  'X-Robots-Tag': 'noindex, nofollow',
} as const;

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const segments = pathname.split('/').filter(Boolean);

  // 1) Always thread a correlation ID — every observable request gets one.
  const correlationId = req.headers.get('x-correlation-id') ?? crypto.randomUUID();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-correlation-id', correlationId);

  const passWithCorrelationId = (extraHeaders?: Record<string, string>): NextResponse => {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set('x-correlation-id', correlationId);
    if (extraHeaders) {
      for (const [key, value] of Object.entries(extraHeaders)) {
        res.headers.set(key, value);
      }
    }
    return res;
  };

  // /admin/{token}/... — env var match or 404
  if (segments[0] === 'admin') {
    const token = segments[1];
    const expected = process.env.ADMIN_ACCESS_TOKEN;
    // Fail closed: missing env var OR token mismatch OR no token in path → 404.
    if (!expected || !token || token !== expected) {
      return new NextResponse(null, { status: 404 });
    }
    return passWithCorrelationId(TOKEN_HEADERS);
  }

  // /v/{token}/... — headers only (DB lookup in RSC)
  if (segments[0] === 'v') {
    return passWithCorrelationId(TOKEN_HEADERS);
  }

  // /r/{slug}/... and everything else — pass through.
  return passWithCorrelationId();
}

export const config = {
  // Run on every request except static assets / next internals.
  // Kit pages still flow through middleware so they get correlation IDs,
  // but no auth gating is applied (ADR-003 — no real auth in MVP).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\..*).*)'],
};
