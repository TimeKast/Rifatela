# 15 — Design Specification

> **Proyecto:** Rifatela
> **Source:** [`00_DISCOVERY_BRIEF.md`](./00_DISCOVERY_BRIEF.md) §9 (Branding) + §11 (Visual Direction); [`03_USER_PERSONAS.md`](./03_USER_PERSONAS.md); [`04_USER_STORIES.md`](./04_USER_STORIES.md); [`07_ARCHITECTURE.md`](./07_ARCHITECTURE.md) routing
> **Estado:** v1.0
> **Output target:** `15_DESIGN.md` (este doc)
> **ID namespace:** `SCR-XXX` (screens) · `FLW-XXX` (flows) · `CMP-XXX` (components) · `DD-XXX` (decisions)
> **Mode:** Legacy fallback — visual direction extraída de Brief §9+§11 (justificado: el contenido del `/design-brief` ya está en `00_DISCOVERY_BRIEF.md`, no se reabre).

---

# § 0 — Visual Direction

## 0.1 Source citation

| Decisión         | Fuente                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Skin / vibe      | Brief §11 — "Carnaval / feria / festivo" (`Confirmed` F27)                               |
| Premium level    | Brief §11 — "medio: festivo y divertido, no minimalista premium ni excesivamente kitsch" |
| Color palette    | Brief §11 — `[RECOMMENDED]` rojo carpa + amarillo dorado + azul cobalto + crema          |
| Tipografía       | Brief §11 — `[RECOMMENDED]` Bungee/Alfa Slab One/Lobster/Fredoka One + Inter/Geist Sans  |
| Animación sorteo | Brief §11 + F27 — rueda de la fortuna con motion blur + confetti                         |
| Countdown        | Brief §11 — números pulsantes o flip-cards retro                                         |
| Voice            | Brief §9 — festivo, abierto, casual                                                      |
| Audiencia        | Brief §9 — organizadores informales (clubes, escuelas, asociaciones)                     |

## 0.2 Skin family — "Carnaval Festivo"

| Atributo      | Valor                                                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Family name   | `carnaval-festivo` (custom, no del catálogo standard del factory)                                                                 |
| Whitelabel    | N/A — single-tenant (R-1 brand)                                                                                                   |
| Profile       | `festive-medium`                                                                                                                  |
| Variance      | `medium` (un poco de chispa visual sin caer en kitsch)                                                                            |
| Motion        | `rich` (rueda spin, confetti, flip cards) → degrada con `prefers-reduced-motion`                                                  |
| Density       | `comfortable` en cards/formularios; `dense` en ticket grid (max info útil)                                                        |
| Accessibility | WCAG AA target · Lighthouse a11y ≥ 90 · contrast ≥ 4.5:1 body, ≥ 3:1 large text                                                   |
| Dark mode     | **NO en MVP** — paleta carnaval depende de saturación alta sobre crema; un dark mode necesita re-balance significativo (post-MVP) |

## 0.3 Color tokens

| Token                   | Light value                       | Uso                                    |
| ----------------------- | --------------------------------- | -------------------------------------- |
| `--color-bg`            | `#FFF8E7` (crema cálido)          | Background page                        |
| `--color-bg-elevated`   | `#FFFFFF`                         | Cards, modals                          |
| `--color-fg`            | `#1A0F2E` (deep purple-black)     | Texto body                             |
| `--color-fg-muted`      | `#5C4D6E`                         | Texto secundario / labels              |
| `--color-fg-subtle`     | `#9B8FAB`                         | Disabled / placeholder                 |
| `--color-primary`       | `#D7263D` (rojo carpa)            | CTAs, badges destacados, header accent |
| `--color-primary-hover` | `#B81E33`                         | Hover state                            |
| `--color-primary-fg`    | `#FFFFFF`                         | Texto sobre primary                    |
| `--color-accent`        | `#F4B400` (amarillo dorado feria) | Highlights, premio badge, ganador      |
| `--color-accent-fg`     | `#1A0F2E`                         | Texto sobre accent (dark on yellow)    |
| `--color-secondary`     | `#1E5BFF` (azul cobalto)          | Links, info states, vendedor badge     |
| `--color-success`       | `#16A34A`                         | Ticket vendido, verify ✅              |
| `--color-warning`       | `#F59E0B`                         | Banner countdown final                 |
| `--color-danger`        | `#B91C1C`                         | Errores, verify ❌, revert action      |
| `--color-border`        | `#E5D9C0`                         | Bordes neutros sobre crema             |
| `--color-border-strong` | `#1A0F2E20`                       | Bordes en estados focused              |

### Ticket states palette (en `<TicketGrid>`)

| State                   | bg                    | fg        | border                          |
| ----------------------- | --------------------- | --------- | ------------------------------- |
| Available               | `#FFFFFF`             | `#1A0F2E` | `#D7263D40` (rojo carpa al 25%) |
| Available hover         | `#FFF1F3`             | `#D7263D` | `#D7263D`                       |
| Sold                    | `#1E5BFF15` (azul 8%) | `#1E5BFF` | `#1E5BFF40`                     |
| Sold (winner highlight) | `#F4B400`             | `#1A0F2E` | `#D7263D` (3px)                 |
| Disabled (post-drawn)   | `#F5F0E0`             | `#9B8FAB` | `#E5D9C0`                       |

## 0.4 Typography

### Stack

| Token                | Font                 | Fallback                                           | Uso                                                |
| -------------------- | -------------------- | -------------------------------------------------- | -------------------------------------------------- |
| `--font-display`     | **Bungee**           | `'Fredoka One', system-ui, sans-serif`             | H1 hero rifa, número ganador grande, countdown     |
| `--font-display-alt` | **Alfa Slab One**    | (= display fallback)                               | H2/H3 admin sections                               |
| `--font-body`        | **Inter** (variable) | `system-ui, -apple-system, 'Segoe UI', sans-serif` | Body, forms, tables, UI chrome                     |
| `--font-mono`        | **JetBrains Mono**   | `'Courier New', monospace`                         | `seed_commit` hash, ticket numbers in admin tables |

> Bungee es la única tipografía display "obligatoria" para el feel carnaval. Si fuente no carga (offline), fallback a Fredoka One mantiene el vibe.

### Scale (mobile baseline, escala con `clamp()` para responsive)

| Token            | Mobile                    | Desktop | Uso                              |
| ---------------- | ------------------------- | ------- | -------------------------------- |
| `--text-xs`      | 11px                      | 12px    | Captions, microcopy, footer      |
| `--text-sm`      | 13px                      | 14px    | Body secondary, table cells      |
| `--text-base`    | 15px                      | 16px    | Body, form inputs                |
| `--text-lg`      | 17px                      | 18px    | Lead paragraphs                  |
| `--text-xl`      | 20px                      | 24px    | H3 / card titles                 |
| `--text-2xl`     | 24px                      | 32px    | H2 / section heads               |
| `--text-3xl`     | 32px                      | 48px    | H1 / page titles                 |
| `--text-display` | `clamp(48px, 12vw, 96px)` | (same)  | Countdown digits, número ganador |
| `--text-hero`    | `clamp(36px, 8vw, 64px)`  | (same)  | Prize text en landing pública    |

### Line-height

- Display fonts: `1.1`
- Body Inter: `1.5`
- Tight body (cards, tables): `1.35`

## 0.5 Spacing scale (Tailwind-compatible)

`--space-0` = 0 · `--space-1` = 4px · `--space-2` = 8px · `--space-3` = 12px · `--space-4` = 16px · `--space-5` = 20px · `--space-6` = 24px · `--space-8` = 32px · `--space-10` = 40px · `--space-12` = 48px · `--space-16` = 64px

> Sigue convención Tailwind. Targeting consistencia con starter kit `kb-tokens`.

## 0.6 Radius / shadow / elevation

| Token              | Valor                                                  | Uso                                     |
| ------------------ | ------------------------------------------------------ | --------------------------------------- |
| `--radius-sm`      | 6px                                                    | Inputs, small buttons                   |
| `--radius-md`      | 10px                                                   | Cards, tickets en grid                  |
| `--radius-lg`      | 16px                                                   | Modals, large cards                     |
| `--radius-full`    | 9999px                                                 | Pills, avatars, badges                  |
| `--shadow-sm`      | `0 1px 2px rgba(26, 15, 46, 0.08)`                     | Cards default                           |
| `--shadow-md`      | `0 4px 12px rgba(26, 15, 46, 0.12)`                    | Cards hover, dropdowns                  |
| `--shadow-lg`      | `0 16px 40px rgba(26, 15, 46, 0.18)`                   | Modals                                  |
| `--shadow-festive` | `0 6px 0 #D7263D, 0 12px 24px rgba(215, 38, 61, 0.25)` | Hero CTAs (drop-shadow tipo neón feria) |

## 0.7 Iconography

- **Set principal:** Lucide React (incluido en kit)
- **Custom assets:** ticket, rueda de la fortuna, confetti shapes — SVGs propios en `src/assets/icons/rifatela/`
- **Estilo:** stroke 1.75px, geometría redondeada, sin gradientes
- **Tamaños:** 16/20/24/32px (alineados con type scale)

## 0.8 Motion language

| Animation            | Duration | Easing                             | Notes                                     |
| -------------------- | -------- | ---------------------------------- | ----------------------------------------- |
| Page transitions     | 200ms    | `ease-out`                         | Soft, no flashy                           |
| Toast appearance     | 180ms    | `cubic-bezier(0.2, 0.9, 0.3, 1.2)` | Tiny overshoot (festive)                  |
| Ticket sold flip     | 320ms    | `ease-in-out`                      | Flip-card 3D al asignarse                 |
| Countdown digit flip | 600ms    | `cubic-bezier(0.4, 0, 0.2, 1)`     | Estilo split-flap retro                   |
| **Draw wheel spin**  | 4s       | `cubic-bezier(0.2, 0.95, 0.05, 1)` | Decelera con suspense — params en CMP-004 |
| Confetti burst       | 1.2s     | particle physics                   | Solo post-reveal del ganador              |
| Verify ✅/❌ flip    | 300ms    | `ease-out`                         | Card flip al verificar commit             |

**Reduced-motion fallback (`prefers-reduced-motion: reduce`):**

- Wheel: fade-in del ganador directo, sin spin
- Confetti: opacity-only highlight (no partículas)
- Countdown: digit replacement sin flip
- Page transitions: instant

## 0.9 Voice & microcopy guidelines

| Tone vector               | Aplicar                                   | NO aplicar                               |
| ------------------------- | ----------------------------------------- | ---------------------------------------- |
| Festivo                   | "¡Listo! Tu rifa está al aire 🎪"         | "Operation completed successfully."      |
| Abierto                   | "Cualquiera puede sumarse al sorteo"      | "Authorized users only"                  |
| Casual                    | "Diego, sumá un comprador"                | "Estimado Sr. Diego, por favor proceda…" |
| **NO emojis excesivos**   | 1 por línea max, solo en estados de éxito | 🎉🎊🎈 todo el tiempo                    |
| **NO argentinismo voseo** | "vendé" → "vende"; "tenés" → "tienes"     | (alineado con `CORE.md §2`)              |
| **NO copy genérico**      | "Cargá la primera rifa de la temporada"   | "No data available"                      |

---

# § 1 — Screen Inventory

11 screens MVP. Cada uno traza a 1+ User Stories y 1+ Features.

| ID      | Screen                    | Persona                   | Audiencia            | URL pattern                                     | FT                             | US                     | Wireframe |
| ------- | ------------------------- | ------------------------- | -------------------- | ----------------------------------------------- | ------------------------------ | ---------------------- | --------- |
| SCR-001 | Admin Dashboard           | P-001                     | Admin                | `/admin/{token}`                                | FT-001, FT-012                 | US-022, US-023         | §9.1      |
| SCR-002 | Admin: Create/Edit Raffle | P-001                     | Admin                | `/admin/{token}/raffles/new` o `/.../{id}/edit` | FT-001                         | US-001, US-002, US-003 | §9.2      |
| SCR-003 | Admin: Raffle Detail      | P-001                     | Admin                | `/admin/{token}/raffles/{id}`                   | FT-001, FT-011, FT-012         | US-003, US-020         | §9.3      |
| SCR-004 | Admin: Draw Panel         | P-001                     | Admin                | `/admin/{token}/raffles/{id}/draw`              | FT-008                         | US-016, US-017         | §9.4      |
| SCR-005 | Admin: Sellers Management | P-001                     | Admin                | `/admin/{token}/sellers`                        | FT-002                         | US-004, US-005, US-006 | §9.5      |
| SCR-006 | Vendedor: Panel de Venta  | P-002                     | Vendedor             | `/v/{accessToken}`                              | FT-003, FT-004, FT-005, FT-006 | US-007..US-012         | §9.6      |
| SCR-007 | Vendedor: Ticket Digital  | P-002 → comprador externo | Vendedor / Comprador | `/v/{accessToken}/ticket/{ticketId}`            | FT-010                         | US-019                 | §9.7      |
| SCR-008 | Pública: Landing (open)   | P-003                     | Visitante            | `/r/{publicSlug}`                               | FT-007, FT-013                 | US-013, US-014, US-024 | §9.8      |
| SCR-009 | Pública: Landing (drawn)  | P-003                     | Visitante            | `/r/{publicSlug}`                               | FT-009, FT-013                 | US-015, US-018, US-025 | §9.9      |
| SCR-010 | Pública: Verify Draw      | P-003                     | Visitante            | `/r/{publicSlug}/verify`                        | FT-013                         | US-025                 | §9.10     |
| SCR-011 | Error / 404               | All                       | All                  | \*                                              | —                              | (cross-cutting)        | §9.11     |

### Cobertura

- **27 user stories** del doc 04 → mapeadas a 11 screens (matriz al final, §coverage)
- **16 features (incl. stretch)** → todas representadas (FT-014 mobile-first es cross-cutting; FT-015/016 stretch documentadas pero no son screens propias)
- **3 personas** → todas tienen screens primarias (P-001 admin: 5 screens; P-002 vendedor: 2; P-003 público: 3)

---

# § 2 — Flow Definitions

8 flows cubren los user journeys principales.

## FLW-001 — Admin crea su primera rifa

**Persona:** P-001 Carla
**Trigger:** Carla abre `/admin/{token}` por primera vez y ve dashboard vacío

```
1. SCR-001 Dashboard (estado empty) — CTA "Crear primera rifa"
2. SCR-002 Form crear rifa — Carla llena name, prize_text, sube imagen, max_tickets, draw_date
3. SCR-002 Submit → POST createRaffle()
4. (background) server genera rng_seed, calcula seed_commit, crea raffle + prize + N tickets bulk
5. SCR-003 Raffle Detail (recién creada) — Carla ve "0 / N vendidos", botón "Ver vista pública"
6. Carla copia URL pública desde SCR-003 y la comparte por WhatsApp
```

**Coverage:** US-001, US-002, FT-001

## FLW-002 — Admin agrega y gestiona vendedores

**Persona:** P-001 Carla

```
1. SCR-001 → menú "Vendedores"
2. SCR-005 Sellers Management (estado empty) — CTA "Agregar primer vendedor"
3. Modal/drawer "+ Nuevo Vendedor" → Carla escribe "Diego"
4. POST createSeller() → response trae access_token + URL
5. SCR-005 Lista actualizada con Diego + botón "Copiar URL"
6. Carla copia y pega a Diego por WhatsApp
7. (más tarde) Carla rota URL: SCR-005 → row Diego → "Rotar URL" → confirm dialog → nueva URL
8. (eventualmente) Carla archiva a Diego al cerrar la rifa: row Diego → "Archivar" → confirm
```

**Coverage:** US-004, US-005, US-006, FT-002

## FLW-003 — Vendedor vende ticket (happy path)

**Persona:** P-002 Diego

```
1. Diego recibe URL `/v/abc123` por WhatsApp, abre en su celular
2. SCR-006 Panel de Venta — middleware valida token → directo al panel (sin login)
3. Diego ve la rifa activa + grilla de 100 números (95 disponibles, 5 vendidos)
4. Cliente Marta le dice "quiero el 47"
5. Diego llena form: name="Marta", phone="11999..."
6. Diego presiona "Registrar comprador" → POST registerBuyer → response con buyer_id
7. Diego toca el número 47 en la grilla
8. POST claimTicket → atomic UPDATE → success
9. Transición animada: card del ticket 47 hace flip a "vendido" + grilla refresca
10. SCR-007 Ticket Digital aparece — Diego comparte por WhatsApp via Web Share
11. Diego vuelve a SCR-006 — form limpio, grilla con 47 marcado azul
```

**Coverage:** US-007, US-009, US-010, US-011, US-019, FT-003, FT-004, FT-005, FT-010

## FLW-004 — Sad path: race condition concurrency

**Persona:** P-002 Diego (perdedor del race)

```
1. Diego en SCR-006, María en SCR-006 (otro dispositivo)
2. Ambos registraron buyers diferentes
3. Cliente A (Diego) y Cliente B (María) ambos pidieron el #47
4. Diego toca #47 a las 14:30:00.100
5. María toca #47 a las 14:30:00.120
6. POST claimTicket de María → atomic UPDATE rowCount=1 → ✅ ticket digital
7. POST claimTicket de Diego → atomic UPDATE rowCount=0 → 409 ConflictError
8. SCR-006 (Diego) → toast aparece desde arriba: "Ese número ya se vendió, elegí otro"
9. Grilla auto-refresh: #47 ahora muestra "M." (iniciales de María) en azul
10. Diego ve el cambio, le dice a su cliente "el 47 está tomado, ¿elegís el 48?"
```

**Coverage:** US-012, FT-006, BR-002

## FLW-005 — Sorteo end-to-end (con replay público)

**Persona:** P-001 Carla (ejecuta) + P-003 visitantes

```
PRE-SORTEO (cualquier momento desde 'open')
  Visitante abre /r/{slug} → SCR-008
    Ve seed_commit truncado en footer
    Click "¿Cómo se verifica este sorteo?" → modal explicativo

EJECUCIÓN
  1. Llegó draw_date. Carla abre SCR-003 Raffle Detail
  2. Ve sección "Panel de Sorteo" habilitada → click "Ejecutar Sorteo"
  3. SCR-004 Draw Panel con countdown "3, 2, 1, ¡SORTEO!"
  4. Server: POST executeDraw → seedToWinner(rng_seed, soldIds) → persiste winner + reveal rng_seed
  5. Animación rueda gira 4s, decelera, aterriza en ganador
  6. Reveal del ganador: confetti burst + número ganador en display font 96px

POST-SORTEO (visitante entra)
  Visitante abre /r/{slug} → SCR-009 Landing (drawn)
  Animación rueda se reproduce auto (replay determinista — mismo rng_seed, mismo ganador)
  Sección "Verificar este sorteo" visible → click → SCR-010 → ✅ "sha256(seed) == commit"
```

**Coverage:** US-016, US-017, US-018, US-024, US-025, FT-008, FT-009, FT-013

## FLW-006 — Admin revierte venta

**Persona:** P-001 Carla
**Trigger:** Diego le avisa por WhatsApp que se equivocó de número

```
1. SCR-001 Dashboard → click rifa afectada
2. SCR-003 Raffle Detail → scroll a tabla de tickets vendidos
3. Carla busca el ticket #47 (filter por número o por seller "Diego")
4. Click "Revertir" en la fila → dialog de confirmación
5. Carla escribe razón "Diego se equivocó, debía ser el 48" (opcional)
6. Confirm → POST revertSale
7. Tabla actualiza: ticket #47 desaparece de "vendidos", aparece en "disponibles"
8. Histórico de acciones (footer SCR-003) muestra entrada nueva con timestamp + razón
9. Carla avisa a Diego "ya está, podés cargar el 48"
```

**Coverage:** US-020, US-021, FT-011

## FLW-007 — Visitante verifica sorteo

**Persona:** P-003 Marta visitante

```
1. Marta abre /r/{slug} post-sorteo → SCR-009 Landing (drawn)
2. Ve ganador (no es ella). Scroll a "¿Quieres verificar el sorteo?"
3. Click botón "Verificar este sorteo" → SCR-010 Verify Draw
4. SCR-010 muestra:
   - Hash publicado pre-sorteo: {seed_commit truncado}
   - Seed revelado: {rng_seed truncado}
   - Hash calculado en este dispositivo: (computing... → result)
5. Web Crypto API ejecuta sha256(rng_seed) cliente-side
6. Compara con seed_commit → ✅ verde "Verificado: el sorteo no fue manipulado"
7. Marta cierra con tranquilidad
```

**Coverage:** US-025, FT-013

## FLW-008 — Visitante intenta entrar a rifa archivada con link viejo

**Persona:** P-003

```
1. Marta tiene un link de hace 8 meses, lo abre
2. /r/{slug} → server resuelve raffle con archived_at != null → render normal (BR-015)
3. SCR-009 Landing (drawn) → resultado histórico visible + replay funciona
4. (Admin no la ve en dashboard porque está archivada — BR-015)
```

**Coverage:** US-015, FT-007, BR-015

---

# § 3 — Navigation Architecture

## 3.1 Sitemap por rol

```
ADMIN (P-001) — shell sidebar en desktop, drawer hamburger en mobile
  /admin/{token}
    ├── Dashboard (SCR-001)                ← home
    ├── Rifas                              ← seccion
    │   ├── /raffles/new       (SCR-002)
    │   ├── /raffles/{id}      (SCR-003)
    │   ├── /raffles/{id}/edit (SCR-002 variant)
    │   └── /raffles/{id}/draw (SCR-004)
    └── Vendedores
        └── /sellers           (SCR-005)

VENDEDOR (P-002) — shell minimal, single-purpose
  /v/{accessToken}
    ├── Panel de Venta (SCR-006)           ← landing
    └── /ticket/{ticketId} (SCR-007)       ← post-venta

VISITANTE (P-003) — shell ninguna, página standalone
  /r/{publicSlug}                          ← SCR-008 (open) or SCR-009 (drawn)
    └── /verify (SCR-010)                  ← page o modal

GLOBAL
  /404 (SCR-011)
```

## 3.2 Patterns de navegación por shell

| Shell              | Layout                                 | Navegación primaria                                                       | Mobile transformation                                          |
| ------------------ | -------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Admin shell**    | Sidebar fija 240px + content fluido    | Sidebar items: Dashboard, Rifas, Vendedores                               | Drawer top-down con hamburger; bottom bar de 3 items en mobile |
| **Vendedor shell** | Header sticky 56px + grilla full-width | Header: nombre vendedor, dropdown si hay múltiples rifas activas, "Salir" | (same — ya es mobile-first)                                    |
| **Pública shell**  | Hero full-width + content sections     | Sin nav (single-page) — solo scroll + un "Verificar" anchor               | (same — ya es mobile-first)                                    |

## 3.3 Back behavior

- Admin shell: breadcrumbs persistentes en mobile (`Dashboard / Rifa Test / Detalle`)
- Vendedor: no breadcrumbs (1-nivel), "Cerrar ticket" en SCR-007 vuelve a SCR-006
- Pública: no back persistente — visitante usa el back del browser
- Modal closures: ESC + click outside + botón ✕

## 3.4 Estados sin token / unauthorized

- `/admin/` sin token o token inválido → **404** (no 401) — no filtra info (per BR-013 logic)
- `/v/{wrongToken}` → 404
- `/r/{wrongSlug}` → 404

> Misma política para "vendedor archivado" vs "token inexistente": ambos retornan 404 idéntico (no filtra status).

---

# § 4 — Component Catalog

15 components MVP. Cada uno con props clave + states + responsive notes.

| ID      | Component                              | Variants                                                  | Usado en                           |
| ------- | -------------------------------------- | --------------------------------------------------------- | ---------------------------------- |
| CMP-001 | `<RaffleCard>`                         | dashboard / detail-header                                 | SCR-001, SCR-003                   |
| CMP-002 | `<TicketGrid>`                         | vendor (interactive) / public (read-only) / admin-detail  | SCR-006, SCR-008, SCR-009, SCR-003 |
| CMP-003 | `<Countdown>`                          | hero (display font) / inline (text-base)                  | SCR-008, SCR-001, SCR-003, SCR-004 |
| CMP-004 | `<DrawWheel>`                          | live (animated) / replay (deterministic) / reduced-motion | SCR-004, SCR-009                   |
| CMP-005 | `<BuyerForm>`                          | inline-creation                                           | SCR-006                            |
| CMP-006 | `<PrizeImageUpload>`                   | empty / preview / error                                   | SCR-002                            |
| CMP-007 | `<TicketDigitalCard>`                  | shareable (Web Share) / static (fallback)                 | SCR-007                            |
| CMP-008 | `<SellerCard>`                         | active / archived / copy-mode                             | SCR-005                            |
| CMP-009 | `<ConfirmDialog>`                      | destructive / informative / with-reason-input             | All admin actions                  |
| CMP-010 | `<CommitRevealBadge>`                  | pre-draw (commit only) / post-draw (commit + seed)        | SCR-008, SCR-009, SCR-010          |
| CMP-011 | `<VerifyDrawButton>`                   | idle / computing / success ✅ / failure ❌                | SCR-009, SCR-010                   |
| CMP-012 | `<AdminActionLog>`                     | timeline / collapsed                                      | SCR-003                            |
| CMP-013 | `<SeedCommitDisplay>`                  | truncated (8 chars) / full (64 chars) / mono              | SCR-008, SCR-009, SCR-010, footers |
| CMP-014 | `<ShareSheet>` (wrapper Web Share API) | native / fallback (copy link)                             | SCR-007                            |
| CMP-015 | `<EmptyState>`                         | dashboard-empty / sellers-empty / no-results / error      | SCR-001, SCR-005, SCR-011          |

## 4.1 CMP-001 — `<RaffleCard>`

**Props:**

```ts
type RaffleCardProps = {
  raffle: { id; name; status; drawDate; soldCount; maxTickets; prizeImage? };
  variant: 'dashboard' | 'detail-header';
  href?: string; // wraps en Link
};
```

**States visuales:**

- `status='open'` → border crema, badge verde "Abierta"
- `status='drawn'` → border amarillo dorado, badge "Sorteada · ganador #N"
- `archived_at` → opacity 0.65, badge gris "Archivada"
- `% vendido ≥ 90` → barra de progreso en rojo (urgencia)
- `días restantes ≤ 1` → countdown en pulse animation

**Responsive:**

- Mobile: full-width, stack vertical (image top, info below)
- Desktop: grid 3 cols, image lateral 30%

## 4.2 CMP-002 — `<TicketGrid>` ⭐ CRÍTICO

**Props:**

```ts
type TicketGridProps = {
  tickets: Array<{
    id;
    number;
    status: 'available' | 'sold';
    buyerInitials?;
    isWinner?: boolean;
  }>;
  variant: 'vendor' | 'public' | 'admin-detail';
  onTicketClick?: (id) => void; // solo en variant='vendor'
  winnerTicketId?: string;
};
```

**Density:**

- Mobile 375px: 5 cols × N rows, tap target 44×44px (DD-004), gap 6px
- Tablet 768px: 8 cols
- Desktop ≥ 1024px: 10-12 cols

**Estados visuales:** ver tabla §0.3 "Ticket states palette"

**Variant=vendor:**

- Available → tappable, hover rojo carpa
- Sold → muestra iniciales en mono font, no tappable
- Loading state (durante claim): spinner overlay 200ms timeout

**Variant=public:**

- Disabled tap (no interactivity)
- Sold con iniciales (de buyer)
- Winner: highlight amarillo con confetti micro-animation perpetua

**Variant=admin-detail:**

- Sold: click → opens revert dialog
- Tooltip con nombre completo de buyer al hover (admin tiene acceso)

**Accessibility:**

- Cada ticket es `<button>` (vendor) o `<div role="cell">` (public)
- `aria-label="Boleto número 47, vendido a J.P."`
- Keyboard nav: arrow keys mueven entre tickets

## 4.3 CMP-003 — `<Countdown>`

**Props:**

```ts
type CountdownProps = {
  drawDate: Date;
  variant: 'hero' | 'inline';
  onComplete?: () => void; // dispara cuando llega a 0
};
```

**Visual:**

- `variant='hero'`: display font 96px, 4 grupos (días, horas, min, seg), flip-card animation per second
- `variant='inline'`: text-base, format "2d 14h 32m 15s"

**Edge cases:**

- `drawDate` ya pasó → muestra "Sorteo en curso" (hero) o "Sorteo pendiente" (inline)
- `prefers-reduced-motion` → digit replacement sin flip

**Implementation:**

- `setInterval` cliente-side 1s, no polling al server
- Fix para hidratación SSR: render placeholder server-side, calcula real en `useEffect`

## 4.4 CMP-004 — `<DrawWheel>` ⭐ CRÍTICO

**Props:**

```ts
type DrawWheelProps = {
  rngSeed: string;
  soldTickets: Array<{ id; number; buyerInitials }>;
  winnerTicketId: string;
  mode: 'live' | 'replay';
  onComplete?: () => void;
};
```

**Visual:**

- SVG circle dividido en N segments = soldTickets.length
- Cada segment con color rotativo de paleta (rojo / amarillo / azul / crema)
- Pointer triangle apuntando desde arriba
- Center disc con logo Rifatela
- Confetti container overlaid

**Animation (mode='live' o 'replay'):**

- Pre-spin (300ms): wheel scale 0.95 → 1.0 con pulse
- Spin (4000ms): rotation easing `cubic-bezier(0.2, 0.95, 0.05, 1)` → desacelera natural
- Total rotation = `360 * 8 + (segmentAngle * winnerIndex)` (8 full turns + ángulo al ganador)
- Stop: pointer apunta al segment ganador
- Reveal (600ms after stop): winnerSegment escala 1.15x con glow amarillo
- Confetti burst (1200ms): 80 partículas físicas

**Determinismo:**

- `winnerIndex` y `rngSeed` son entrada — la animación es función pura → replay reproducible
- Sin random interno

**Reduced-motion fallback:**

- Sin spin: fade-in del segment ganador directo
- Sin confetti partículas: solo highlight estático + texto "🎉" (único emoji excepcional permitido aquí)

**Accessibility:**

- Live region `aria-live="polite"` anuncia "Ganador: número 47, Juan P."
- Spin no es trapping focus — usuario puede salir con ESC

## 4.5 CMP-005 — `<BuyerForm>`

**Props:**

```ts
type BuyerFormProps = {
  onSubmit: (data: { name?; phone?; email? }) => Promise<{ buyerId }>;
};
```

**Fields:**

- `name` (text, opcional, max 80 chars)
- `phone` (tel, opcional, sin format validation per BR-008)
- `email` (email, opcional, format-validated por Zod solo si presente)

**States:**

- Idle, validating, submitting, success (form clears + toast)
- Error per-field con mensaje user-facing en español neutro

**Layout:**

- Mobile: stack vertical, inputs 100% width, height 44px, font-size 16px (evita zoom iOS)
- Submit button: primary, sticky bottom en mobile

## 4.6 CMP-006 — `<PrizeImageUpload>`

**Props:**

```ts
type PrizeImageUploadProps = {
  initialUrl?: string;
  onUpload: (file: File) => Promise<{ url: string }>;
  maxSizeMB?: number; // default 5
  acceptedTypes?: string[]; // default ['image/jpeg', 'image/png', 'image/webp']
};
```

**States:**

- Empty: dashed border + icon + "Subir foto del premio (max 5MB)"
- Preview: thumbnail + botón "Cambiar"
- Uploading: spinner + progress bar
- Error: red border + mensaje "Imagen muy grande / formato no soportado"

**Drag-and-drop:** habilitado en desktop, fallback button en mobile

## 4.7 CMP-007 — `<TicketDigitalCard>`

Card visual diseñada para WhatsApp share (PNG-renderable). Ver wireframe SCR-007.

**Props:**

```ts
type TicketDigitalCardProps = {
  ticket: { number };
  raffle: { name; drawDate; publicSlug };
  prize: { text; imageUrl? };
  seller: { name };
  buyer: { name? };
};
```

**Visual:**

- Card 9:16 aspect ratio (vertical, share-friendly)
- Hero con prize image
- Número grande (display font 96px) centered
- Footer con QR code → `/r/{publicSlug}`
- Branded carnaval

**Share:**

- Web Share API con `{ title, text, url }`
- Fallback (browsers sin Web Share): botón "Copiar link"

## 4.8 CMP-008 — `<SellerCard>`

**Props:**

```ts
type SellerCardProps = {
  seller: { id; name; salesCount; accessToken; archivedAt };
  onCopy: () => void;
  onRotate: () => void;
  onArchive: () => void;
};
```

**Variants:**

- Active: muestra URL (con ojo toggle visible/hidden), botones Copiar / Rotar / Archivar
- Archived: opacity 0.5, badge "Archivado", solo muestra ventas históricas
- Copy-mode (post-create o post-rotate): banner verde con URL nueva resaltada

## 4.9 CMP-009 — `<ConfirmDialog>`

**Props:**

```ts
type ConfirmDialogProps = {
  title: string;
  description: string;
  variant: 'destructive' | 'informative';
  reasonInput?: { label: string; required?: boolean };
  confirmLabel: string;
  onConfirm: (data?: { reason?: string }) => Promise<void>;
};
```

**Visual:**

- `variant='destructive'`: confirm button rojo carpa, copy "Esta acción no se puede deshacer si la rifa ya se sorteó"
- `variant='informative'`: confirm button primary normal

**Layout:**

- Modal centered, max-width 480px
- Mobile: full-screen sheet bottom-up

**Usos:** revert sale, rotate seller token, archive seller/raffle, execute draw

## 4.10 CMP-010 — `<CommitRevealBadge>` + 4.11 CMP-011 — `<VerifyDrawButton>` + 4.13 CMP-013 — `<SeedCommitDisplay>`

Trio coordinado para FT-013 verification. Ver detalle en wireframe SCR-010.

**`<CommitRevealBadge>`:** pequeño chip "🔒 Sorteo verificable" con tooltip explicativo.

**`<VerifyDrawButton>`:**

```ts
type VerifyDrawButtonProps = {
  seedCommit: string;
  rngSeed: string | null; // null pre-sorteo → button disabled
};
```

- Pre-sorteo: disabled, copy "Se podrá verificar después del sorteo"
- Post-sorteo idle: primary button "Verificar este sorteo"
- Computing: spinner + "Calculando hash..."
- Success: card verde con ✅ + "El sorteo no fue manipulado"
- Failure (improbable): card roja con ❌ + "Hash NO coincide — contactar al organizador"

**`<SeedCommitDisplay>`:** mono font, 8 chars + "..." + 8 chars, click para expandir, copy button.

## 4.12 CMP-012 — `<AdminActionLog>`

Timeline vertical de `AdminAction` entries en SCR-003.

**Props:**

```ts
type AdminActionLogProps = {
  actions: Array<{ id; actionType; createdAt; details }>;
};
```

**Visual:**

- Timeline vertical con dot connector
- Cada entry: timestamp relativo ("hace 2h"), action type con icon, expandible para ver `details`
- Estado vacío: "Sin acciones administrativas aún"

## 4.14 CMP-014 — `<ShareSheet>`

Wrapper de `navigator.share()`. Fallback a copy-link cuando Web Share API no disponible (desktop browsers, navegadores legacy).

```ts
type ShareSheetProps = {
  title: string;
  text: string;
  url: string;
  fallbackCopyLabel?: string;
};
```

## 4.15 CMP-015 — `<EmptyState>`

**Variants:**

- `dashboard-empty`: ilustración rueda + "Carga tu primera rifa" + CTA
- `sellers-empty`: "Aún no tienes vendedores. Agrega uno para empezar a vender."
- `no-results`: "No encontramos rifas con ese filtro" (cuando filter activo)
- `error`: "Algo no salió bien" + botón "Reintentar"

**Layout:**

- Centrado vertical en su container
- Ilustración SVG 200×200px
- Copy festivo, no genérico

---

# § 5 — Form Specifications

## 5.1 Form patterns globales

| Pattern              | Detalle                                                       |
| -------------------- | ------------------------------------------------------------- |
| **Label position**   | Arriba del input (mobile-friendly, no overlap con keyboard)   |
| **Input height**     | 44px mínimo (DD-004 tap target)                               |
| **Input font-size**  | 16px (evita zoom iOS al focus)                                |
| **Required marker**  | Solo en campos required: `*` rojo después del label           |
| **Error display**    | Inline debajo del input, rojo, icon ⚠️                        |
| **Help text**        | Gris muted, debajo del input antes del error                  |
| **Disabled state**   | Opacity 0.5, no pointer events                                |
| **Submit button**    | Primary CTA, sticky bottom en mobile cuando form > 1 viewport |
| **Success feedback** | Toast desde arriba 3s + redirect o form clear                 |
| **Loading**          | Botón cambia a "Guardando..." con spinner, inputs disabled    |

## 5.2 Create Raffle Form (SCR-002)

| Field       | Type           | Required | Validation                  | Notes                                |
| ----------- | -------------- | -------- | --------------------------- | ------------------------------------ |
| name        | text           | ✅       | 3-120 chars                 | Placeholder: "Rifa Pro Cole"         |
| prize_text  | text           | ✅       | 3-500 chars                 | Multi-line allowed (Textarea)        |
| prize_image | file           | ❌       | <5MB, image/{jpeg,png,webp} | CMP-006                              |
| max_tickets | number         | ✅       | 1-10000 integer             | Stepper buttons (-/+ 10/100)         |
| draw_date   | datetime-local | ✅       | > now + 1h                  | Custom picker desktop, native mobile |

**Submit behavior:** disabled hasta que campos required estén válidos.

## 5.3 Edit Raffle Form (SCR-002 variant)

Mismo schema que Create, pero:

- Si `sold_count > 0` → `max_tickets` field disabled (no se puede reducir)
- Si `status='drawn'` → todo el form readonly (BR-010), banner "Rifa sorteada, no editable"

## 5.4 Buyer Form (SCR-006 inline)

| Field | Type  | Required | Validation                |
| ----- | ----- | -------- | ------------------------- |
| name  | text  | ❌       | max 80 chars              |
| phone | tel   | ❌       | sin format check (BR-008) |
| email | email | ❌       | format si presente        |

**Edge case:** los 3 vacíos → submit OK, crea buyer anónimo (BR-008).

## 5.5 Create Seller Form (SCR-005 modal)

| Field | Type | Required | Validation |
| ----- | ---- | -------- | ---------- |
| name  | text | ✅       | 3-80 chars |

Output: response con URL + botón "Copiar".

## 5.6 Confirm Reason Inputs (CMP-009 with reasonInput)

| Action              | Reason field | Required                   |
| ------------------- | ------------ | -------------------------- |
| Revert sale         | ✅           | No (opcional, recomendado) |
| Archive raffle      | ✅           | No                         |
| Archive seller      | ✅           | No                         |
| Rotate seller token | ❌           | n/a                        |
| Execute draw        | ❌           | n/a (no es destructive)    |

---

# § 6 — Data Display Patterns

## 6.1 Dashboard cards (SCR-001)

- Grid responsive: 1 col mobile, 2 cols tablet, 3 cols desktop
- Card `<RaffleCard variant="dashboard">`
- Empty state cuando 0 rifas
- Filter pills: "Activas" (default) / "Todas" / "Archivadas"

## 6.2 Tickets table (SCR-003 admin detail)

| Col         | Tipo     | Sortable | Visibility                     |
| ----------- | -------- | -------- | ------------------------------ |
| #           | numeric  | ✅       | always                         |
| Comprador   | text     | ✅       | always                         |
| Vendedor    | text     | ✅       | desktop only (mobile: tooltip) |
| Fecha venta | datetime | ✅       | desktop only                   |
| Acciones    | buttons  | —        | always                         |

**Filters:** by seller name, by buyer name (search), by status (sold/available)
**Pagination:** virtualized si >100 tickets; paginated 50 por página default

## 6.3 Public ticket grid (SCR-008, SCR-009)

- `<TicketGrid variant="public">` — read-only
- 5 cols mobile (44px tap targets), 10-12 cols desktop
- Indicador visible al top: "47 vendidos · 53 disponibles"
- Search/jump-to-number en desktop (mobile: scroll natural)

## 6.4 Sellers list (SCR-005)

- Card-based en mobile, table en desktop
- `<SellerCard>` mobile; row table desktop
- Métricas por vendedor: total ventas, % del total
- Sort by: nombre, ventas (desc default), fecha alta

## 6.5 Loading states (skeleton patterns)

| Element        | Skeleton                          |
| -------------- | --------------------------------- |
| `<RaffleCard>` | shimmer block 200×120px           |
| `<TicketGrid>` | shimmer cells del tamaño del grid |
| `<Countdown>`  | placeholder "—:—:—:—"             |
| Tablas         | 5 filas shimmer                   |

**Don't:** spinners largos sin contexto. Skeleton siempre que se sepa la shape final.

## 6.6 Empty states (per `<EmptyState>`)

| Contexto                  | Copy                                                                         | CTA                    |
| ------------------------- | ---------------------------------------------------------------------------- | ---------------------- |
| Dashboard empty (0 rifas) | "Aún no tienes rifas. Crea la primera y compártela en tu grupo de WhatsApp." | "Crear rifa" → SCR-002 |
| Sellers empty             | "Aún no hay vendedores. Agrega gente que te ayude a vender."                 | "Agregar vendedor"     |
| No results filter         | "No hay rifas archivadas todavía."                                           | "Volver a activas"     |
| Error generic             | "Algo no salió como esperábamos."                                            | "Reintentar"           |

---

# § 7 — Design Decisions (DD-XXX)

## DD-001 — Color palette concreta (hex codes)

**Decision:** Adoptar la paleta concreta en §0.3, mappeada a CSS variables `--color-*`.
**Rationale:** Brief §11 dio paleta recomendada en lenguaje natural. Concretarla en hex permite tokens reutilizables (per `kb-tokens`) y validable en CI.
**Trade-off:** Si después se hace user testing y el rojo carpa parece agresivo, el cambio es de 1 token (low-cost).

## DD-002 — Typography stack: Bungee + Inter

**Decision:** Bungee como única display font obligatoria; Alfa Slab One como secondary display; Inter para body; JetBrains Mono para hash/numéricos técnicos.
**Rationale:** Bungee captura el vibe feria/carnaval mejor que las alternativas (Lobster es más cursive-bakery, Fredoka es más kid-friendly). Inter es estándar legible. Mono diferencia datos técnicos (`seed_commit`) de UI prose.
**Trade-off:** 4 fuentes web cargadas = ~120KB. Mitigación: `font-display: swap` + preload de Bungee y Inter (las 2 críticas).

## DD-003 — Spacing scale: Tailwind-compatible

**Decision:** Usar la escala spacing de Tailwind (4/8/12/16/24/32/...).
**Rationale:** Stack ya incluye Tailwind v4. Mantener tokens consistentes evita re-aprendizaje y permite reuso de utility classes.
**Trade-off:** Ninguno — es el default sensato.

## DD-004 — Tap target mínimo 44×44px (mobile)

**Decision:** Todos los elementos interactivos en mobile (375px+) tienen tap target ≥ 44×44px.
**Rationale:** Apple HIG estándar; soporta usuarios con motricidad fina reducida; en `<TicketGrid>` permite 5 cols por viewport con padding cómodo.
**Trade-off:** 5 cols mobile vs 6-7 sería más densidad — pero la fatigue de tap pequeño es peor UX que scroll. User aceptó default 44 en checkpoint.

## DD-005 — Mobile-first 375px baseline

**Decision:** Diseño y desarrollo arrancan en 375px (iPhone SE) y escalan up.
**Rationale:** SK.md §3.2 (política TimeKast durable) + brief F21 multi-device + audiencia P-002/P-003 mayoritariamente mobile.
**Trade-off:** Algunos componentes (tabla admin con 5 cols) requieren transformación radical a desktop. Aceptado.

## DD-006 — Light-only en MVP, sin dark mode

**Decision:** MVP no incluye dark mode. Paleta solo light.
**Rationale:** Carnaval depende de saturación de colores sobre crema cálida — un dark mode requiere re-balance significativo (no es solo invertir variables). Out-of-scope para MVP.
**Trade-off:** Algunos usuarios mobile en exterior con sol fuerte preferirían dark — aceptado como deuda v2.

## DD-007 — Motion language rico + reduced-motion fallback

**Decision:** Animations ricas en transiciones críticas (wheel spin, ticket flip, countdown), pero TODAS detectan `prefers-reduced-motion` y degradan a fade/replace.
**Rationale:** El vibe carnaval pide movimiento (parte de la experiencia del sorteo). Pero accessibility WCAG AA exige respeto a la preference.
**Trade-off:** 2x trabajo en cada componente animado. Mitigación: helper `<MotionSafe>` wrapper hace el toggle automático.

## DD-008 — Ticket grid density variable por breakpoint

**Decision:** 5 cols @ 375px, 8 @ 768px, 10-12 @ 1024px+.
**Rationale:** Combina DD-004 (tap target) con visibility (admin necesita ver más números a la vez sin scroll). En desktop el cursor permite densidad mayor sin perder usabilidad.
**Trade-off:** Vendor en mobile ve "solo" 50 números por viewport (5×10). Scroll es aceptable porque típicamente vende uno por interaction.

## DD-009 — Replay UX: animación auto-play al abrir SCR-009

**Decision:** En vista pública post-sorteo, la rueda se reproduce automáticamente al cargar la página (con botón "Repetir" después).
**Rationale:** El sorteo es el momento emocional del producto — visitante que llega 1h tarde debe vivir la experiencia, no leer texto plano.
**Trade-off:** Autoplay puede molestar a algunos. Mitigación: `prefers-reduced-motion` → cero animación; usuario puede silenciar con CMP-016 (toggle persisted).

## DD-010 — Iniciales fallback "Anónimo" (no "—" ni vacío)

**Decision:** Cuando `buyer.name=null`, vista pública muestra texto "Anónimo" (no símbolo).
**Rationale:** "Anónimo" comunica intención (privacidad), "—" parece bug/data missing.
**Trade-off:** Ninguno — alineado con BR-009 spec.

## DD-011 — Empty state copy festivo, no genérico

**Decision:** Empty states usan copy en español neutro casual con call-to-action concreto (no "No data available").
**Rationale:** Brief §9 voice = festivo, abierto, casual. Un EmptyState con "Operation returned 0 records" rompe el tono.
**Trade-off:** Copy-writing por estado = más trabajo. Mitigación: centralized en `i18n.empty.*` keys para revisión rápida.

## DD-012 — Single token entry point para admin (sin login page)

**Decision:** Admin entra directo a `/admin/{token}`. No hay página `/login` ni form.
**Rationale:** Brief F24 + ADR-003 — sin auth real en MVP. Una login page sería UI-theater.
**Trade-off:** Si el admin guarda el bookmark mal, no hay recovery. Mitigación: durante setup, generar `.env.example` con instrucciones claras.

## DD-013 — Confirm dialogs con reason field opcional (no required)

**Decision:** En CMP-009 destructive variant, el campo "razón" es opcional, no required.
**Rationale:** Forzar razón cada vez añade friction a actions legítimas frecuentes (ej. archivar vendedor). El log se preserva igual con o sin razón.
**Trade-off:** Forensics post-hoc puede tener menos contexto. Aceptable — single-org de confianza.

---

# § 8 — Open Questions / Assumptions

| ID     | Pregunta / Assumption                                                       | Status                                                                                   | Impact si se cambia                 |
| ------ | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------- |
| OQ-D1  | ¿Logo concreto de Rifatela?                                                 | **Open** — deferida a etapa post-design                                                  | Bajo — placeholder funciona         |
| OQ-D2  | ¿Custom icon set vs solo Lucide standard?                                   | `[ASSUMPTION]` Lucide + 4-5 custom SVGs específicos (ticket, rueda, confetti, megaphone) | Medio — custom icons toman 1-2 días |
| OQ-D3  | Sonido del sorteo: ¿qué tracks específicos? (tick wheel + fanfarria)        | **Stretch FT-016** — deferida                                                            | Bajo — está en stretch              |
| OQ-D4  | ¿PWA con install prompt visible o silent?                                   | **Stretch FT-015** — assumption silent (no nag al usuario)                               | Bajo                                |
| OQ-D5  | ¿Onboarding "primera vez" para admin?                                       | `[ASSUMPTION]` no — direct to dashboard con empty state guía                             | Bajo — el empty state ya guía       |
| OQ-D6  | Confetti físico realista vs simplified geometric                            | `[ASSUMPTION]` simplified geometric (perf + accessibility)                               | Bajo                                |
| OQ-D7  | ¿Mostrar % de vendedor en sellers list (gamification)?                      | `[ASSUMPTION]` sí — ranking visual sin números agresivos                                 | Medio — features adicional          |
| OQ-D8  | Vista pública: ¿incluir avatar/foto del organizador?                        | `[ASSUMPTION]` no en MVP — solo nombre rifa + premio                                     | Bajo                                |
| OQ-D9  | Internationalization: ¿strings extraíbles a JSON ya?                        | `[ASSUMPTION]` hardcoded español neutro en MVP. i18n post-MVP.                           | Medio — refactor moderado           |
| OQ-D10 | ¿Ticket digital también como PNG dinámico (OG image) para WhatsApp preview? | `[RECOMMENDED]` sí — endpoint `/api/og/ticket/{id}` genera PNG para previews             | Alto valor UX, esfuerzo medio       |

---

# § 9 — Wireframes

ASCII wireframes mobile-first (375px) primero, desktop variant cuando difiere significativamente. Notación:

```
┌─── ─┐   borders
│     │
│ TXT │   text content
[BTN]    button
{...}    interactive element
···      truncated for brevity
```

## 9.1 SCR-001 — Admin Dashboard

### Mobile 375px

```
┌─────────────────────────────────┐
│ ☰  RIFATELA          🔔  ⚙️    │  ← header sticky 56px
├─────────────────────────────────┤
│                                 │
│  Hola, Carla 👋                 │  font-display, text-2xl
│                                 │
│  ┌─────────────────────────┐    │
│  │ Activas │ Todas │ Arch. │    │  filter pills
│  └─────────────────────────┘    │
│                                 │
│  ┌───────────────────────────┐  │  ← RaffleCard (CMP-001)
│  │ [imagen premio · 80×80]   │  │
│  │                           │  │
│  │ Rifa Pro Cole       OPEN  │  │  badge verde
│  │                           │  │
│  │ ████████░░░░░ 62%        │  │  progress bar
│  │                           │  │
│  │ 62/100 · 3 vendedores     │  │
│  │ ⏰ 4 días                 │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ ... otra rifa             │  │
│  └───────────────────────────┘  │
│                                 │
│         [ + Nueva Rifa ]         │  primary CTA, sticky
│                                 │
├─────────────────────────────────┤
│  🏠 Inicio  🎟  Rifas  👥 Vend.│  ← bottom nav 3 items
└─────────────────────────────────┘
```

### Empty state (0 rifas)

```
┌─────────────────────────────────┐
│ ☰  RIFATELA          🔔  ⚙️    │
├─────────────────────────────────┤
│                                 │
│       [ilustración rueda]       │
│         200×200px               │
│                                 │
│   Aún no tienes rifas.          │  text-xl display
│                                 │
│   Crea la primera y             │
│   compártela en tu              │  body
│   grupo de WhatsApp.            │
│                                 │
│        [ Crear rifa ]            │  primary CTA
│                                 │
└─────────────────────────────────┘
```

### Desktop ≥1024px

```
┌──────────┬────────────────────────────────────────────────────┐
│          │  Hola, Carla 👋                  [ + Nueva Rifa ]  │
│ DASHBOARD│  ─────────────────────────────────────────────────  │
│          │  Activas (2) · Todas (5) · Archivadas (3)          │
│ RIFAS    │                                                    │
│          │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐│
│ VENDED.  │  │  Rifa Cole   │ │  Rifa Club   │ │  Rifa Nav.   ││
│          │  │  OPEN · 62%  │ │  OPEN · 14%  │ │  DRAWN 🎉    ││
│          │  │  62/100      │ │  140/1000    │ │  Ganador #47 ││
│          │  └──────────────┘ └──────────────┘ └──────────────┘│
└──────────┴────────────────────────────────────────────────────┘
   sidebar 240px         content fluido, 3-col grid
```

---

## 9.2 SCR-002 — Admin: Create/Edit Raffle

### Mobile 375px

```
┌─────────────────────────────────┐
│ ← Nueva Rifa                    │  back arrow
├─────────────────────────────────┤
│                                 │
│  Nombre *                       │  label arriba
│  ┌─────────────────────────┐    │
│  │ Rifa Pro Cole           │    │  input 44px
│  └─────────────────────────┘    │
│                                 │
│  Premio *                       │
│  ┌─────────────────────────┐    │
│  │ iPhone 15 128GB         │    │
│  │                         │    │  textarea
│  └─────────────────────────┘    │
│                                 │
│  Imagen del premio              │
│  ┌─────────────────────────┐    │  ← CMP-006 empty
│  │   📷 Subir foto         │    │
│  │   (max 5MB)             │    │
│  └─────────────────────────┘    │
│                                 │
│  Cantidad de boletos *          │
│  ┌─────┬─────────┬───────┐      │
│  │  -  │   100   │   +   │      │  stepper
│  └─────┴─────────┴───────┘      │
│                                 │
│  Fecha del sorteo *             │
│  ┌─────────────────────────┐    │
│  │ 31/05/2026  20:00       │    │  native picker
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │  ← sticky bottom
│  │      Crear rifa         │    │  primary CTA
│  └─────────────────────────┘    │
└─────────────────────────────────┘
```

### Edit variant (con sold_count > 0)

```
[same form, but]:
- max_tickets field con tooltip "🔒 Ya hay 23 boletos vendidos, no se puede reducir"
- Si status='drawn': banner top "Esta rifa ya se sorteó, no es editable" + todo readonly
```

---

## 9.3 SCR-003 — Admin: Raffle Detail

### Mobile 375px

```
┌─────────────────────────────────┐
│ ← Rifa Pro Cole       [...menu] │
├─────────────────────────────────┤
│                                 │
│  ┌───────────────────────────┐  │
│  │ [hero image premio]       │  │  RaffleCard variant=detail-header
│  │                           │  │
│  │ iPhone 15 128GB           │  │
│  │ Sorteo: 31/05  20:00      │  │
│  │ Estado: ABIERTA           │  │
│  │ Vendidos: 62/100 (62%)    │  │
│  │ ⏰ 4 días 12h restantes   │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌──[ Copiar URL pública ]──┐  │  secondary
│  ├──────────────────────────┤  │
│  │   /r/abc12345xyz   📋    │  │  url preview + copy
│  └──────────────────────────┘  │
│                                 │
│  ── Vendedores activos (3) ──   │
│  Diego  · 24 vendidos           │
│  María  · 18 vendidos           │
│  Pablo  · 20 vendidos           │
│                                 │
│  ── Tickets ──                  │
│  ┌─────────────────────────┐    │
│  │ 🔍 Buscar por # o nombre│    │
│  └─────────────────────────┘    │
│  [TicketGrid admin-detail]      │  ← CMP-002 variant=admin-detail
│                                 │
│  ── Historial ──                │
│  ┌─────────────────────────┐    │  ← CMP-012 AdminActionLog
│  │ hace 2h · revert_sale   │    │
│  │   ticket #47, razón:    │    │
│  │   "Diego se equivocó"   │    │
│  │ hace 1d · rotate_token  │    │
│  │   seller: María         │    │
│  └─────────────────────────┘    │
│                                 │
└─────────────────────────────────┘
```

### Cuando draw_date ya llegó

```
[entre header y vendedores aparece banner]:

  ┌─────────────────────────────┐
  │  🎯 ¡Hora del sorteo!       │  amarillo fuerte
  │  La fecha ya llegó.         │
  │                             │
  │  [  Ejecutar Sorteo  ]      │  primary CTA gigante
  └─────────────────────────────┘
```

---

## 9.4 SCR-004 — Admin: Draw Panel

### Mobile + Desktop (similar, full-width hero)

```
┌─────────────────────────────────┐
│  ← Volver                       │
├─────────────────────────────────┤
│                                 │
│    Rifa Pro Cole                │  display, text-2xl
│    Sorteando entre 62 boletos   │  body
│                                 │
│  ┌───────────────────────────┐  │
│  │                           │  │
│  │     [ DRAW WHEEL ]        │  │  ← CMP-004
│  │     SVG circle 320×320    │  │  spinning when active
│  │     N segments (1 each    │  │
│  │     sold ticket)          │  │
│  │     pointer ▼ arriba      │  │
│  │     center: logo R         │  │
│  │                           │  │
│  └───────────────────────────┘  │
│                                 │
│   Antes del sorteo:             │
│   ┌─────────────────────┐       │
│   │  [Ejecutar Sorteo]  │       │  primary, large
│   └─────────────────────┘       │
│                                 │
│   Durante (4s):                 │
│   ⏳ Sorteando...               │
│   [wheel spins, dim background] │
│                                 │
│   Post-sorteo:                  │
│   ┌─────────────────────┐       │
│   │   🎉 ¡GANADOR! 🎉   │       │  display, text-display
│   │                     │       │
│   │     #  4 7          │       │  display 96px
│   │                     │       │
│   │   Marta Fernández    │       │  text-2xl
│   │   Vendido por Diego │       │  text-sm muted
│   └─────────────────────┘       │
│   [confetti burst overlay]      │
│                                 │
│   [ Compartir resultado ]       │  secondary
│   [ Ver vista pública ]         │  link
│                                 │
└─────────────────────────────────┘
```

---

## 9.5 SCR-005 — Admin: Sellers Management

### Mobile 375px

```
┌─────────────────────────────────┐
│ ←  Vendedores       [+ Nuevo]   │
├─────────────────────────────────┤
│                                 │
│  ── Activos (3) ──               │
│                                 │
│  ┌───────────────────────────┐  │  ← CMP-008 SellerCard
│  │  Diego           24 vts   │  │
│  │  /v/abc12...      👁️ 📋   │  │  url + show + copy
│  │  [Rotar] [Archivar]       │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │  María           18 vts   │  │
│  │  ... idem                 │  │
│  └───────────────────────────┘  │
│                                 │
│  ── Archivados (2) ──   ▾ expand│  collapsible
│                                 │
└─────────────────────────────────┘
```

### Post-create flash banner

```
┌─────────────────────────────────┐
│  ✅ Vendedor "Diego" creado.    │
│                                 │
│  Compártele esta URL:           │
│  ┌─────────────────────────┐    │
│  │ /v/abc123def456    📋   │    │  copy button
│  └─────────────────────────┘    │
│                                 │
│  [ Continuar ]                  │
└─────────────────────────────────┘
```

### Modal "+ Nuevo Vendedor"

```
┌─────────────────────────────────┐
│  Nuevo Vendedor                ✕│
├─────────────────────────────────┤
│  Nombre *                       │
│  ┌─────────────────────────┐    │
│  │ Diego                   │    │
│  └─────────────────────────┘    │
│                                 │
│   [ Cancelar ]  [ Crear ]       │
└─────────────────────────────────┘
```

---

## 9.6 SCR-006 — Vendedor: Panel de Venta

### Mobile 375px (case principal)

```
┌─────────────────────────────────┐
│ 👤 Diego        Rifa Pro Cole ▾ │  ← header 56px, dropdown si múltiples activas
├─────────────────────────────────┤
│                                 │
│  ⏰ 4 días para el sorteo       │  countdown inline
│  62 / 100 vendidos              │
│                                 │
│  ── Nuevo comprador ──          │
│  ┌─────────────────────────┐    │  ← BuyerForm collapsable
│  │ Nombre (opcional)       │    │
│  │ [Marta            ]     │    │
│  │ Teléfono (opcional)     │    │
│  │ [11999...        ]     │    │
│  │ Email (opcional)        │    │
│  │ [vacío           ]      │    │
│  │                         │    │
│  │ [ Registrar comprador ] │    │
│  └─────────────────────────┘    │
│                                 │
│  ── Asignar número ──           │
│  Comprador actual: Marta        │
│                                 │
│  ┌──┬──┬──┬──┬──┐                │  ← TicketGrid 5 cols × N
│  │ 1│ 2│ 3│ 4│ 5│                │
│  ├──┼──┼──┼──┼──┤                │  available: blanco + border rojo
│  │J.│ 7│ 8│ 9│10│                │  sold: azul + iniciales
│  │P.│  │  │  │  │                │
│  ├──┼──┼──┼──┼──┤                │
│  │11│12│13│14│15│                │
│  ...                            │
│  ├──┼──┼──┼──┼──┤                │
│  │46│47│48│49│50│  ← scroll      │
│  ...                            │
│                                 │
└─────────────────────────────────┘
```

### Toast post-409 (concurrency race)

```
┌─────────────────────────────────┐
│ ⚠️  Ese número ya se vendió,    │  ← toast top, 5s
│    elegí otro.                  │
└─────────────────────────────────┘
[grilla refresca debajo, #47 ahora azul con iniciales]
```

---

## 9.7 SCR-007 — Vendedor: Ticket Digital

### Mobile 375px (también es el formato shareable)

```
┌─────────────────────────────────┐
│ ←  Ticket digital               │
├─────────────────────────────────┤
│                                 │
│  ┌───────────────────────────┐  │  ← shareable card
│  │  [hero premio image]      │  │
│  │   bg: amarillo dorado     │  │
│  │                           │  │
│  │   RIFA PRO COLE           │  │  display
│  │   iPhone 15 128GB         │  │  text-lg
│  │                           │  │
│  │   ┌─────────────┐         │  │
│  │   │   #  4 7    │         │  │  display 96px
│  │   └─────────────┘         │  │
│  │                           │  │
│  │   Marta Fernández         │  │  body, name
│  │   Vendido por Diego       │  │  text-sm muted
│  │                           │  │
│  │   ⏰ Sorteo: 31 mayo      │  │
│  │      20:00                │  │
│  │                           │  │
│  │   ┌─────────┐             │  │
│  │   │   QR    │             │  │  → /r/{publicSlug}
│  │   └─────────┘             │  │
│  │                           │  │
│  │   rifatela.com            │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌─────────────────────────┐    │
│  │   📤  Compartir         │    │  primary CTA
│  └─────────────────────────┘    │  invoca Web Share API
│                                 │
│  [ Volver a vender ]            │  secondary
│                                 │
└─────────────────────────────────┘
```

---

## 9.8 SCR-008 — Pública: Landing (open)

### Mobile 375px

```
┌─────────────────────────────────┐
│  RIFATELA                       │  ← minimal header
├─────────────────────────────────┤
│                                 │
│   [hero premio image full]      │  full-width image
│   400×250px                     │
│                                 │
│   RIFA PRO COLE                 │  display, text-hero
│                                 │
│   iPhone 15 128GB               │  text-2xl
│   Apple, color natural          │  body
│                                 │
│  ┌───────────────────────────┐  │  ← Countdown hero (CMP-003)
│  │                           │  │
│  │  04 : 12 : 32 : 15        │  │  display 96px clamp
│  │  días : hr : min : seg    │  │  text-sm
│  │                           │  │
│  └───────────────────────────┘  │
│                                 │
│  62 vendidos · 38 disponibles   │  text-base
│                                 │
│  ── Números ──                  │
│  [TicketGrid 5 cols, public]    │
│  ┌──┬──┬──┬──┬──┐                │
│  │ 1│ 2│ 3│ 4│ 5│                │
│  ├──┼──┼──┼──┼──┤                │
│  │J.│ 7│M.│ 9│P.│                │
│  │P.│  │L.│  │A.│                │
│  ...                            │
│                                 │
│  ── ¿Cómo se verifica? ──        │
│  Antes del sorteo publicamos    │
│  un hash criptográfico. Al      │
│  sortear se revela el seed.     │
│                                 │
│  🔒 Hash: a3f8b9...c4d7e1       │  ← SeedCommitDisplay (CMP-013)
│       [ Ver detalles ]           │
│                                 │
└─────────────────────────────────┘
```

### Variant: Boletos agotados (62/62 == max)

```
[entre Countdown y grilla]:

  ┌─────────────────────────────┐
  │  🎟️  BOLETOS AGOTADOS       │  banner amarillo
  │  Sorteo en 04 : 12 : 32     │
  └─────────────────────────────┘
```

---

## 9.9 SCR-009 — Pública: Landing (drawn)

### Mobile 375px

```
┌─────────────────────────────────┐
│  RIFATELA                       │
├─────────────────────────────────┤
│                                 │
│   [hero premio image]            │
│                                 │
│   RIFA PRO COLE                 │  display
│   iPhone 15 128GB               │
│                                 │
│  ┌───────────────────────────┐  │  ← DrawWheel replay (CMP-004)
│  │     [WHEEL ANIMATED]      │  │
│  │     ◯ replay 4s spin      │  │  autoplay on mount
│  │                           │  │
│  └───────────────────────────┘  │
│        [ Repetir ]              │  small button below
│                                 │
│  ┌───────────────────────────┐  │
│  │     🎉 GANADOR 🎉         │  │  display
│  │                           │  │
│  │     #  4 7                │  │  display 96px
│  │                           │  │
│  │     Marta Fernández       │  │  text-2xl
│  │     Vendido por Diego     │  │  text-sm muted
│  └───────────────────────────┘  │
│                                 │
│  ── Verificar el sorteo ──       │
│                                 │
│  ┌───────────────────────────┐  │  ← VerifyDrawButton (CMP-011)
│  │ ✅ Verificar este sorteo  │  │  primary
│  └───────────────────────────┘  │
│                                 │
│  Hash publicado: a3f8b9...      │
│  Seed revelado:  k9j2nf...      │
│                                 │
│  ── Números (cerrados) ──       │
│  [TicketGrid public, drawn]     │
│  ┌──┬──┬──┬──┬──┐                │
│  │J.│M.│⭐│P.│A.│  ← winner ⭐    │
│  │P.│  │47│A.│M.│  amarillo      │
│  ...                            │
│                                 │
└─────────────────────────────────┘
```

---

## 9.10 SCR-010 — Pública: Verify Draw

Puede ser modal (default) o página standalone (`/r/{slug}/verify` para shareable link).

### Modal sobre SCR-009

```
┌─────────────────────────────────┐
│  Verificar sorteo            ✕  │
├─────────────────────────────────┤
│                                 │
│  Este sorteo usa commit-reveal: │
│                                 │
│  1️⃣  Hash publicado pre-sorteo: │
│  ┌─────────────────────────┐    │
│  │ a3f8b9c4d7e1f2a8b3c5d... │    │  mono font
│  │ ...e7f1a2b3c4d5e6f7a8b9 │    │
│  └─────────────────────────┘    │
│                                 │
│  2️⃣  Seed revelado en sorteo:    │
│  ┌─────────────────────────┐    │
│  │ k9j2nf3lz0xq...   📋    │    │
│  └─────────────────────────┘    │
│                                 │
│  3️⃣  Hash recalculado aquí:      │
│  ┌─────────────────────────┐    │
│  │ ⏳ Calculando...        │    │  spinner 200ms
│  └─────────────────────────┘    │
│                                 │
│  ↓ después de cálculo ↓         │
│                                 │
│  ┌─────────────────────────┐    │
│  │ ✅ a3f8b9c4d7e1f2a8... │    │  green
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │  ✅ SORTEO VERIFICADO   │    │  card verde fuerte
│  │                         │    │
│  │  El hash coincide.      │    │
│  │  El sorteo no fue       │    │
│  │  manipulado.            │    │
│  └─────────────────────────┘    │
│                                 │
│  [ Volver a la rifa ]           │
│                                 │
└─────────────────────────────────┘
```

### Failure variant (paranoia case)

```
[idem pero al final]:
  ┌─────────────────────────┐
  │  ❌ HASH NO COINCIDE    │  card roja
  │                         │
  │  Algo no encaja. Por    │
  │  favor contactá al      │
  │  organizador.           │
  └─────────────────────────┘
```

---

## 9.11 SCR-011 — Error / 404

```
┌─────────────────────────────────┐
│  RIFATELA                       │
├─────────────────────────────────┤
│                                 │
│         [ilustración 404]       │
│         carpa de circo cerrada  │
│                                 │
│   Esta página no existe         │  display, text-2xl
│   o el link expiró              │
│                                 │
│   Si esperabas ver una rifa,    │  body
│   pedile el link al             │
│   organizador.                  │
│                                 │
│        [ Ir al inicio ]         │  primary (a /)
│                                 │
└─────────────────────────────────┘
```

---

# § Coverage Validation

## US → SCR matrix (27 user stories)

| US                                      | Feature | Maps to SCR                                        |
| --------------------------------------- | ------- | -------------------------------------------------- |
| US-001 Crear rifa básica                | FT-001  | SCR-002                                            |
| US-002 Subir imagen premio              | FT-001  | SCR-002                                            |
| US-003 Editar rifa pre-sorteo           | FT-001  | SCR-002                                            |
| US-004 Dar de alta vendedor             | FT-002  | SCR-005                                            |
| US-005 Rotar URL vendedor               | FT-002  | SCR-005                                            |
| US-006 Archivar vendedor                | FT-002  | SCR-005                                            |
| US-007 Entrar como vendedor             | FT-003  | SCR-006                                            |
| US-008 Selector múltiples rifas         | FT-003  | SCR-006 (header dropdown)                          |
| US-009 Registrar comprador opt          | FT-004  | SCR-006 (BuyerForm)                                |
| US-010 Asignar número                   | FT-005  | SCR-006 (TicketGrid)                               |
| US-011 UI clara disponibles vs vendidos | FT-005  | SCR-006, SCR-008                                   |
| US-012 Concurrency race                 | FT-006  | SCR-006 (toast 409)                                |
| US-013 Visitante abre URL               | FT-007  | SCR-008                                            |
| US-014 Vendido todo, countdown sigue    | FT-007  | SCR-008 (banner agotado)                           |
| US-015 Archivada URL pública sigue      | FT-007  | SCR-009                                            |
| US-016 Ejecutar sorteo                  | FT-008  | SCR-004                                            |
| US-017 Sorteo no dos veces              | FT-008  | (UI bloquea botón post-drawn)                      |
| US-018 Replay determinista              | FT-009  | SCR-009 (DrawWheel replay)                         |
| US-019 Ticket digital share             | FT-010  | SCR-007                                            |
| US-020 Admin revierte                   | FT-011  | SCR-003                                            |
| US-021 Vendedor NO revierte             | FT-011  | SCR-006 (no botón) + 403 server                    |
| US-022 Dashboard métricas               | FT-012  | SCR-001                                            |
| US-023 Dashboard refresca               | FT-012  | SCR-001 (revalidatePath)                           |
| US-024 seed_commit pre-sorteo           | FT-013  | SCR-008 (CommitRevealBadge)                        |
| US-025 Verifica post-sorteo             | FT-013  | SCR-010                                            |
| US-026 PWA install (stretch)            | FT-015  | (cross-cutting manifest, no SCR propio)            |
| US-027 Sonido mute (stretch)            | FT-016  | SCR-004, SCR-009 (toggle dentro de DrawWheel area) |

**Cobertura:** 27/27 = **100%** ✅

## FT → SCR matrix

| FT     | Screens primarias                                         |
| ------ | --------------------------------------------------------- |
| FT-001 | SCR-001, SCR-002, SCR-003                                 |
| FT-002 | SCR-005                                                   |
| FT-003 | SCR-006                                                   |
| FT-004 | SCR-006                                                   |
| FT-005 | SCR-006                                                   |
| FT-006 | SCR-006 (toast + grid refresh)                            |
| FT-007 | SCR-008, SCR-009                                          |
| FT-008 | SCR-004                                                   |
| FT-009 | SCR-009                                                   |
| FT-010 | SCR-007                                                   |
| FT-011 | SCR-003                                                   |
| FT-012 | SCR-001                                                   |
| FT-013 | SCR-008, SCR-009, SCR-010                                 |
| FT-014 | (cross-cutting — todos los wireframes mobile-first 375px) |
| FT-015 | (stretch — manifest, no SCR propio)                       |
| FT-016 | SCR-004, SCR-009 (sub-control)                            |

**Cobertura:** 16/16 = **100%** ✅

## Persona representation

| Persona                 | Screens primarias                           |
| ----------------------- | ------------------------------------------- |
| P-001 Admin (Carla)     | SCR-001, SCR-002, SCR-003, SCR-004, SCR-005 |
| P-002 Vendedor (Diego)  | SCR-006, SCR-007                            |
| P-003 Visitante (Marta) | SCR-008, SCR-009, SCR-010                   |
| All                     | SCR-011 (errors)                            |

**Cobertura:** 3/3 = **100%** ✅

---

# § Multi-perspective review checklist

| Perspectiva       | Check                                                       | Estado                                         |
| ----------------- | ----------------------------------------------------------- | ---------------------------------------------- |
| **Product**       | ¿Cada SCR sirve un user goal explícito en /docs?            | ✅                                             |
| **Architecture**  | ¿Las screens se alinean con routing del doc 07?             | ✅ — URL patterns matchean                     |
| **Frontend**      | ¿Componentes son construibles con Tailwind + RSC + Drizzle? | ✅ — sin patterns exóticos                     |
| **UX**            | ¿Flujos son completos sin dead-ends?                        | ✅ — todos los flows tienen exit path          |
| **Accessibility** | ¿WCAG AA: tap targets, contrast, motion, aria-live?         | ✅ — DD-004, DD-007, paleta con contrast ≥ 4.5 |

---

# § Document index

| Section                     | Status                                  |
| --------------------------- | --------------------------------------- |
| § 0 Visual Direction        | ✅ 9 sub-sections                       |
| § 1 Screen Inventory        | ✅ 11 screens                           |
| § 2 Flow Definitions        | ✅ 8 flows                              |
| § 3 Navigation Architecture | ✅                                      |
| § 4 Component Catalog       | ✅ 15 components                        |
| § 5 Form Specifications     | ✅                                      |
| § 6 Data Display Patterns   | ✅                                      |
| § 7 Design Decisions        | ✅ 13 DDs                               |
| § 8 Open Questions          | ✅ 10 OQs (todas tratables sin blocker) |
| § 9 Wireframes              | ✅ 11/11 (100%)                         |
| § Coverage                  | ✅ 100% en US, FT, personas             |

---

_15 Design Spec — Rifatela — 11 screens × 8 flows × 15 components × 13 design decisions · cobertura 100% · mobile-first 375px · skin Carnaval Festivo_
