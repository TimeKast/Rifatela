# RIF-033: SCR-007 Ticket Digital + `<TicketDigitalCard>` + Web Share

| Field            | Value                                                   |
| ---------------- | ------------------------------------------------------- |
| **Epic**         | EPIC-003 Public View & Draw                             |
| **Priority**     | P0                                                      |
| **Story Points** | 5                                                       |
| **Dependencies** | RIF-001, RIF-021 (claimTicket retorna ticketDigitalUrl) |
| **User Stories** | US-019                                                  |
| **Features**     | FT-010                                                  |
| **Screens**      | SCR-007                                                 |
| **Components**   | CMP-007 TicketDigitalCard, CMP-014 ShareSheet           |
| **Agents**       | `frontend-specialist`                                   |
| **Skills**       | `kb-web-share`, `kb-og-images`                          |

## Problem

Post-venta, vendedor obtiene una pantalla con la "tarjeta digital" del comprador (número + nombre rifa + premio + fecha sorteo). Botón "Compartir" invoca Web Share API. URL es deeplink-friendly `/v/{token}/ticket/{ticketId}`.

## Acceptance Criteria

```gherkin
Given vendedor acaba de asignar ticket #47 a "Marta"
When la action claimTicket retorna ticketDigitalUrl
Then redirige a /v/{token}/ticket/{ticketId}
And SCR-007 render con card visual:
  - Hero con prize image + "RIFA PRO COLE"
  - Número grande: #47 (display font 96px)
  - "Marta Fernández" (buyer.name)
  - "Vendido por Diego"
  - "⏰ Sorteo: 31 mayo 20:00"
  - QR code (link a /r/{publicSlug})
And botón "📤 Compartir" prominent

Given click "Compartir" en device con Web Share API
When invoke navigator.share()
Then native share sheet aparece con:
  - title: "Tu boleto #47 — Rifa Pro Cole"
  - text: "Marta, te toca el #47. Sorteo: 31 mayo. Mirá la rifa en vivo:"
  - url: {origin}/r/{publicSlug}

Given device sin Web Share API (desktop browser)
When click "Compartir"
Then fallback: "Copiar link" + feedback "Copiado!"

Given buyer.name=null (anónimo)
When render
Then muestra "Sin nombre" en lugar del name
And share text refleja "Tu boleto #47..."

Given component test
When render con datos mock
Then card content presente, share button funcional (mock navigator.share)
```

## Implementation notes

- RSC page `src/app/v/[token]/ticket/[ticketId]/page.tsx`
- Query del ticket: `db.query.tickets.findFirst({ where: ..., with: { raffle: { with: { prizes: true } }, buyer: true, seller: true } })`
- Card visual diseñada con aspect ratio 9:16 (vertical, share-friendly)
- QR code: library `qrcode.react` (small dep) o SVG inline
- Web Share: `navigator.share()` con feature detection
- Bonus: `/api/og/ticket/{id}` endpoint que renderiza PNG dinámico para WhatsApp preview (OQ-D10 RECOMMENDED) — incluir como sub-issue opcional o este mismo

## Done when

- [ ] RSC page + TicketDigitalCard component
- [ ] Share button funciona (con fallback)
- [ ] Component test con/sin Web Share API mock
- [ ] OG image endpoint (opcional pero RECOMMENDED — agrega valor share UX)
- [ ] E2E (parte de E2E-002): venta + verificar pantalla del ticket
- [ ] `pnpm verify` pasa
