# RIF-023: Pública Landing (open) — SCR-008

| Field              | Value                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| **Epic**           | EPIC-003 Public View & Draw                                                                    |
| **Priority**       | P0                                                                                             |
| **Story Points**   | 5                                                                                              |
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

- [ ] RSC page + metadata
- [ ] Component test render con datos mock
- [ ] PII smoke test (HTML no contiene `@`, `+54`, dígitos consecutivos >7)
- [ ] Lighthouse CI verde
- [ ] E2E (parte E2E-001): abrir vista pública después de crear rifa
- [ ] `pnpm verify` pasa
