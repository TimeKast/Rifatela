# 13 — Risk Register

> **Proyecto:** Rifatela
> **Source:** [`00_DISCOVERY_BRIEF.md`](./00_DISCOVERY_BRIEF.md) §Risks + Challenge Pass
> **Estado:** v1.0
> **ID namespace:** `RSK-XXX`

---

## Scoring legend

| Impact    | Likelihood |
| --------- | ---------- |
| 🟢 Low    | 🟢 Low     |
| 🟡 Medium | 🟡 Medium  |
| 🔴 High   | 🔴 High    |

**Tier final** = max(Impact, Likelihood) ajustado por mitigations existentes.

---

## Summary

| Tier      | Count | IDs                                                                                            |
| --------- | ----- | ---------------------------------------------------------------------------------------------- |
| 🔴 High   | 2     | RSK-001 (concurrency), RSK-002 (auth model)                                                    |
| 🟡 Medium | 4     | RSK-003 (PII), RSK-004 (img upload), RSK-005 (replay tampering), RSK-006 (tokens browser sync) |
| 🟢 Low    | 3     | RSK-007 (DB outage), RSK-008 (admin error), RSK-009 (rate limit)                               |
| **Total** | **9** |                                                                                                |

---

## RSK-001 — Doble venta del mismo número 🔴

**Category:** Technical / Integrity invariant
**Impact:** 🔴 High — rompe el North Star "zero doble-venta", genera disputa imposible de resolver, daña trust del producto
**Likelihood (sin mitigación):** 🔴 High — concurrencia entre vendedores es escenario normal
**Likelihood (con mitigación):** 🟢 Low — atomic UPDATE garantiza el invariant

### Mitigations en MVP

- **BR-002 atomic conditional UPDATE** — single-statement enforcement
- **E2E-002b concurrency race test** en CI — deploy blocked si falla
- **DB unique constraint** `(raffle_id, number)` — defense in depth
- **UX feedback:** toast + auto-refresh para el perdedor del race

### Trigger / detection

- Sentry alert si server action retorna `ticket_already_sold` con frequency >50/min (anomalía)
- Daily check: `SELECT raffle_id, number, count(*) FROM tickets WHERE status='sold' GROUP BY raffle_id, number HAVING count(*) > 1` → debe siempre devolver 0 rows

### Contingency si ocurre

1. Identificar via DB query (arriba)
2. Revertir la venta más reciente (`revertSale`) — preservar la primera
3. Comunicar al admin manualmente
4. Investigar root cause: ¿hubo deploy con bug en `claimTicket`? ¿Cambio en Neon driver?
5. Hotfix con regression test

### Owner

Dev team / admin operativo

---

## RSK-002 — Auth model: URL-secret leak 🔴

**Category:** Security
**Impact:** 🔴 High — quien tiene `ADMIN_ACCESS_TOKEN` tiene control total. Quien tiene URL de vendedor puede vender en su nombre.
**Likelihood:** 🟡 Medium — el usuario decidió esto conscientemente (R1 del brief)

### Risk vectors

1. Admin comparte token via WhatsApp con captura
2. Browser history sync (Chrome → Google account)
3. Referrer header leak (browser viejo o subrequests)
4. Screenshot del vendedor en su panel con la URL visible
5. Indexación por search engines

### Mitigations en MVP

- **Tokens en path** (no query) — minimiza referrer leak
- **`Referrer-Policy: no-referrer`** en layouts admin/vendedor (ADR-003)
- **`X-Robots-Tag: noindex, nofollow`** en rutas con token
- **FT-002 rotación de tokens** — admin puede invalidar leak conocido
- **404 ambiguo** — no diferenciar entre "token inválido" y "seller archivado" (no filtra info)
- **Sin password recovery** — no hay endpoint de "olvidé password" para atacar

### Acceptance criteria (consciente)

> El usuario aceptó este risk explícitamente en discovery. Para MVP single-org de confianza interna, está OK. **NO se acepta para multi-tenant o cuando entren cobros.**

### Upgrade path

Post-MVP v2: NextAuth con magic link email o OAuth. NextAuth dep mantenida en `package.json` para activación rápida.

### Owner

Dev team (mitigations técnicas) + Admin (operacional — no compartir token)

---

## RSK-003 — PII de buyers expuesta 🟡

**Category:** Privacy / Compliance
**Impact:** 🟡 Medium — si phone/email leakean, daño reputacional (LATAM no tiene GDPR-strict pero hay leyes locales: LGPD Brasil, Ley 25.326 Argentina)
**Likelihood:** 🟢 Low — diseño de BR-009 mitiga la mayoría de exposure paths

### Risk vectors

1. Bug en RSC que expone `buyer.phone` en vista pública
2. SQL injection (mitigado por Drizzle parameterized)
3. Backup leak (Neon maneja, fuera de scope)
4. Logs server-side que loguean Buyer completo

### Mitigations

- **BR-009 estricta:** vista pública SOLO `publicInitials(buyer.name)`
- **Tipos TypeScript discriminados:** `PublicBuyerData` vs `AdminBuyerData` — el primero NO expone phone/email
- **Component test:** `<PublicTicketGrid>` no debe contener nunca `@` ni `+54` ni `\d{8,}` (smoke test)
- **Logger sanitization:** never log `Buyer.phone`, `Buyer.email`

### Owner

Dev team

---

## RSK-004 — Upload de imagen del premio (malicious) 🟡

**Category:** Security
**Impact:** 🟡 Medium — un archivo malicioso podría servirse desde Vercel Blob (XSS si SVG con scripts, o storage abuse)
**Likelihood:** 🟢 Low (single-admin, no es entrada pública)

### Mitigations

- **MIME enforcement strict:** solo `image/jpeg`, `image/png`, `image/webp` (no SVG)
- **Size cap 5MB** validado en Zod y enforced en upload action
- **Filename derivado:** `prizes/{raffleId}-{nanoid(8)}.{ext}` — NUNCA el nombre original del user
- **Vercel Blob serves with proper Content-Type headers** (no `text/html` for images)
- **CSP recomendada:** `img-src 'self' *.public.blob.vercel-storage.com` — restringe origin de imágenes

### Residual risk

Polyglot files (imagen válida que también es JS). Mitigación residual: CSP estricta + no servir imágenes en mismo dominio si fuera posible (Vercel Blob ya está en dominio separado).

### Owner

Dev team

---

## RSK-005 — Replay determinism breaks → seed tampering 🟡

**Category:** Trust / Integrity
**Impact:** 🟡 Medium — si la animación cliente-side NO coincide con `winner_ticket_id` del server, visitante detecta inconsistencia y pierde trust
**Likelihood:** 🟢 Low — `seedToWinner` es función pura unit-tested

### Risk vectors

1. Bug en `seedToWinner` que rompe determinismo (regresión)
2. Sort order de `soldTicketIds` diferente entre server y client → diferente winnerIndex
3. Library de hashing diferente entre runtimes (Node `crypto` vs Web Crypto)

### Mitigations

- **Función pura compartida** `seedToWinner` en `src/lib/draw/` — usada en server y client
- **Unit test de determinismo:** `seedToWinner(seed, ids) === seedToWinner(seed, ids)` (mismo input → mismo output)
- **Sort obligatorio:** `soldTickets ORDER BY tickets.number ASC` en ambos lados (documentado en `06_DATA_MODEL.md`)
- **SHA-256 estándar:** mismo algoritmo en Node `crypto.subtle` y Web Crypto API — verified en `verifyDraw` test
- **E2E-003 verifica end-to-end:** server gana matchea client replay

### Detection

Sentry capture si `verifyDraw` retorna `false` en cliente (anomalía severa)

### Owner

Dev team

---

## RSK-006 — Browser sync filtra tokens al cloud 🟡

**Category:** Security (sub-caso de RSK-002 pero distinto vector)
**Impact:** 🟡 Medium — Chrome / iCloud sync uploads URL history a la nube del vendor
**Likelihood:** 🟡 Medium — default behavior en muchos browsers

### Mitigations en MVP

- **Rotación de tokens** (BR-012) — admin puede invalidar leak detectado
- **Aceptado como residual risk** — sin password no hay cómo evitar history sync

### Recommendation post-MVP

Si paso a producción seria: migrar a magic link (token de uso único + cookie de sesión).

### Owner

Admin operacional

---

## RSK-007 — Neon Postgres outage 🟢

**Category:** Infra
**Impact:** 🟡 Medium — app inutilizable durante outage (5xx en server actions y RSC)
**Likelihood:** 🟢 Low — Neon SLA 99.95% en plan Pro

### Mitigations

- **Vercel Blob serves images sin tocar DB** — vista pública con SW cache (FT-015) sigue mostrando última imagen aunque DB esté caída
- **Sentry alerts** detectan timeout > threshold

### Contingency

- Monitorear Neon status page
- Comunicar al admin si outage > 10min
- No hay rollback útil (no es deploy issue, es infra externa)
- PITR de Neon disponible si data corruption (RB-008)

### Owner

Neon (infra) + Dev team (monitoring)

---

## RSK-008 — Admin error operacional 🟢

**Category:** Human / Operational
**Impact:** 🟡 Medium — admin sortéa antes de tiempo, archiva rifa equivocada, etc.
**Likelihood:** 🟢 Low — flujos tienen confirmaciones

### Mitigations

- **Dialog de confirmación** en acciones destructivas (sortear, archivar, revertir)
- **BR-005 preconditions:** sortéo solo si `drawDate <= now() AND ≥1 sold`
- **BR-010 inmutabilidad:** post-sortéo NO se rompe accidentalmente
- **Runbooks** documentados (`10_RUNBOOKS.md`)
- **AdminAction log** permite forensics

### Recovery

- Mistakes pre-sortéo: revertibles via `revertSale`, `archive` toggle (algunos)
- Mistakes post-sortéo: NO revertibles (BR-010) → comunicación manual con afectados
- Backup PITR si data corruption seria

### Owner

Admin

---

## RSK-009 — Rate limiting ausente 🟢

**Category:** Security / Cost
**Impact:** 🟢 Low — single-org, baja tasa de requests esperada
**Likelihood:** 🟢 Low — sin auth público escaneable, requests no scriptables fácilmente

### Mitigations en MVP

- **Vercel Edge defaults** (no spec'd, pero existe protección contra burst extremos)
- **Sin endpoints públicos POST** — server actions requieren CSRF token Next.js

### Post-MVP

Si MVP escala o se observa abuse: `@upstash/ratelimit` por IP en `/r/*` (lecturas) y por token en `/v/*` (mutations).

### Owner

Dev team (monitor; activar si emerge)

---

## Risk dashboard (vista compacta)

| ID      | Risk                   | Tier                           | Mitigation status                               |
| ------- | ---------------------- | ------------------------------ | ----------------------------------------------- |
| RSK-001 | Doble venta            | 🔴 → 🟢 (mitigated)            | ✅ Atomic UPDATE + E2E test gate                |
| RSK-002 | URL-secret leak        | 🔴 → 🟡 (accepted + mitigated) | ⚠️ Aceptado por usuario; rotación + path tokens |
| RSK-003 | PII expuesta           | 🟡 → 🟢                        | ✅ BR-009 + tipos discriminados                 |
| RSK-004 | Image upload malicious | 🟡 → 🟢                        | ✅ MIME + size + filename derivado              |
| RSK-005 | Replay tampering       | 🟡 → 🟢                        | ✅ Pure function + unit + E2E                   |
| RSK-006 | Browser sync leak      | 🟡 → 🟡                        | ⚠️ Aceptado; rotación como mitigation           |
| RSK-007 | Neon outage            | 🟢                             | ✅ SLA + PITR + monitoring                      |
| RSK-008 | Admin error            | 🟢                             | ✅ Confirms + BR-010 + AdminAction              |
| RSK-009 | Rate limiting          | 🟢                             | ✅ Vercel default; activable post-MVP           |

---

## Risks que NO están acá (out of scope MVP)

| Risk                          | Por qué no                            | Cuándo entra                            |
| ----------------------------- | ------------------------------------- | --------------------------------------- |
| PCI / pagos                   | MVP sin pagos                         | Post-MVP cuando integremos Mercado Pago |
| Multi-tenancy data isolation  | MVP single-tenant                     | Post-MVP SaaS                           |
| Notification abuse / phishing | MVP sin notificaciones                | Post-MVP con email/SMS                  |
| Gambling regulatory           | MVP no es gambling (rifas informales) | Si se monetiza con casino-like features |

---

_13 Risk Register — Rifatela — 9 risks identificados, todos con mitigation o aceptación explícita_
