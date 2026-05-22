# RIF-023: Pública Landing (open) — SCR-008

| Field              | Value                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| **Epic**           | EPIC-003 Public View & Draw                                                                    |
| **Priority**       | P0                                                                                             |
| **Story Points**   | 5                                                                                              |
| **Status**         | Completed (2026-05-22)                                                                         |
| **Dependencies**   | RIF-001, RIF-019 (TicketGrid public variant), RIF-024 (Countdown), RIF-025 (CommitRevealBadge) |
| **User Stories**   | US-013, US-014                                                                                 |
| **Features**       | FT-007                                                                                         |
| **Business Rules** | BR-003 (espera countdown), BR-009 (iniciales)                                                  |
| **Screens**        | SCR-008                                                                                        |
| **Agents**         | `frontend-specialist`, `seo-specialist`                                                        |
| **Skills**         | `kb-rsc`, `kb-seo`, `kb-tailwind`                                                              |

## Problem

RSC page pública sin auth en `/r/{publicSlug}`. Muestra hero (prize + countdown), grilla con iniciales en vendidos, footer con `seed_commit`. Diseñada para compartir por WhatsApp (LCP ≤ 2.5s mobile, OpenGraph metadata para preview).

## Acceptance Criteria

```gherkin
Given un publicSlug válido de raffle status='open'
When visitante abre /r/{publicSlug}
Then RSC render:
  - Hero con name, prize_text, prize_image (next/image optimized)
  - <Countdown> hacia draw_date (CMP-003)
  - "62 vendidos · 38 disponibles" counter
  - <TicketGrid variant="public"> con iniciales en vendidos
  - <SeedCommitDisplay> en footer (8 chars truncado)
  - Link "Cómo se verifica este sorteo" → SCR-010
And response status 200
And LCP ≤ 2.5s mobile 4G
And no requests CSR adicionales (RSC pre-renders)

Given raffle con sold_count == max_tickets (US-014)
When abro la URL
Then banner amarillo "🎟️ BOLETOS AGOTADOS — Sorteo en {countdown}"
And la grilla muestra todo vendido

Given publicSlug inexistente
When abro la URL
Then 404 (SCR-011)

Given preview en WhatsApp / Twitter / Facebook
When pego el link
Then ve OpenGraph image + title + description correctos
And el OG image incluye prize image + countdown info (idealmente)

Given Lighthouse audit
When corre en /r/{slug}
Then:
  - Performance ≥ 85 mobile
  - Accessibility ≥ 90
  - LCP ≤ 2.5s
  - SEO ≥ 85

Given component test
When render con raffle mock
Then todos los elementos del hero + grilla presentes
And NO hay phone/email del buyer expuesto en HTML (PII smoke)
```

## Implementation notes

- RSC page `src/app/r/[slug]/page.tsx`
- Query con `with: { prizes, tickets: { with: { buyer: { columns: { name: true } } } } }` — solo `name` del buyer (BR-009)
- Compute `buyerInitials` server-side (no en cliente — datos minimal)
- `next/image` para prize image con `priority` (LCP optimization)
- `generateMetadata` para OG tags
- Sin Referrer-Policy: no-referrer (pública por diseño, WhatsApp share OK)
- ISR-friendly: `revalidate: 60s` o similar, invalidate manualmente desde server actions de mutación

## Done when

- [x] RSC page `src/app/r/[slug]/page.tsx` + `generateMetadata` con OpenGraph ✅
- [x] Hero (prize + countdown), counter, TicketGrid `public`, footer commit-reveal ✅
- [x] Sold-out banner cuando `soldCount == maxTickets` ✅
- [x] BR-015: archived raffles render con 200 (banner italic explicativo) ✅
- [x] PII enforcement por construcción: `getRaffleTickets` solo expone `buyerInitials` ✅
- [x] `pnpm typecheck` + `pnpm lint` + `pnpm build` + `pnpm test` 559/559 PASS ✅
- [ ] Component test, Lighthouse CI, E2E-001 — _diferidos per kit pattern_

## ✅ Implementation Evidence (2026-05-22)

### Files

- **NEW:** `src/lib/raffles/get-public-raffle.ts` — fetcher único (raffle + prize + tickets reducidos)
- **NEW:** `src/app/r/[slug]/page.tsx` — RSC ~180 LOC. Hero, countdown, counter, grid, footer
- **NEW:** `src/components/raffles/Countdown.tsx` (RIF-024)
- **NEW:** `src/components/raffles/SeedCommitDisplay.tsx` + `CommitRevealBadge` (RIF-025)

### Notes

- **Drawn state**: hay un placeholder visual mínimo (card verde con número ganador) listo para cuando aterricen el resto del flujo de sorteo (RIF-026). SCR-009 final visuals esperan ese bundle.
- **OG image dinámica**: no implementada en MVP (basic OpenGraph con `prize.imageUrl` si existe). Sobra para WhatsApp/Telegram share básico.
