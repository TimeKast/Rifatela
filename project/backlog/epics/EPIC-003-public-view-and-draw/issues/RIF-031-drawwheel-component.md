# RIF-031: `<DrawWheel>` SVG animation + replay determinista (CMP-004)

| Field               | Value                                                                  |
| ------------------- | ---------------------------------------------------------------------- |
| **Epic**            | EPIC-003 Public View & Draw                                            |
| **Priority**        | P0                                                                     |
| **Story Points**    | 8                                                                      |
| **Dependencies**    | RIF-006, RIF-027 (seedToWinner)                                        |
| **User Stories**    | US-016, US-018                                                         |
| **Features**        | FT-008, FT-009                                                         |
| **Design**          | CMP-004 + §0.8 motion + DD-007 reduced-motion + DD-009 replay autoplay |
| **Risks mitigated** | RSK-005 (replay tampering)                                             |
| **Agents**          | `frontend-specialist`, `design-engineer`                               |
| **Skills**          | `kb-svg-animations`, `kb-components`                                   |

## Problem

Componente más visualmente complejo del producto. SVG rueda de la fortuna con N segments = tickets vendidos. Animación spin 4s con motion blur, decelerate easing, aterriza en ganador. Replay determinista: dado el mismo `rngSeed`, animación es idéntica.

## Acceptance Criteria

```gherkin
Given <DrawWheel mode="live" rngSeed={...} soldTickets={...} winnerTicketId={...} />
When mode='live' y trigger spin
Then SVG circle dividido en N segments (colores alternados de paleta)
And cada segment tiene texto: número del ticket
And pointer triangle apunta desde arriba
And animation 4s con cubic-bezier(0.2, 0.95, 0.05, 1)
And rotation = 360*8 + (segmentAngle * winnerIndex)
And termina con pointer apuntando al segment ganador
And winnerSegment escala 1.15x con glow amarillo
And confetti burst overlay (canvas-confetti) 1.2s

Given mode="replay"
When component mounts
Then animación se reproduce auto (DD-009)
And after completion, botón "Repetir" disponible
And re-trigger reproduce idéntica animación

Given prefers-reduced-motion: reduce (DD-007)
When render
Then SIN spin animation — fade-in directo del segment ganador con highlight estático
And SIN confetti particles — texto "🎉" estático

Given component test
When ejecuto con seed fijo dos veces
Then la rotation final calculada es idéntica (replay determinista)

Given component test live region
When animación termina
Then aria-live announce "Ganador: número 47, J.P." en aria-live="polite" container

Given mobile 375px
When render
Then SVG es responsive (max-width 320px), tap-to-trigger funciona, no horizontal scroll
```

## Implementation notes

```tsx
// src/components/draw/DrawWheel.tsx
'use client';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';
import { seedToWinner } from '@/lib/draw/seedToWinner';
import confetti from 'canvas-confetti';

export function DrawWheel({ rngSeed, soldTickets, winnerTicketId, mode }: Props) {
  const prefersReduced = useReducedMotion();
  const { winnerIndex } = seedToWinner(
    rngSeed,
    soldTickets.map((t) => t.id)
  );
  const segmentAngle = 360 / soldTickets.length;
  const finalRotation = 360 * 8 + segmentAngle * winnerIndex;

  if (prefersReduced) {
    return <ReducedMotionFallback winner={soldTickets[winnerIndex]} />;
  }

  // SVG circle with segments + pointer + spin animation via CSS transform/transition
  // ...
}
```

- SVG con `viewBox` para scalability
- Segments: `<path>` o `<polygon>` cada uno con color rotativo de paleta (paleta §0.3)
- Spin via CSS `transform: rotate({finalRotation}deg)` + `transition: transform 4s cubic-bezier(...)`
- canvas-confetti library: lightweight, no React deps
- Live region para a11y (aria-live="polite")
- `useReducedMotion` hook custom (o `useMediaQuery` from utility lib)
- Mobile: SVG max-width responsive

## Done when

- [ ] Component implementado con SVG + animación
- [ ] Reduced-motion fallback
- [ ] Replay determinista verificado (component test 2 renders con mismo seed → mismo finalRotation)
- [ ] Aria-live announcement post-reveal
- [ ] Component test estados (live, replay, reduced-motion)
- [ ] E2E-003 incluye animation timing (4s waitFor)
- [ ] Manual check en Chrome / Safari / Firefox
- [ ] `pnpm verify` pasa
