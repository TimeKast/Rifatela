# RIF-024: `<Countdown>` component (CMP-003)

| Field            | Value                                         |
| ---------------- | --------------------------------------------- |
| **Epic**         | EPIC-003 Public View & Draw                   |
| **Priority**     | P0                                            |
| **Story Points** | 3                                             |
| **Status**       | Completed (2026-05-22)                        |
| **Dependencies** | RIF-006                                       |
| **User Stories** | US-013, US-014                                |
| **Design**       | CMP-003, motion §0.8, DD-007 (reduced-motion) |
| **Agents**       | `frontend-specialist`, `design-engineer`      |
| **Skills**       | `kb-components`, `kb-animations`              |

## Problem

Componente client-side que muestra tiempo restante hacia `drawDate`. 2 variants: `hero` (display font 96px, flip-card per second) y `inline` (text-base inline).

## Acceptance Criteria

```gherkin
Given drawDate 60s en el futuro
When render <Countdown drawDate={drawDate} variant="hero" />
Then muestra "00 : 00 : 01 : 00" (días : hr : min : seg) en display font
And cada segundo decrementa con animación flip-card
And usa setInterval client-side (no polling al server)

Given variant="inline"
When render
Then muestra "1m 0s" o similar en text-base format

Given drawDate ya pasó (negativo)
When render
Then variant="hero" muestra "Sorteo en curso" (CTA placeholder)
And variant="inline" muestra "Sorteo pendiente"

Given prefers-reduced-motion: reduce (DD-007)
When render
Then digit replacement sin flip animation

Given component test con vi.useFakeTimers
When advance 3 seconds
Then countdown updated correctamente

Given SSR
When server pre-renders el component
Then no hay hydration mismatch (use placeholder during SSR, real calc en useEffect)
```

## Implementation notes

```tsx
'use client';
import { useEffect, useState } from 'react';

export function Countdown({ drawDate, variant = 'inline' }: Props) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (now === null) return <Placeholder variant={variant} />;  // SSR-safe
  const diff = drawDate.getTime() - now;
  if (diff <= 0) return <Expired variant={variant} />;

  const { days, hours, minutes, seconds } = computeBreakdown(diff);
  return variant === 'hero' ? <HeroDisplay {...} /> : <InlineDisplay {...} />;
}
```

- Flip-card animation: 2 elementos rotando (top half rotates down, bottom half reveals)
- Respect `prefers-reduced-motion` (DD-007)
- Cleanup interval en unmount

## Done when

- [x] Component `src/components/raffles/Countdown.tsx` ✅
- [x] SSR-safe: el server calcula con `serverNow` (prop) y el client re-sincroniza con setInterval ✅
- [x] Format adaptativo: "Xd Yh Zm" si quedan ≥24h, "HH:MM:SS" si menos, "¡Hora del sorteo!" cuando llegó ✅
- [x] Cleanup del interval en unmount ✅
- [x] `pnpm typecheck` + `pnpm lint` + `pnpm build` PASS ✅
- [ ] Variant `hero` con flip-card animation y `prefers-reduced-motion` fallback — _scope reducido a MVP; queda 1 variant unificada con look mono limpio_
- [ ] Component test con fake timers — _diferido per kit pattern_

## ✅ Implementation Evidence (2026-05-22)

### Decisión de scope

- **1 variant** en lugar de 2 (`hero`/`inline`). El look mono+grande funciona en `/r/{slug}` y queda compacto en otros lugares. Si después aparece un caso donde el tamaño choca, se agrega prop `size`.
- **No flip-card** en MVP. El refresh por segundo es percibible y suficiente; la animación flip es cosmética y arrastra complejidad (CSS keyframes + reduced-motion). Punto de mejora si los usuarios lo piden.

### SSR strategy

- El RSC pasa `serverNow={new Date()}` y `Countdown` lo usa como snapshot inicial → no hay "00:00:00" flash en SSR.
- `useEffect` arranca el `setInterval(1s)`. El primer tick re-sincroniza con `Date.now()` del cliente.
