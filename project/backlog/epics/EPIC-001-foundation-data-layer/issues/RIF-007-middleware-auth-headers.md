# RIF-007: Middleware (token routes + security headers)

| Field               | Value                                              |
| ------------------- | -------------------------------------------------- |
| **Epic**            | EPIC-001 Foundation & Data Layer                   |
| **Priority**        | P0                                                 |
| **Story Points**    | 3                                                  |
| **Status**          | To Do                                              |
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

- [ ] `src/middleware.ts` implementado
- [ ] Unit test: token válido → headers seteados
- [ ] Unit test: admin sin token → 404
- [ ] Unit test: ruta pública NO trae Referrer-Policy: no-referrer
- [ ] E2E smoke: navegar a `/admin/wrong` → 404
- [ ] `pnpm verify` pasa
