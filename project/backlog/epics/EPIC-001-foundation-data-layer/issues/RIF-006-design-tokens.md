# RIF-006: Design tokens (CSS variables)

| Field                | Value                                      |
| -------------------- | ------------------------------------------ |
| **Epic**             | EPIC-001 Foundation & Data Layer           |
| **Priority**         | P0                                         |
| **Story Points**     | 3                                          |
| **Status**           | To Do                                      |
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

- [ ] `src/styles/tokens.css` con todas las variables del doc 15 §0
- [ ] Tailwind utility classes funcionan (`bg-primary`, `text-fg`, etc.)
- [ ] Fonts cargan (`next/font/google` para Bungee, Inter, JetBrains Mono)
- [ ] Lighthouse a11y check contrast pasa
- [ ] Component test smoke: render `<div className="bg-primary text-primary-fg">` y assert computed styles
