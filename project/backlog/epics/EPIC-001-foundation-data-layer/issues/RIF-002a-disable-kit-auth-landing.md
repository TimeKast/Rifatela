# RIF-002a: Disable kit auth-redirect + Rifatela landing placeholder

| Field              | Value                                                         |
| ------------------ | ------------------------------------------------------------- |
| **Epic**           | EPIC-001 Foundation & Data Layer                              |
| **Priority**       | P0                                                            |
| **Story Points**   | 2                                                             |
| **Status**         | ✅ Completed (2026-05-21)                                     |
| **Dependencies**   | —                                                             |
| **User Stories**   | (anchor para visibilidad del deploy hasta que llegue RIF-007) |
| **Business Rules** | F24 / ADR-003 (no auth real en MVP)                           |
| **Agents**         | `frontend-specialist`                                         |
| **Skills**         | `kb-rsc`                                                      |

## Problem

El starter kit shipea `src/app/page.tsx` que redirige cualquier visita a `/` hacia `/login` (o `/dashboard` si está logueado). Esto contradice la decisión de discovery F24 / ADR-003 ("sin auth real, sin login form en MVP") y, más urgente, **rompe la posibilidad de visitar el deploy de Railway** — cualquiera que abra la URL pública es forzado al login del kit.

No estaba en el backlog original — emergió al ver el deploy. Se materializa como sub-issue de EPIC-001 porque debe resolverse antes que `/implement` siga con otros issues, sino el deploy queda inaccesible.

## Out of scope (futuro)

- Desinstalar completamente `/login`, `/register`, `/dashboard`, etc. del kit — eso vendrá cuando refactoricemos rutas en RIF-007 (middleware Rifatela) y issues siguientes
- Implementar las rutas Rifatela (`/admin/{token}`, `/v/{token}`, `/r/{slug}`) — RIF-007 y subsiguientes
- Landing visual completa con animación, branding, etc. — diseño detallado vendrá con RIF-023 (vista pública landing). Acá ponemos solo un placeholder honesto

## Acceptance Criteria

```gherkin
Given el deploy en Railway con esta issue mergeada
When abro la URL pública en un browser sin sesión
Then NO me redirige a /login
And veo una landing placeholder con título "Rifatela" + tagline + mensaje "En desarrollo"
And la página renderiza sin lanzar errores (RSC sin tocar DB ni auth)

Given un visitor que escribe manualmente /login en la URL
When la página carga
Then sigue funcionando (no removemos /login en este issue, solo dejamos de forzarlo)

Given pnpm typecheck
When ejecuta
Then PASS (sin errors derivados del cambio)

Given pnpm lint
When ejecuta
Then PASS
```

## Implementation

### Files affected

| File               | Change  | Why                                                              |
| ------------------ | ------- | ---------------------------------------------------------------- |
| `src/app/page.tsx` | REWRITE | Reemplazar redirect-to-login con landing placeholder de Rifatela |

### Pseudocode

```tsx
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-amber-50 px-6 text-center text-purple-950">
      <h1 className="text-6xl font-bold tracking-tight md:text-8xl">Rifatela</h1>
      <p className="mt-4 text-xl md:text-2xl">Rifas sin lápiz ni cuaderno.</p>
      <p className="mt-12 text-sm text-purple-700">En desarrollo · próximamente</p>
    </main>
  );
}
```

> Tailwind classes aproximan la paleta carnaval del [design spec §0.3](../../../planning/15_DESIGN.md) (rojo carpa / amarillo dorado / crema). Cuando RIF-006 mappee los design tokens, esta landing se actualiza con `bg-bg`, `text-fg`, etc.

## Done when

- [x] `src/app/page.tsx` reemplazada (sin redirect a `/login` ni `auth()`) ✅
- [x] Componente RSC puro, sin imports de auth ✅
- [x] `/login` sigue accesible manualmente (no se eliminó del kit) ✅
- [x] `pnpm typecheck` PASS ✅
- [x] `pnpm lint` PASS ✅
- [ ] Deploy en Railway muestra la landing en lugar del login — _verifiable post-merge cuando Railway redeploye_

## ✅ Implementation Evidence (2026-05-21)

### Files changed

- **REWRITE:** `src/app/page.tsx` — reemplazado redirect-to-login del kit por landing placeholder Rifatela
  - Removed: `import { redirect } from 'next/navigation'`
  - Removed: `import { auth } from '@/lib/auth/auth'`
  - Removed: `await auth()` call + conditional redirects
  - Added: pure RSC con título "Rifatela" + tagline "Rifas sin lápiz ni cuaderno." + "En desarrollo · próximamente"

### Why this is enough

- `middleware.ts` ya lista `/` como public route (`authConfig.callbacks.authorized` línea 127). NO requiere cambio.
- `/login`, `/register`, etc. siguen funcionando — solo dejamos de FORZAR el redirect default al login.
- Rich landing visual queda pending para RIF-023 (vista pública por rifa) o un issue nuevo cuando hagamos branding final.

### Tailwind classes used (placeholder hasta RIF-006 design tokens)

- `bg-amber-50` → aproxima crema cálido `#FFF8E7` (futuro `bg-bg`)
- `text-purple-950` → aproxima deep purple-black `#1A0F2E` (futuro `text-fg`)
- `text-purple-700` → muted variant (futuro `text-fg-muted`)
- Migration trivial cuando RIF-006 mappee tokens reales

### Out of scope reaffirmed

- Sin remover `/login`, `/register`, `/dashboard` del kit aún
- Sin desactivar feature flags de auth (sin necesidad inmediata — el redirect ya no fuerza)
- Sin tocar middleware (ya estaba OK)
