# 04 — User Stories

> **Proyecto:** Rifatela
> **Source:** [`02_FEATURE_MAP.md`](./02_FEATURE_MAP.md) + [`03_USER_PERSONAS.md`](./03_USER_PERSONAS.md)
> **Estado:** v1.0
> **ID namespace:** `US-XXX`
> **Convención AC:** Gherkin (Given/When/Then) — soporta DoR de SK.md §5

---

## Resumen

| Feature                          | US count | IDs            |
| -------------------------------- | -------- | -------------- |
| FT-001 Admin crea rifa           | 3        | US-001..US-003 |
| FT-002 Admin gestiona vendedores | 3        | US-004..US-006 |
| FT-003 Vendedor login            | 2        | US-007..US-008 |
| FT-004 Registra comprador        | 1        | US-009         |
| FT-005 Asigna número             | 2        | US-010..US-011 |
| FT-006 Concurrency               | 1        | US-012         |
| FT-007 Vista pública             | 3        | US-013..US-015 |
| FT-008 Sorteo                    | 2        | US-016..US-017 |
| FT-009 Replay                    | 1        | US-018         |
| FT-010 Ticket digital            | 1        | US-019         |
| FT-011 Admin revierte            | 2        | US-020..US-021 |
| FT-012 Dashboard métricas        | 2        | US-022..US-023 |
| FT-013 Commit-reveal             | 2        | US-024..US-025 |
| FT-015 PWA (stretch)             | 1        | US-026         |
| FT-016 Sonido (stretch)          | 1        | US-027         |
| **Total**                        | **27**   |                |

> FT-014 (mobile-first) es cross-cutting → AC aparece como condición transversal en US individuales, no como historia separada.

---

## FT-001 — Admin crea rifa

### US-001 — Crear rifa básica

**Como** admin (P-001)
**Quiero** crear una nueva rifa con premio, capacidad y fecha de sorteo
**Para** poder empezar a venderla

**AC:**

```gherkin
Given que estoy autenticado como admin (URL secreta válida)
And estoy en el dashboard
When presiono "+ Nueva Rifa"
And lleno el form con name="Rifa Pro Cole", prize_text="iPhone 15", prize_image (válida), max_tickets=500, draw_date (futuro)
And presiono "Crear"
Then se persiste un Raffle con status='open'
And se genera rng_seed (≥256 bits entropy) server-side
And se persiste seed_commit = sha256(rng_seed)
And se generan 500 tickets con status='available' (numbers 1..500)
And se genera public_slug (nanoid 10)
And me redirige al detalle de la rifa
And la rifa aparece en el dashboard con % vendido = 0
```

- **Component test:** form validation (required fields, draw_date >= now+1h, max_tickets ∈ [1, 10000])
- **E2E:** crear → ver en dashboard → abrir vista pública

### US-002 — Subir imagen del premio

**Como** admin
**Quiero** adjuntar una imagen al premio
**Para** que la vista pública sea visualmente atractiva

**AC:**

```gherkin
Given que estoy creando o editando una rifa
When subo un archivo (JPG/PNG/WebP, <5MB)
Then se sube a Vercel Blob
And se persiste image_url en Prize.image_url
And la imagen aparece en la preview del form
When subo un archivo inválido (>5MB o formato no soportado)
Then se muestra error sin persistir nada
```

- **Component test:** upload con archivo válido + inválido
- **E2E:** opcional — covered en US-001 con imagen

### US-003 — Editar rifa pre-sorteo

**Como** admin
**Quiero** poder corregir nombre/premio/imagen/fecha de una rifa que aún no se sortéo
**Para** arreglar typos o ajustar la fecha si pasa algo

**AC:**

```gherkin
Given una rifa con status='open'
When edito name, prize_text, prize_image, o draw_date
Then se persisten los cambios
And NO se regenera rng_seed (sería romper el commit)
And NO se modifica max_tickets si ya hay tickets vendidos
Given una rifa con status='drawn'
When intento editar cualquier campo
Then la operación falla con error "rifa ya sorteada, inmutable"
```

- **Component test:** form readonly post-sorteo
- **E2E:** editar pre-sorteo + intento de editar post-sorteo

---

## FT-002 — Admin gestiona vendedores

### US-004 — Dar de alta vendedor

**Como** admin
**Quiero** crear un vendedor con su URL única
**Para** poder compartírsela por WhatsApp

**AC:**

```gherkin
Given que estoy en "Gestión de Vendedores"
When presiono "+ Nuevo Vendedor" y escribo "Diego"
Then se crea un Seller con name="Diego" y access_token (nanoid 32)
And aparece en la lista con un botón "Copiar URL"
When copio la URL
Then se copia "{ORIGIN}/v/{access_token}" al clipboard
```

- **Component test:** form + clipboard copy
- **E2E:** crear vendedor + verificar que la URL funciona

### US-005 — Rotar URL del vendedor

**Como** admin
**Quiero** regenerar la URL de un vendedor si se filtra
**Para** invalidar el link viejo sin perder sus ventas

**AC:**

```gherkin
Given un vendedor "Diego" con access_token = "abc123"
When presiono "Rotar URL" y confirmo
Then se genera un nuevo access_token = "xyz789"
And el token "abc123" deja de funcionar (404 en /v/abc123)
And el token "xyz789" funciona y muestra el panel de Diego
And sus ventas históricas (Ticket.seller_id) se preservan
And se registra un AdminAction(action_type='rotate_seller_token', seller_id, details={old_token_hash: ...})
```

- **Component test:** botón con dialog de confirmación
- **E2E:** rotar + intentar acceder con token viejo (404) + acceder con nuevo (200)

### US-006 — Archivar vendedor

**Como** admin
**Quiero** archivar un vendedor que ya no participa
**Para** limpiar la lista sin perder histórico

**AC:**

```gherkin
Given un vendedor activo
When presiono "Archivar" y confirmo
Then se setea archived_at en el Seller
And su access_token deja de funcionar (404)
And sus ventas históricas siguen mostrándose en el dashboard de la rifa
And queda excluido de "lista de vendedores activos" por defecto
And se registra AdminAction(action_type='archive_seller', seller_id)
```

- **Component test:** confirm dialog
- **E2E:** archivar + verificar token dead + ventas históricas visibles

---

## FT-003 — Vendedor login

### US-007 — Entrar como vendedor por URL única

**Como** vendedor (P-002)
**Quiero** abrir mi URL única y entrar directo a mi panel
**Para** no perder tiempo con passwords

**AC:**

```gherkin
Given una URL "/v/{access_token}" con token válido y vendedor NO archivado
When abro la URL en mi celular
Then se crea una session cookie scoped a seller_id
And se me muestra el panel de venta del primer rifa activa
Given una URL con token inválido o vendedor archivado
When abro la URL
Then se muestra una página 404 (sin filtrar info: mismo error en ambos casos)
```

- **Component test:** middleware de validación de token
- **E2E:** URL válida → panel, URL inválida → 404

### US-008 — Selector de rifa si hay múltiples activas

**Como** vendedor
**Quiero** elegir en qué rifa vendo si hay varias abiertas
**Para** no confundirme entre rifas concurrentes

**AC:**

```gherkin
Given múltiples rifas con status='open'
When entro como vendedor
Then veo un selector de rifa activa (default: la más reciente)
When cambio de rifa
Then la grilla y el form se actualizan al contexto de la rifa seleccionada
```

- **Component test:** selector + state sync
- **E2E:** crear 2 rifas + login vendedor + cambiar entre rifas

---

## FT-004 — Registra comprador

### US-009 — Registrar comprador con datos opcionales

**Como** vendedor
**Quiero** registrar a un comprador con tan poca o tanta info como necesite
**Para** no frenar la venta si el comprador no quiere dar datos

**AC:**

```gherkin
Given que estoy en el panel de venta
When lleno el form con solo name="Juan" (sin phone, sin email)
And presiono "Registrar comprador"
Then se crea un Buyer(name="Juan", phone=null, email=null)
And el form se queda listo para asignar número
When lleno el form completamente vacío
And presiono "Registrar comprador"
Then se crea un Buyer con todos los campos null (comprador anónimo)
When ingreso un email con formato inválido
Then se muestra error de validación y no se persiste
```

- **Component test:** form con validación condicional (email format if not empty)
- **E2E:** registrar buyer con name solo / completamente vacío

---

## FT-005 — Asigna número

### US-010 — Asignar número disponible al comprador

**Como** vendedor
**Quiero** tocar un número en la grilla y asignárselo al comprador recién registrado
**Para** cerrar la venta en 1 tap

**AC:**

```gherkin
Given que registré un buyer y estoy en la grilla
When toco un número con status='available' (ej. 47)
Then se ejecuta UPDATE atómico (BR-002)
And rowCount==1 → ticket 47 pasa a status='sold' con buyer_id, seller_id, sold_at=NOW()
And se muestra pantalla "Ticket digital" (US-019)
And la grilla refresca con 47 marcado como vendido
```

- **Component test:** click handler + estado local
- **E2E:** crítico — registrar buyer + tocar número + verificar persistencia

### US-011 — UI clara de números disponibles vs vendidos

**Como** vendedor
**Quiero** distinguir de un vistazo qué números puedo vender
**Para** no perder tiempo intentando vender uno ya tomado

**AC:**

```gherkin
Given una rifa con max_tickets=100, 30 vendidos
When abro la grilla en mi celular (375px)
Then veo 100 celdas tipo grid responsive
And las 30 vendidas muestran las iniciales del comprador (ej. "47 — J.P." o "12 — Anón.")
And las 70 disponibles son tocables (cursor pointer en desktop, tap target ≥44px en mobile)
And están visualmente diferenciadas (color + estado)
```

- **Component test:** render con dataset mixto
- **Visual regression:** 375px / 768px / 1280px

---

## FT-006 — Concurrency

### US-012 — Concurrency: dos vendedores tocan el mismo número

**Como** vendedor
**Quiero** que el sistema impida que dos vendedores vendan el mismo número simultáneamente
**Para** no tener doble-venta

**AC:**

```gherkin
Given el ticket #47 está available
And vendedor A y vendedor B tocan #47 dentro de 100ms uno del otro
When ambos requests llegan al server
Then el primer UPDATE atómico tiene rowCount=1 (gana A)
And el segundo UPDATE tiene rowCount=0 → server responde 409 Conflict
And el vendedor B ve toast "Ese número ya se vendió, elegí otro"
And la grilla de B se refresca mostrando #47 como vendido
And no hay doble Ticket persistido para #47
```

- **Unit test:** función `claimTicket(...)` con mock de UPDATE conflict
- **E2E con concurrency:** disparar 2 requests con Promise.all → solo uno persiste
- **CRÍTICO:** este test es no-negociable, valida el invariant central del producto

---

## FT-007 — Vista pública

### US-013 — Visitante abre URL pública y ve estado de la rifa

**Como** visitante (P-003)
**Quiero** ver la rifa completa sin login
**Para** decidir si compro

**AC:**

```gherkin
Given una rifa con status='open' y public_slug='abc123xyz'
When abro "/r/abc123xyz" en mi celular
Then veo:
  - Hero con name, prize_text, prize_image
  - Countdown grande hacia draw_date (refresca client-side cada 1s)
  - Grilla de números con disponibles vs vendidos (iniciales en vendidos)
  - Footer con seed_commit visible + link "Cómo se verifica este sorteo"
And LCP ≤ 2.5s (Core Web Vitals)
And NO veo botones que requieran auth (no hay "vender" ni "editar")
```

- **Component test:** render con datos mock
- **E2E:** crear rifa + abrir vista pública + verificar todos los elementos
- **Performance:** Lighthouse en CI (≥90 mobile)

### US-014 — Vista pública con todos los números vendidos

**Como** visitante
**Quiero** seguir viendo la rifa aunque ya esté agotada
**Para** ver el countdown y esperar el sorteo

**AC:**

```gherkin
Given rifa con sold_count == max_tickets, draw_date futuro
When abro la URL pública
Then veo la grilla con todos vendidos (iniciales en c/u)
And veo un banner "Boletos agotados — sorteo en {countdown}"
And el countdown sigue corriendo
And NO hay botón "comprar" ni similar
```

- **E2E:** vender los 100/100 + verificar banner

### US-015 — Vista pública de rifa archivada (link viejo no se rompe)

**Como** visitante con un link de hace 6 meses
**Quiero** que la URL pública siga abriendo aunque la rifa esté archivada
**Para** poder mostrar el resultado histórico

**AC:**

```gherkin
Given una rifa con status='drawn' y archived_at != null
When abro su URL pública
Then veo el resultado del sorteo (ganador + animación replay disponible)
And la rifa NO aparece en el dashboard del admin por defecto (BR-015)
```

- **E2E:** archivar rifa + abrir URL pública → 200 OK con resultado

---

## FT-008 — Sorteo

### US-016 — Ejecutar sorteo en o después de draw_date

**Como** admin
**Quiero** ejecutar el sorteo cuando la fecha llegó
**Para** elegir al ganador y publicar el resultado

**AC:**

```gherkin
Given una rifa con status='open' y draw_date ya pasó
And al menos 1 ticket vendido
When abro el panel de sorteo y presiono "Ejecutar Sorteo"
Then se selecciona aleatoriamente UN ticket entre los vendidos
And usa rng_seed (revelado en este momento) como input determinista
And se persiste winner_ticket_id, drawn_at, status='drawn'
And se muestra la animación de la rueda en mi pantalla
And cualquier visitante que entre ahora ve el replay determinista
Given una rifa con draw_date NO llegado
When intento ejecutar el sorteo
Then la operación falla con error "todavía no es la fecha"
Given una rifa con 0 tickets vendidos
When intento ejecutar el sorteo
Then la operación falla con error "no hay tickets vendidos para sortear"
```

- **Unit test:** selección determinista con seed fijo + lista de tickets
- **E2E crítico:** crear rifa + vender + esperar draw_date (o mockearla) + ejecutar sorteo

### US-017 — Sorteo no se puede ejecutar dos veces

**Como** sistema (invariant)
**Quiero** garantizar que el sorteo se ejecuta una sola vez por rifa
**Para** preservar la inmutabilidad del resultado (BR-010)

**AC:**

```gherkin
Given una rifa con status='drawn'
When intento ejecutar el sorteo nuevamente
Then la operación falla con error "rifa ya sorteada"
And winner_ticket_id NO cambia
And rng_seed NO cambia
And drawn_at NO cambia
```

- **Unit test:** función `executeDraw(...)` con rifa ya en `drawn`
- **E2E:** doble click en "sortear" → solo persiste 1 vez

---

## FT-009 — Replay

### US-018 — Visitante ve replay determinista post-sorteo

**Como** visitante que entra a la rifa después del sorteo
**Quiero** ver la animación de la rueda como si estuviera en vivo
**Para** vivir la experiencia del sorteo

**AC:**

```gherkin
Given una rifa con status='drawn' y rng_seed revelado
When abro la URL pública
Then la animación de la rueda se reproduce automáticamente (o con botón "Reproducir")
And la rueda gira y aterriza en el ticket ganador (determinista por rng_seed)
And el resultado final coincide con winner_ticket_id (CRÍTICO — invariant de replay)
And puedo re-reproducir la animación cuantas veces quiera
```

- **Unit test crítico:** función `seedToWinner(seed, soldTickets[])` produce el mismo output dado el mismo input
- **E2E:** ejecutar sorteo + abrir vista pública en otro browser → replay coincide

---

## FT-010 — Ticket digital

### US-019 — Vendedor comparte ticket digital al comprador

**Como** vendedor
**Quiero** mandarle al comprador algo que diga "tenés el N°47"
**Para** que tenga prueba y no se olvide

**AC:**

```gherkin
Given que acabo de asignar el ticket #47 a Juan
When la pantalla "Ticket digital" aparece
Then veo una card visual con:
  - name="Rifa Pro Cole"
  - prize_text + thumbnail prize_image
  - "Tu número: 47"
  - "Vendido por: Diego"
  - "Sorteo: 31 mayo 2026 20:00"
  - QR o link "/r/{public_slug}" para ver estado de la rifa
And tengo un botón "Compartir" que invoca Web Share API (native share sheet en mobile)
When presiono "Compartir"
Then se abre el share sheet con texto + link
```

- **Component test:** render del ticket con datos
- **E2E:** vender + verificar pantalla del ticket + share button presente

---

## FT-011 — Admin revierte

### US-020 — Admin libera un ticket vendido por error

**Como** admin
**Quiero** poder "deshacer" una venta mal asignada
**Para** corregir errores del vendedor (BR-011)

**AC:**

```gherkin
Given un ticket #47 con status='sold', buyer_id=B1, seller_id=S1
And la rifa está en status='open' (NO sorteada)
When voy a "Detalle de Rifa" → tabla de tickets vendidos
And presiono "Revertir" en el ticket #47 y confirmo con razón opcional
Then el ticket pasa a status='available', buyer_id=null, seller_id=null, sold_at=null
And se registra AdminAction(action_type='revert_sale', ticket_id, raffle_id, details={reason, prev_buyer_id, prev_seller_id})
And el Buyer B1 NO se borra (puede tener otros tickets)
And el dashboard refresca con el ticket disponible nuevamente
Given un ticket en una rifa con status='drawn'
When intento revertir
Then la operación falla con error "rifa ya sorteada, inmutable"
```

- **Component test:** dialog de confirmación + form de razón
- **E2E crítico:** vender + revertir + verificar que el número está disponible

### US-021 — Vendedor NO puede revertir su propia venta

**Como** vendedor
**Quiero NO** tener la capacidad de revertir (intencional)
**Para** que la integridad operativa quede en el admin

**AC:**

```gherkin
Given que soy vendedor (logueado por URL)
When veo el panel de venta
Then NO existe ningún botón "deshacer", "revertir" o "editar venta"
And si intento llamar el endpoint directamente (POST /api/actions/revert-sale)
Then el server responde 403 (no es admin)
```

- **Unit test:** server action `revertSale` verifica rol admin
- **E2E:** vendedor no ve botón + intento programático → 403

---

## FT-012 — Dashboard métricas

### US-022 — Admin ve dashboard con métricas resumen por rifa

**Como** admin
**Quiero** ver de un vistazo el estado de todas mis rifas
**Para** decidir cuál atender

**AC:**

```gherkin
Given que entro al dashboard como admin
And existen 3 rifas (1 draft, 1 open, 1 drawn)
When la página carga
Then veo una card/fila por rifa con:
  - name
  - status badge (draft/open/drawn)
  - % vendido (sold_count / max_tickets)
  - días restantes hasta draw_date (negativo si pasó)
  - total vendedores activos
  - total tickets vendidos
And puedo ordenar por fecha de creación / draw_date / % vendido
And tengo toggle "incluir archivadas" (default off)
```

- **Component test:** dashboard con 0, 1, N rifas + filtros
- **E2E:** crear varias rifas + verificar métricas correctas

### US-023 — Dashboard refresca al volver de otra vista

**Como** admin
**Quiero** que las métricas estén frescas cuando vuelvo al dashboard
**Para** no ver datos obsoletos

**AC:**

```gherkin
Given que estoy en el dashboard
When entro al detalle de una rifa, vendo (vía vendedor en otra pestaña), y vuelvo
Then las métricas reflejan el estado actual (revalidatePath o equivalente Next.js)
And no veo % vendido stale
```

- **E2E:** simular venta en otro contexto + volver a dashboard

---

## FT-013 — Commit-reveal

### US-024 — Visitante ve seed_commit pre-sorteo

**Como** visitante
**Quiero** ver el hash del seed antes del sorteo
**Para** saber que el resultado no se puede manipular post-hoc

**AC:**

```gherkin
Given una rifa con status='open'
When abro su URL pública
Then en el footer veo "Compromiso criptográfico: {seed_commit_hex}" (truncado, copiable)
And hay un link "Cómo se verifica este sorteo" → modal explicativo
```

- **Component test:** render footer con seed_commit
- **E2E:** crear rifa + abrir vista pública + verificar presencia

### US-025 — Visitante verifica sorteo post-hoc

**Como** visitante después del sorteo
**Quiero** validar que el seed revelado matchea el commit publicado
**Para** confiar en el resultado

**AC:**

```gherkin
Given una rifa con status='drawn'
And seed_commit publicado pre-sorteo + rng_seed revelado en sorteo
When abro la vista pública y presiono "Verificar este sorteo"
Then el cliente calcula sha256(rng_seed) usando Web Crypto API
And compara con seed_commit
And muestra:
  - ✅ "Verificado: el sorteo no fue manipulado" si matchea
  - ❌ "Hash NO matchea: contactar al organizador" si no matchea (caso paranoia, debería ser imposible)
And el botón muestra el cálculo (transparencia: hash esperado vs hash calculado)
```

- **Unit test crítico:** sha256(seed) === commit (Web Crypto API)
- **E2E:** ejecutar sorteo + abrir vista pública + presionar verificar → ✅

---

## FT-015 — PWA (stretch)

### US-026 — Instalar Rifatela como PWA

**Como** visitante o vendedor
**Quiero** instalar Rifatela como app en mi celular
**Para** abrirla desde un icono nativo

**AC:**

```gherkin
Given que abro Rifatela en Chrome/Safari mobile
When la página ha sido visitada >= 1 vez
Then el browser ofrece "Instalar app" (banner nativo)
When acepto
Then aparece icono Rifatela en home screen
And al abrirlo, se abre en standalone mode (sin URL bar)
And la vista pública funciona offline (último snapshot cached por SW)
And rutas con token NO se cachean (privacidad)
```

- **Lighthouse PWA audit:** ≥90
- **E2E:** simular install prompt (Chrome DevTools)

---

## FT-016 — Sonido (stretch)

### US-027 — Sonido en sorteo con toggle mute

**Como** admin o visitante viendo el sorteo
**Quiero** escuchar sonidos en la animación
**Para** sentir el momento

**AC:**

```gherkin
Given que la animación del sorteo se está reproduciendo
When la rueda gira
Then se reproduce un tick-tick (Web Audio API o <audio>)
When la rueda se detiene en el ganador
Then se reproduce una fanfarria
And hay un toggle "🔇/🔊" persistido en localStorage
When toggleo mute
Then los sonidos se silencian inmediatamente y la preferencia persiste
```

- **Component test:** mock Web Audio API + toggle state
- **E2E manual:** verificar audio (no testeable automáticamente sin headphones lab)

---

_04 User Stories — Rifatela — 27 US con AC Gherkin + test layer por story_
