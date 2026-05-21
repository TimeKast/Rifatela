# 12 — E2E Scenarios

> **Proyecto:** Rifatela
> **Source:** [`11_TEST_STRATEGY.md`](./11_TEST_STRATEGY.md) §3
> **Estado:** v1.0
> **Runner:** Playwright (per `SK.md §4.2`)

---

## Conventions

- **ID:** `E2E-XXX`
- **Setup:** cada escenario empieza con DB reset + seed específico
- **Tags:** `@critical` (no-deploy gate), `@important`, `@nice-to-have`
- **Viewport:** mobile (375×667) por defecto para flows de vendedor / pública; desktop (1280×800) para admin

---

## E2E-001 — Admin crea rifa + abre vista pública @critical

**Source:** FT-001, FT-007 — flujo end-to-end básico

### Setup

- DB limpia
- 1 admin con `ADMIN_ACCESS_TOKEN` configurado

### Steps

1. **Given** admin navega a `/admin/{adminToken}`
2. **And** ve el dashboard vacío con CTA "Crear primera rifa"
3. **When** presiona "+ Nueva Rifa"
4. **And** llena el form:
   - name = "Rifa Test Cole"
   - prizeText = "iPhone 15 128GB"
   - prizeImage = (upload `tests/fixtures/iphone.jpg`)
   - maxTickets = 100
   - drawDate = ahora + 7 días
5. **And** presiona "Crear"
6. **Then** la URL cambia a `/admin/{adminToken}/raffles/{newId}`
7. **And** ve la rifa creada con status `open`, 0/100 vendidos
8. **And** existe `public_slug` con botón "Copiar URL pública"

### Steps adicionales (vista pública)

9. **When** copia el slug y navega a `/r/{publicSlug}` (en otro context/incognito)
10. **Then** ve el hero con "Rifa Test Cole", imagen del iPhone, premio texto
11. **And** ve countdown contando hacia draw_date
12. **And** ve grilla con 100 números, todos disponibles
13. **And** en el footer ve "Compromiso criptográfico: {seedCommit hex truncado}"
14. **And** NO ve botones de admin ni de vendedor (sin auth)

### Assertions DB

```sql
SELECT count(*) FROM raffles;         -- 1
SELECT count(*) FROM prizes;          -- 1
SELECT count(*) FROM tickets;         -- 100 (todos available)
SELECT seed_commit, rng_seed FROM raffles;  -- seed_commit != null, rng_seed != null pero NO en response
```

---

## E2E-002 — Vendedor vende ticket @critical

**Source:** FT-003, FT-004, FT-005, FT-010

### Setup

- 1 rifa `open`, 100 tickets disponibles
- 1 vendedor "Diego" creado con accessToken

### Steps

1. **Given** Diego navega a `/v/{diegoToken}` en su celular (viewport 375)
2. **Then** ve la pantalla "Panel de Venta" con la rifa activa y la grilla
3. **When** llena el form: name = "Marta", phone = "+541199999"
4. **And** presiona "Registrar comprador"
5. **Then** se persiste un Buyer y el form se queda listo
6. **When** toca el ticket número 47 en la grilla
7. **Then** ve la pantalla "Ticket digital" con:
   - "Tu número: **47**"
   - "Marta"
   - Premio + imagen
   - QR / link a vista pública
   - Botón "Compartir"
8. **And** al volver a la grilla, el 47 aparece marcado como vendido con iniciales "M."

### Assertions DB

```sql
SELECT status, buyer_id, seller_id FROM tickets WHERE number=47;  -- 'sold', notNull, notNull
SELECT count(*) FROM tickets WHERE status='sold';                 -- 1
```

---

## E2E-002b — CONCURRENCY RACE @critical (LA JOYA)

**Source:** FT-006, BR-002 — invariant central del producto

### Setup

- 1 rifa con `maxTickets=1` (un solo ticket disponible, número 1)
- 2 vendedores: Diego (A) y María (B)

### Steps

1. **Given** dos browser contexts abren en paralelo:
   - `pageA` → `/v/{diegoToken}`
   - `pageB` → `/v/{mariaToken}`
2. **When** ambos registran un buyer (en paralelo OK)
3. **And** ambos disparan `pageX.click('[data-ticket-number="1"]')` con `Promise.all`
4. **Then** **exactamente uno** ve la pantalla "Ticket digital"
5. **And** el otro ve un toast con texto "ya se vendió" / similar
6. **And** la grilla del perdedor refresca mostrando el #1 como vendido

### Assertions DB (las más importantes de toda la suite)

```sql
SELECT count(*) FROM tickets WHERE number=1 AND status='sold';   -- 1 (NO 2)
SELECT count(*) FROM buyers;                                      -- 2 (ambos buyers se crearon, OK)
SELECT count(*) FROM tickets WHERE number=1 AND buyer_id NOT NULL; -- 1
```

### Playwright skeleton

```ts
test('E2E-002b concurrency race', async ({ browser }) => {
  const raffle = await setupRaffle({ maxTickets: 1 });
  const [diegoToken, mariaToken] = await setupSellers(['Diego', 'María']);

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  await pageA.goto(`/v/${diegoToken}`);
  await pageB.goto(`/v/${mariaToken}`);

  await registerBuyer(pageA, { name: 'A' });
  await registerBuyer(pageB, { name: 'B' });

  // Click en paralelo — el test es no determinista en quién gana,
  // pero determinista en que SOLO UNO gana.
  await Promise.all([pageA.click('[data-ticket="t-1"]'), pageB.click('[data-ticket="t-1"]')]);

  // Una de las dos páginas muestra "Ticket digital", la otra el toast
  const aSuccess = await pageA
    .locator('[data-testid="ticket-digital"]')
    .isVisible({ timeout: 3000 })
    .catch(() => false);
  const bSuccess = await pageB
    .locator('[data-testid="ticket-digital"]')
    .isVisible({ timeout: 3000 })
    .catch(() => false);

  expect([aSuccess, bSuccess]).toEqual(expect.arrayContaining([true, false]));

  // DB verifica invariant
  const sold = await db.select().from(tickets).where(eq(tickets.raffleId, raffle.id));
  expect(sold.filter((t) => t.status === 'sold')).toHaveLength(1);
});
```

> Este test se ejecuta en CI **en cada PR**. Si falla, el deploy queda bloqueado. Es la línea roja del producto.

---

## E2E-003 — Sorteo end-to-end con replay verificable @critical

**Source:** FT-008, FT-009, FT-013, BR-004, BR-005, BR-006

### Setup

- 1 rifa con `maxTickets=10`, 5 tickets vendidos
- `drawDate` mockeada al pasado (o esperar real)
- Admin token configurado

### Steps (Acto 1 — Pre-sorteo público verifica commit)

1. **Given** visitante abre `/r/{publicSlug}` antes del sorteo
2. **Then** ve `seedCommit` truncado en footer
3. **And** ve el link "¿Cómo se verifica este sorteo?" → abre modal explicativo
4. **And** NO ve `rngSeed` en ningún lado (DB ni response)

### Steps (Acto 2 — Admin ejecuta)

5. **When** admin va a `/admin/{adminToken}/raffles/{raffleId}`
6. **Then** ve la sección "Panel de Sorteo" (porque drawDate <= now)
7. **When** presiona "Ejecutar Sorteo" y confirma
8. **Then** la pantalla muestra la animación de la rueda girando
9. **And** después de ~3s, la rueda se detiene en un número específico
10. **And** ve "Ganador: número {N} — {nombreBuyer}"

### Steps (Acto 3 — Visitante post-sorteo verifica)

11. **When** visitante (otro browser/incognito) abre `/r/{publicSlug}` post-sorteo
12. **Then** ve el resultado con el mismo ganador
13. **And** la animación de la rueda se reproduce automáticamente
14. **And** el número final coincide con el de admin (replay determinista)
15. **When** presiona "Verificar este sorteo"
16. **Then** el cliente ejecuta `sha256(rngSeed)` con Web Crypto API
17. **And** muestra ✅ "Verificado: el sorteo no fue manipulado"
18. **And** muestra el hash calculado igual al `seedCommit`

### Assertions DB

```sql
SELECT status, winner_ticket_id, drawn_at, rng_seed FROM raffles WHERE id='{id}';
-- status='drawn', winner_ticket_id NOT NULL, drawn_at NOT NULL, rng_seed NOT NULL (revelado)
```

### Assertions adicionales

- `seedToWinner(rngSeed, soldIds) === winnerTicketId` (determinismo)
- `sha256(rngSeed) === seedCommit` (commit-reveal valid)

---

## E2E-004 — Admin revierte venta @critical

**Source:** FT-011, BR-010, BR-011

### Setup

- 1 rifa `open`, ticket #47 vendido a buyer "Juan" por seller "Diego"

### Steps

1. **Given** admin va a `/admin/{adminToken}/raffles/{raffleId}`
2. **Then** ve la tabla de tickets con #47 marcado como vendido
3. **When** presiona "Revertir" en el #47
4. **And** escribe razón "Confusión con el comprador real" y confirma
5. **Then** el ticket pasa a `available` en la grilla pública
6. **And** se ve un mensaje "Venta revertida"
7. **And** en "Historial de Acciones" aparece la entrada con tipo `revert_sale`

### Assertions DB

```sql
SELECT status, buyer_id, seller_id, sold_at FROM tickets WHERE number=47;
-- 'available', NULL, NULL, NULL

SELECT count(*) FROM admin_actions WHERE action_type='revert_sale';  -- 1
SELECT details FROM admin_actions WHERE action_type='revert_sale';
-- { reason: 'Confusión...', prevBuyerId: '...', prevSellerId: '...' }

SELECT count(*) FROM buyers WHERE id='{prevBuyerId}';  -- 1 (no se borró)
```

### Negative (US-021)

- Llamar `revertSale(...)` desde context vendedor (con sellerToken cookie) → 403 Forbidden
- Llamar `revertSale(...)` sobre rifa drawn → 409 `raffle_immutable`

---

## E2E-005 — Vendedor archivado → token muere @important

**Source:** FT-002, BR-013

### Setup

- Vendedor "Marta" creada con accessToken `xyz123`
- 1 venta histórica de Marta

### Steps

1. **Given** admin va a Gestión de Vendedores
2. **When** archiva a Marta y confirma
3. **Then** Marta desaparece del listado "activos"
4. **When** alguien (Marta, o quien sea con su URL) navega a `/v/xyz123`
5. **Then** ve 404 (no se filtra info que la cuenta existe pero está archivada)
6. **And** en `/admin/{adminToken}/raffles/{id}` la venta histórica de Marta sigue mostrando "Marta" como vendedora

### Assertions DB

```sql
SELECT archived_at FROM sellers WHERE id='marta_id';  -- NOT NULL
SELECT count(*) FROM tickets WHERE seller_id='marta_id';  -- 1 (preservada)
```

---

## E2E-006 — Sorteo no se puede ejecutar dos veces @critical

**Source:** FT-008, BR-005, BR-010

### Setup

- 1 rifa ya en `status='drawn'`, ganador persistido

### Steps

1. **Given** admin va a `/admin/{adminToken}/raffles/{drawnRaffleId}`
2. **Then** NO ve botón "Ejecutar Sorteo" (la rifa ya está sorteada)
3. **When** envía request POST directo a `executeDraw({ raffleId })`
4. **Then** recibe error `code='already_drawn'`
5. **And** los campos `winner_ticket_id`, `rng_seed`, `drawn_at` NO cambiaron

### Assertions DB

```sql
-- snapshot pre/post sorteo intent
SELECT winner_ticket_id, rng_seed, drawn_at FROM raffles WHERE id='{id}';
-- Debe ser idéntico al snapshot pre-intent
```

---

## E2E-007 — Rotar URL del vendedor @important

**Source:** FT-002, BR-012

### Setup

- Vendedor "Diego" con accessToken `abc123`

### Steps

1. **Given** admin va a Gestión de Vendedores → Diego
2. **When** presiona "Rotar URL" y confirma
3. **Then** ve la nueva URL `/v/{newToken}` con botón copiar
4. **When** alguien navega a la URL vieja `/v/abc123`
5. **Then** ve 404
6. **When** Diego navega a la URL nueva
7. **Then** entra normal al panel + sus ventas históricas se preservan

### Assertions DB

```sql
SELECT access_token FROM sellers WHERE id='diego_id';  -- != 'abc123', es nanoid(32)
SELECT count(*) FROM admin_actions WHERE action_type='rotate_seller_token' AND seller_id='diego_id';  -- 1
SELECT details FROM admin_actions WHERE action_type='rotate_seller_token';
-- { oldTokenHash: sha256('abc123') }  ← old token NO en plain
```

---

## E2E-008 — Rifa archivada: URL pública sigue funcionando @important

**Source:** FT-007, BR-015

### Setup

- 1 rifa drawn, archivada hace 30 días, con winner y rngSeed revelado

### Steps

1. **Given** visitante recibe link viejo de WhatsApp `/r/{publicSlug}`
2. **When** lo abre
3. **Then** ve la rifa con resultado del sorteo (ganador + replay disponible)
4. **And** puede verificar el commit-reveal (✅)
5. **When** admin va al dashboard
6. **Then** NO ve la rifa archivada por default
7. **When** activa toggle "incluir archivadas"
8. **Then** SÍ la ve, con badge "archivada"

---

## E2E-009 — Buyer registrado sin datos (anónimo) @important

**Source:** FT-004, BR-008, BR-009

### Setup

- 1 rifa `open`, 1 vendedor

### Steps

1. **Given** vendedor en panel de venta
2. **When** presiona "Registrar comprador" con TODOS los campos vacíos
3. **Then** se crea un Buyer con name=null, phone=null, email=null
4. **When** asigna ticket #5 a ese buyer
5. **Then** la grilla pública muestra #5 con "Anónimo" en vez de iniciales
6. **And** el ticket digital del vendedor muestra "Sin nombre" en lugar de nombre

---

## E2E-010 — Lighthouse audit vista pública ≥ 90 @important

**Source:** FT-007 + performance budget de `07_ARCHITECTURE.md`

### Setup

- Rifa con imagen optimizada, 100 tickets, 30 vendidos

### Steps

1. Build production: `pnpm build && pnpm start`
2. Run Lighthouse CI sobre `/r/{publicSlug}` (3 runs)
3. Assert:
   - Performance ≥ 85 (mobile)
   - Accessibility ≥ 90
   - Best Practices ≥ 90
   - LCP ≤ 2.5s

---

## Stretch — E2E para features SHOULD

### E2E-S01 — PWA install prompt (FT-015) @nice-to-have

- Simular install via Chrome DevTools (`window.dispatchEvent('beforeinstallprompt')`)
- Verificar manifest + service worker registered
- Verificar offline cache de `/r/{publicSlug}` (intercept fetch, devuelve cached)

### E2E-S02 — Sonido en sorteo con mute persistente (FT-016) @nice-to-have

- Manual test (audio no testeable headless reliably)
- Verify localStorage flag `rifatela.muted` persiste

---

## Test data: builders compartidos

Ver `tests/fixtures/builders.ts` (definido en `11_TEST_STRATEGY.md §6`).

---

## Tags y CI gates

| Tag             | CI gate                                                    |
| --------------- | ---------------------------------------------------------- |
| `@critical`     | E2E-001..004, 002b, 006 — block deploy si falla cualquiera |
| `@important`    | E2E-005, 007, 008, 009, 010 — warn, no block               |
| `@nice-to-have` | Stretch E2E — run manual o nightly                         |

```bash
# CI
pnpm test:e2e --grep @critical    # must pass
pnpm test:e2e --grep @important   # should pass

# Pre-deploy completo
pnpm test:e2e
```

---

_12 E2E Scenarios — Rifatela — 10 escenarios principales + 2 stretch, tagged por criticidad_
