# RIF-044: Sound en sorteo con mute toggle (FT-016)

| Field            | Value                                    |
| ---------------- | ---------------------------------------- |
| **Epic**         | EPIC-005 Stretch PWA + Sound             |
| **Priority**     | P2                                       |
| **Story Points** | 3                                        |
| **Dependencies** | RIF-031 (DrawWheel)                      |
| **User Stories** | US-027                                   |
| **Features**     | FT-016                                   |
| **Design**       | DD-007 (reduced-motion = no sonido)      |
| **Agents**       | `frontend-specialist`, `design-engineer` |
| **Skills**       | `kb-web-audio`                           |

## Problem

Agregar sonidos a la animación del sorteo: tick de rueda (durante spin) + fanfarria (al revelar ganador). Toggle 🔇/🔊 persistido en localStorage. Respeta `prefers-reduced-motion`.

## Acceptance Criteria

```gherkin
Given <DrawWheel> en mode='live' o 'replay'
When la rueda spin
Then se reproduce un audio "tick" en bucle suave durante 4s
When la rueda decelera
Then el tick reduce frecuencia (efecto perceptual de deceleración)
When la rueda se detiene en el ganador
Then se reproduce una fanfarria (~2s)

Given toggle 🔇/🔊 visible en SCR-004 y SCR-009
When user click
Then sonido se silencia inmediatamente
And la preferencia se persiste en localStorage 'rifatela.muted=true'
And en próximas visitas, el toggle refleja la preferencia

Given prefers-reduced-motion: reduce (DD-007)
When sorteo se ejecuta
Then NO se reproducen sonidos
And el toggle aparece disabled con tooltip "Sonido desactivado por accesibilidad"

Given browser sin Web Audio API
When ejecuta
Then degrada graceful (no audio, sin error)

Given component test
When mock localStorage y AudioContext
Then verify toggle behavior, persistence, mute logic
```

## Implementation notes

```tsx
// src/lib/audio/drawSounds.ts
const TICK_URL = '/audio/wheel-tick.mp3';  // < 50KB
const FANFARE_URL = '/audio/fanfare.mp3';  // < 200KB

export function useDrawSounds() {
  const [muted, setMuted] = useLocalStorage('rifatela.muted', false);
  const prefersReduced = useReducedMotion();

  const effective Muted = muted || prefersReduced;

  // Audio elements + play/stop methods
  // ...
}
```

- Audio files: corto, comprimido (mp3 64kbps), CC0/royalty-free
- Web Audio API o `<audio>` elements (simpler)
- `useLocalStorage` hook para persistence
- Considerar autoplay restrictions: el sonido se inicia cuando user invoca el sorteo (gesture explícito) — no problem en mode='live'. En mode='replay' auto-spin necesita user gesture primero (banner "Reproducir sorteo" con icon play).

## Done when

- [ ] 2 audio files en `/public/audio/`
- [ ] Hook `useDrawSounds` + toggle UI
- [ ] localStorage persistence verificado
- [ ] Reduced-motion path desactiva audio
- [ ] Component test
- [ ] Manual audio QA (subjective, no automated)
- [ ] `pnpm verify` pasa
