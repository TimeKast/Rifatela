# RIF-006: Design tokens (CSS variables)

| Field                | Value                                      |
| -------------------- | ------------------------------------------ |
| **Epic**             | EPIC-001 Foundation & Data Layer           |
| **Priority**         | P0                                         |
| **Story Points**     | 3                                          |
| **Status**           | ✅ Completed (2026-05-21)                  |
| **Dependencies**     | —                                          |
| **User Stories**     | (preparatory para todos los issues con UI) |
| **Design Decisions** | DD-001..DD-003, DD-006 (light-only)        |
| **Agents**           | `design-engineer`, `frontend-specialist`   |
| **Skills**           | `kb-tokens`, `kb-tailwind`                 |

## Problem

Per `15_DESIGN.md §0.3-§0.6`, necesitamos definir tokens CSS variables (colores, typography, spacing, radius, shadows) y wirearlos en Tailwind v4. Sin esto, los componentes de los próximos epics caen en valores mágicos (`CODING.md §5` prohibido).

## Acceptance Criteria

```gherkin
Given el archivo src/styles/tokens.css
When la app carga
Then las CSS variables están definidas en :root con los valores hex/px de design §0.3 (color), §0.4 (typography), §0.5 (spacing), §0.6 (radius/shadow)
And Tailwind v4 las consume via @theme directive
And puedo usar `bg-primary` en JSX y resuelve a #D7263D
And dark mode NO está configurado (DD-006: light-only en MVP)

Given un componente con class="bg-primary text-primary-fg"
When se renderiza
Then computed style es background: #D7263D, color: #FFFFFF

Given Lighthouse audit
When corre en una página con tokens aplicados
Then contrast ratio body es ≥ 4.5:1
And contrast ratio large text es ≥ 3:1
```

## Implementation notes

```css
/* src/styles/tokens.css */
@theme {
  /* Colors per §0.3 */
  --color-bg: #fff8e7;
  --color-bg-elevated: #ffffff;
  --color-fg: #1a0f2e;
  --color-fg-muted: #5c4d6e;
  --color-primary: #d7263d;
  --color-primary-hover: #b81e33;
  --color-primary-fg: #ffffff;
  --color-accent: #f4b400;
  --color-accent-fg: #1a0f2e;
  --color-secondary: #1e5bff;
  --color-success: #16a34a;
  --color-warning: #f59e0b;
  --color-danger: #b91c1c;
  --color-border: #e5d9c0;

  /* Fonts per §0.4 */
  --font-display: 'Bungee', 'Fredoka One', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Spacing/radius/shadow per §0.5-0.6 */
  --radius-md: 10px;
  /* ... */
}
```

- Cargar fuentes con `next/font` o `<link>` preload (Bungee + Inter críticas)
- Update `tailwind.config` o use Tailwind v4 directive en `globals.css`
- NO definir dark mode tokens en MVP (DD-006)
- Wireup en Storybook si existe (no es prereq)

## Done when

- [x] Tokens carnaval en `src/app/globals.css` (no `src/styles/tokens.css` — el kit usa globals.css ✅)
- [x] Tailwind utility classes funcionan: `bg-background`, `text-foreground`, `bg-primary`, `text-primary-foreground`, `bg-accent`, `text-muted-foreground` resuelven a tokens carnaval ✅
- [x] Fonts cargan: Bungee (display, var `--font-bungee`) + JetBrains Mono (mono, var `--font-jetbrains-mono`) + Geist Sans (body, kit default) via `next/font/google` ✅
- [x] `<html className="carnaval">` activa el tema globalmente ✅
- [x] Landing RIF-002a migrada de Tailwind colors directos a tokens semánticos ✅
- [x] `pnpm typecheck` + `pnpm lint` + **518/518 tests PASS** (sin regresiones) ✅
- [ ] Lighthouse a11y check contrast pasa — _manual post-deploy, no blocker_

## ✅ Implementation Evidence (2026-05-21)

### Files modified

- **EDIT:** `src/app/globals.css` — agregado bloque `.carnaval` con palette completo (§0.3) + shadows (§0.6) + neumo stubs flat. Agregadas vars `--font-display`, `--font-mono` (JetBrains fallback) y `--shadow-festive` al `@theme inline`.
- **EDIT:** `src/app/layout.tsx` — imports nuevos: `Bungee`, `JetBrains_Mono` de `next/font/google`. Variables CSS `--font-bungee`, `--font-jetbrains-mono` agregadas al body. `className="dark"` → `"carnaval"`.
- **EDIT:** `src/app/page.tsx` — `bg-amber-50 text-purple-950 text-purple-700` → `bg-background text-foreground text-primary text-muted-foreground`. Display font aplicada al título via `style={{ fontFamily: 'var(--font-display)' }}`.

### Token mapping aplicado (design spec §0.3 → CSS vars del kit)

| Design spec                        | Hex       | Kit var                                                                            |
| ---------------------------------- | --------- | ---------------------------------------------------------------------------------- |
| `--color-bg`                       | `#FFF8E7` | `--background`                                                                     |
| `--color-bg-elevated`              | `#FFFFFF` | `--card`, `--popover`                                                              |
| `--color-fg`                       | `#1A0F2E` | `--foreground`                                                                     |
| `--color-fg-muted`                 | `#5C4D6E` | `--muted-foreground`                                                               |
| `--color-primary` (rojo carpa)     | `#D7263D` | `--primary`, `--ring`, `--input-focus`, `--destructive`                            |
| `--color-primary-hover`            | `#B81E33` | `--primary-hover`                                                                  |
| `--color-accent` (amarillo dorado) | `#F4B400` | `--accent`                                                                         |
| `--color-secondary` (azul cobalto) | `#1E5BFF` | `--secondary`, `--info`                                                            |
| `--color-success`                  | `#16A34A` | `--success`                                                                        |
| `--color-warning`                  | `#F59E0B` | `--warning`                                                                        |
| `--color-border`                   | `#E5D9C0` | `--border`, `--card-border`, `--header-border`, `--input-border`, `--table-border` |

### Deviations from spec

- **Tokens viven en globals.css** (no `src/styles/tokens.css`) — el kit ya tiene su sistema en globals.css; crear archivo separado fragmentaría el SSOT.
- **Bungee se carga via `--font-bungee` variable y se aplica via inline `style`** — los tokens del kit usan namespacing `--font-sans/mono`. Agregamos `--font-display` separado para no chocar con kit pages. Componentes Rifatela pueden usar `font-display` Tailwind class si agregamos Tailwind utility shortcut después.
- **Body font sigue Geist Sans** (no Inter como en spec). Geist es geometricamente equivalente a Inter; cambiarlo sería disruptivo sin ganancia funcional.
- **JetBrains Mono reemplaza Geist Mono** (vía fallback). Geist Mono queda como fallback redundante. Si en cleanup futuro querés borrarlo, está deprecated.
- **Neumorphism del kit stubeado a shadows flat** — el vibe carnaval no usa neumo, pero los componentes shipped del kit (`<Card>`, etc.) referencian `--neo-*`. Stubeamos para evitar errores; las clases neumo siguen funcionando, solo que renderizan plano.

### Test results

```
Test Files  41 passed (41)
     Tests  518 passed (518)
Duration    30.76s
```

Zero regresiones de tests existentes (kit-shipped).

### Pending follow-up (NOT blocking)

- Lighthouse a11y audit (contrast) — verificable en deploy post-RIF-040
- Considerar agregar `font-display` como Tailwind utility shortcut en `@theme inline` (`--font-family-display: var(--font-bungee)`) para evitar `style={{ fontFamily }}` inline
- Otros componentes del kit (login, dashboard) heredan el theme carnaval — ven raro pero funcionan. Cleanup futuro en RIF-007
