# RIF-042: PWA manifest + service worker (FT-015)

| Field            | Value                                    |
| ---------------- | ---------------------------------------- |
| **Epic**         | EPIC-005 Stretch PWA + Sound             |
| **Priority**     | P2 (SHOULD, stretch)                     |
| **Story Points** | 5                                        |
| **Dependencies** | EPIC-004 completo                        |
| **User Stories** | US-026                                   |
| **Features**     | FT-015                                   |
| **Agents**       | `frontend-specialist`, `devops-engineer` |
| **Skills**       | `kb-pwa`, `kb-service-workers`           |

## Problem

Hacer Rifatela instalable como PWA (manifest + service worker) y permitir que vista pública cacheada funcione offline (último snapshot). NO offline-write para vendedores (rechazado por RSK-001).

## Acceptance Criteria

```gherkin
Given un visitor en Chrome/Safari mobile que abre /r/{slug}
When la página carga >= 1 vez
Then el browser ofrece "Instalar Rifatela" (banner nativo PWA)
When acepto
Then icono Rifatela aparece en home screen
And al abrirlo, standalone mode sin URL bar

Given un user con la PWA instalada
When pierdo conexión y abro /r/{slug} previamente visitada
Then service worker sirve el último snapshot cacheado
And se muestra banner "Modo offline — datos pueden estar desactualizados"

Given rutas con tokens (/admin/, /v/)
When service worker intercepta requests
Then NUNCA las cachea (privacy: tokens nunca en cache storage)

Given vista pública con imagen del premio
When SW cachea /r/{slug}
Then también cachea la prize image (next/image optimized)

Given Lighthouse PWA audit
When corre
Then ≥ 90 score
And installable check ✅
And manifest válido (icons, name, theme_color, etc.)
```

## Implementation notes

```ts
// src/app/manifest.ts (Next.js manifest)
import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Rifatela',
    short_name: 'Rifatela',
    description: 'Rifas sin lápiz ni cuaderno',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFF8E7',
    theme_color: '#D7263D',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
```

- Service worker: usar `next-pwa` plugin o Workbox manualmente
- Cache strategy:
  - `/r/*` y assets estáticos → `staleWhileRevalidate`
  - `/admin/*` y `/v/*` → **never cache** (explicit `NetworkOnly`)
- Banner offline: hook `useIsOnline` con UI feedback
- Iconos PNG generados desde logo (necesita logo concreto OQ-D1, usar placeholder por ahora)

## Done when

- [ ] manifest.ts creado
- [ ] Service worker con cache strategy correcta
- [ ] Iconos 192/512/maskable
- [ ] Tests: install prompt simulable, offline mode funciona
- [ ] Lighthouse PWA audit ≥ 90
- [ ] `pnpm verify` pasa
