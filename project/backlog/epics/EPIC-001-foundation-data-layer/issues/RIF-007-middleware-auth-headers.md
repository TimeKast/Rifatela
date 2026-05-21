# RIF-007: Middleware (token routes + security headers)

| Field               | Value                                              |
| ------------------- | -------------------------------------------------- |
| **Epic**            | EPIC-001 Foundation & Data Layer                   |
| **Priority**        | P0                                                 |
| **Story Points**    | 3                                                  |
| **Status**          | ✅ Completed (2026-05-21)                          |
| **Dependencies**    | RIF-001                                            |
| **User Stories**    | (preparatory para todas las routes admin/vendedor) |
| **Risks mitigated** | RSK-002 (URL leak), RSK-006 (browser sync)         |
| **Agents**          | `backend-specialist`, `security-auditor`           |
| **Skills**          | `kb-middleware`, `kb-security`                     |
| **ADR**             | ADR-003 (URL-secret auth)                          |

## Problem

Per `07_ARCHITECTURE.md §3.2`, las rutas con token (`/admin/{token}/*` y `/v/{token}/*`) necesitan:

- Validación de token al inicio (404 si inválido o vendedor archivado)
- `Referrer-Policy: no-referrer` (mitiga RSK-002 leak via referrer)
- `X-Robots-Tag: noindex, nofollow` (mitiga indexación)
- NO necesario para `/r/{slug}` (público por diseño)

## Acceptance Criteria

```gherkin
Given un request a /admin/{validToken}/dashboard
When middleware ejecuta
Then la response incluye headers:
  - Referrer-Policy: no-referrer
  - X-Robots-Tag: noindex, nofollow
And la request continúa al handler

Given un request a /admin/{wrongToken}/dashboard
When middleware ejecuta
Then la response es 404 (no 401, no leak de info)

Given un request a /v/{validToken}
When middleware ejecuta
Then los mismos headers se setean
And el handler tiene acceso al sellerId via header X-Seller-Id (o context similar)

Given un request a /v/{validToken} donde el Seller tiene archived_at != NULL
When middleware ejecuta
Then response es 404 (BR-013 — mismo error que token inválido)

Given un request a /r/{publicSlug}
When middleware ejecuta
Then NO se setean Referrer-Policy: no-referrer (ruta pública, share en WhatsApp OK)
And SI puede haber otros headers normales (cache, etc.)

Given un request a /admin/ (sin token)
When middleware ejecuta
Then response es 404
```

## Implementation notes

```ts
// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/admin/')) {
    const adminToken = pathname.split('/')[2];
    if (!adminToken || adminToken !== process.env.ADMIN_ACCESS_TOKEN) {
      return new NextResponse(null, { status: 404 });
    }
    const res = NextResponse.next();
    res.headers.set('Referrer-Policy', 'no-referrer');
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return res;
  }

  if (pathname.startsWith('/v/')) {
    const sellerToken = pathname.split('/')[2];
    // Validate token against DB via edge-compatible query OR
    // defer to RSC (middleware sets headers, RSC validates)
    const res = NextResponse.next();
    res.headers.set('Referrer-Policy', 'no-referrer');
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/v/:path*', '/r/:path*'],
};
```

- DB validation de seller token puede ocurrir en middleware (edge runtime con Neon HTTP) o defer to RSC (más simple). Decidir según latency target — recomendado RSC validation para reducir cold start.
- `ADMIN_ACCESS_TOKEN` env var (constant string, generado al setup; ver `10_RUNBOOKS.md` RB-009)
- Path-based tokens (no query strings) — ya garantizado por Next App Router routing

## Done when

- [x] `middleware.ts` implementado (root, no `src/middleware.ts` — Next.js convention) ✅
- [x] Unit test: /admin/{validToken} → headers seteados ✅
- [x] Unit test: /admin sin token o token inválido → 404 ✅
- [x] Unit test: ADMIN_ACCESS_TOKEN ausente → 404 (fail-closed) ✅
- [x] Unit test: /v/{token} → headers seteados (DB validation deferida a RSC) ✅
- [x] Unit test: /r/{slug} (público) NO trae Referrer-Policy ✅
- [x] Unit test: kit pages (/login, /dashboard) pasan sin gating ✅
- [x] Unit test: correlation ID propagation + UUID generation ✅
- [x] `pnpm typecheck` + `pnpm lint` + 16/16 tests + **534/534 full suite** PASS ✅
- [ ] E2E smoke real contra Railway deploy — _verifiable post-merge cuando se setee `ADMIN_ACCESS_TOKEN` en Railway_

## ✅ Implementation Evidence (2026-05-21)

### Files modified

- **REWRITE:** `middleware.ts` — reemplazado el `NextAuth.auth((req) => ...)` wrapper del kit por router Rifatela. Edge-safe, sin imports de DB/NextAuth.
- **NEW:** `tests/unit/middleware.test.ts` — 16 unit tests con `new NextRequest(url, init)`.

### Behavior summary

| Path pattern                            | Action                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `/admin/{token}/*`                      | Compare against `process.env.ADMIN_ACCESS_TOKEN`; match → headers + pass; mismatch/missing → 404 |
| `/v/{token}/*`                          | Headers + pass. DB validation deferida a la RSC page (Edge runtime no soporta `pg`)              |
| `/r/{slug}/*`                           | Pass sin headers de privacy (shareable URL para WhatsApp)                                        |
| `/login`, `/dashboard`, otros kit pages | Pass sin gating — quedan accesibles pero sin Rifatela data (ADR-003)                             |
| Todo                                    | Correlation ID propagation/generation                                                            |

### Security headers en `/admin/*` y `/v/*`

- `Referrer-Policy: no-referrer` — bloquea leak de token via referer headers
- `X-Robots-Tag: noindex, nofollow` — bots no indexan URLs con tokens

### Test results

```
✓ middleware — /admin/{token} (6 tests):
  ✓ allows /admin/{validToken} with security headers + correlation ID
  ✓ allows nested /admin/{validToken}/raffles/.../draw
  ✓ returns 404 when /admin token does not match
  ✓ returns 404 for /admin/ with no token
  ✓ returns 404 for /admin with no trailing slash + no token
  ✓ returns 404 when ADMIN_ACCESS_TOKEN env var is not set (fail-closed)
✓ middleware — /v/{token} (2 tests)
✓ middleware — /r/{slug} (public) (2 tests)
✓ middleware — other routes (3 tests)
✓ middleware — correlation ID (3 tests)

Test Files  1 passed (1)  ·  Tests  16 passed (16)
```

Full suite: **534/534 PASS** (sin regresiones).

### Deviations from spec

- **DB validation diferida a RSC, no en middleware.** Edge runtime de Next.js no soporta `pg` (node-postgres). El spec lo permite explícitamente ("Validate token against DB via edge-compatible query OR defer to RSC"). Eligimos defer — más simple, sin cold-start de DB en cada request.
- **NextAuth wrapper REMOVIDO.** El kit envolvía todo en `auth((req) => ...)`. Per ADR-003 (no auth real en MVP) lo dejamos pasar. Kit pages siguen accesibles pero sin auth gating. Cleanup completo de rutas /login etc. queda para issue futuro.

### Setup operacional pendiente (NO blocker — solo para que /admin funcione en prod)

- `ADMIN_ACCESS_TOKEN` env var en Railway. Generamos un token earlier en la sesión: `DEg-tj3qcO0vhQek-xMyr9MSMfIaYwhR` (rotalo si te preocupa que aparezca en chat logs).

### Pending follow-up (NOT blocking)

- Consumido por RIF-009..014 (admin/seller pages) — RSC pages validan seller tokens via `withSellerToken` (ya disponible from RIF-004)
- Cleanup definitivo de kit auth (remover /login, /register, /dashboard, NextAuth deps) → tracking issue futuro
