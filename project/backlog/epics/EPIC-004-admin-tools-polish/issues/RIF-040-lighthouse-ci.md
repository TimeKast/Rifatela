# RIF-040: Lighthouse CI + mobile polish (FT-014)

| Field            | Value                                                       |
| ---------------- | ----------------------------------------------------------- |
| **Epic**         | EPIC-004 Admin Tools & Polish                               |
| **Priority**     | P1                                                          |
| **Story Points** | 3                                                           |
| **Dependencies** | RIF-023, RIF-026                                            |
| **Features**     | FT-014 (mobile-first cross-cutting)                         |
| **Design**       | DD-005 (mobile-first 375px)                                 |
| **Agents**       | `quality-engineer`, `frontend-specialist`, `seo-specialist` |
| **Skills**       | `kb-lighthouse`, `kb-performance`                           |

## Problem

Lighthouse CI debe correr en CI sobre rutas representativas (vista pública open + drawn) y bloquear deploys si performance/a11y/best-practices/SEO bajan thresholds. Más mobile polish manual: verificar 375px en flows críticos.

## Acceptance Criteria

```gherkin
Given lighthouserc.js config
When CI corre lhci autorun
Then audita las URLs:
  - /r/{seedSlug} (open variant)
  - /r/{seedSlug-drawn} (drawn variant)
  - / (landing default)
And assertions:
  - Performance ≥ 0.85 mobile
  - Accessibility ≥ 0.90
  - Best Practices ≥ 0.90
  - SEO ≥ 0.85
  - LCP ≤ 2500ms
And falla CI si alguno NO cumple

Given mobile 375px manual audit
When ejecuto los flows críticos (FLW-001, FLW-003, FLW-005)
Then NO hay horizontal scroll
And TODOS los tap targets ≥ 44px (DD-004)
And textos legibles sin zoom
And forms operables con pulgar único

Given accessibility check (parte de Lighthouse)
When audita
Then contrast ratios ≥ 4.5:1 body, ≥ 3:1 large text
And aria-labels en interactive elements
And focus visible en keyboard nav
```

## Implementation notes

```js
// lighthouserc.js (ya existe en kit, ampliar)
module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000/',
        // Add: seed slug for staging test data
      ],
      numberOfRuns: 3,
      settings: { emulatedFormFactor: 'mobile' },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.85 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.85 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
      },
    },
    upload: { target: 'temporary-public-storage' },
  },
};
```

- Seed data específica para Lighthouse (raffle con slug fijo, 30 vendidos, image optimizada)
- Optimizaciones probables: next/image, font preload, CSS critical inlined

## Done when

- [ ] lighthouserc.js actualizado
- [ ] CI workflow incluye `lhci autorun` con fail gate
- [ ] Manual audit mobile 375px en flows FLW-001/003/005 (checklist documentado)
- [ ] LCP ≤ 2.5s confirmado
- [ ] `pnpm verify` pasa
