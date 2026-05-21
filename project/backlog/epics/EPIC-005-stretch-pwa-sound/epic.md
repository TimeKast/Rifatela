# EPIC-005 — Stretch: PWA + Sound

> **Phase:** Post-MVP v1.0 (entra solo si timeline lo permite)
> **Goal:** Pulir el ya-funcional MVP con installability + audio festivo
> **Issues:** RIF-042 → RIF-044 (3 issues)
> **Story Points total:** ~10

## Objetivo

SHOULD features per `02_FEATURE_MAP.md`:

- **FT-015 PWA instalable:** manifest + service worker + vista pública offline-cacheable
- **FT-016 Sonido sorteo:** tick de rueda + fanfarria + toggle mute persistido

Este epic es **opcional** para v1.0. Si la fecha aprieta, se difiere a v1.1.

## Out of scope

- Offline-write para vendedores (rechazado por riesgo de doble-venta, ver `13_RISK_REGISTER.md`)
- Push notifications nativas
- Cualquier feature WON'T del feature map

## Definition of Done (epic)

- [ ] Lighthouse PWA audit ≥90
- [ ] App installable desde Chrome/Safari mobile
- [ ] Vista pública abre sin conexión con datos cacheados del último visit
- [ ] Rutas con token NO se cachean en SW (privacy)
- [ ] Sonidos en `<DrawWheel>` con toggle 🔇/🔊 persistido en localStorage
- [ ] `prefers-reduced-motion` → sin sonido (respect a11y)

## Issues

- [RIF-042](./issues/RIF-042-pwa-manifest-sw.md) — PWA manifest + service worker (FT-015)
- [RIF-043](./issues/RIF-043-lighthouse-pwa-audit.md) — Lighthouse PWA audit + iconos
- [RIF-044](./issues/RIF-044-draw-sound-mute.md) — Sound en sorteo con mute (FT-016)

## Dependencies

- EPIC-004 completo (mobile polish ya validado)
- PWA build assumes el resto del MVP es estable
