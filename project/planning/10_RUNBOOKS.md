# 10 — Runbooks

> **Proyecto:** Rifatela
> **Source:** [`07_ARCHITECTURE.md`](./07_ARCHITECTURE.md), [`05_BUSINESS_RULES.md`](./05_BUSINESS_RULES.md)
> **Estado:** v1.0
> **Scope:** procedimientos operacionales MVP — single-org, single-admin, serverless

---

## Filosofía

App serverless en Vercel con DB managed (Neon). La superficie operacional es mínima: deploy, rollback, gestión data ocasional. Los runbooks de abajo cubren los escenarios reales — no padding.

---

## RB-001 — Deploy a producción

### Pre-deploy checklist

- [ ] `pnpm verify` pasa local (`lint && typecheck && test`)
- [ ] `pnpm test:e2e` pasa local (al menos los E2E críticos: FT-006 concurrency, FT-008 sorteo, FT-013 commit-reveal)
- [ ] Migrations pendientes generadas: `pnpm db:generate` (si hubo cambios en schema)
- [ ] `.env.example` actualizado si se agregaron vars
- [ ] Commit con mensaje per `GIT.md §3.1`

### Pre-release (v0.0.0)

```bash
# Push directo a main permitido (GIT.md §4)
git push origin main
# Vercel autoinjecta deploy
```

### Post-release (v1.0.0+)

```bash
# usar /deploy skill que ejecuta merge develop → main
# verificar checkpoint del workflow antes de mergear
```

### Aplicar migrations

```bash
# en local con DATABASE_URL apuntando a prod (cuidado):
pnpm db:migrate
# ⚠️ NUNCA `pnpm db:push` sin aprobación explícita (SK.md §1.1)
```

### Verificación post-deploy

1. Abrir `https://rifatela.com/admin/{adminToken}` → debe cargar dashboard
2. Crear rifa de prueba (eliminarla después)
3. Verificar Vercel Blob upload funciona (subir imagen al premio)
4. Revisar Sentry — no errors nuevos en últimos 5min

---

## RB-002 — Rollback de deploy

### Síntoma

Después de un deploy, la app está broken (5xx, broken UI, etc.)

### Procedimiento

1. **Vercel Dashboard** → Project → Deployments
2. Encontrar el último deploy estable (con ✅ y sin alarmas)
3. Click `…` → **"Promote to Production"**
4. Vercel switcheaa el alias en ~10s

### Pasos paralelos

- Si el bug es por migration: ejecutar reverse migration manualmente
- Si es config: actualizar env var en Vercel Dashboard y redeploy

### Post-rollback

- Crear issue en backlog con root cause
- Revisar Sentry para confirmar errors paran
- Avisar a admin (organizador) si la app estuvo down >5min

---

## RB-003 — Revertir venta del vendedor (operacional)

### Cuándo aplica

- Vendedor asignó número incorrecto a comprador (Diego puso 47 cuando era 48)
- Comprador se arrepiente pre-sorteo
- Resolver una disputa "yo dije 23 no 32"

### Procedimiento

1. Admin entra a `/admin/{adminToken}/raffles/{raffleId}`
2. Localiza el ticket vendido (filtrar por seller, buyer, o number)
3. Click **"Revertir"** en el ticket
4. (Opcional) escribir razón en el dialog
5. Confirmar

### Verificación

- El ticket aparece como `available` en la grilla pública (`/r/{publicSlug}`)
- AdminAction se persistió (visible en Detalle de Rifa → Historial)
- El Buyer NO se borró (puede tener otros tickets — BR-011 side effects)

### NO se puede hacer si

- Rifa ya `status='drawn'` → BR-010 inmutabilidad. Si esto pasa post-sorteo, NO hay solución dentro de la app: comunicar al admin que el resultado es inmutable y la disputa se resuelve fuera.

---

## RB-004 — Rotar URL de vendedor (post-leak)

### Cuándo aplica

- Vendedor compartió su URL por error en grupo público
- Sospecha de uso no autorizado de un token
- Vendedor pierde su celular y quiere invalidar su URL

### Procedimiento

1. Admin entra a `/admin/{adminToken}/sellers`
2. Localiza el vendedor afectado
3. Click **"Rotar URL"** → confirmar
4. La nueva URL aparece (con botón copiar)
5. Compartir nueva URL al vendedor por WhatsApp

### Verificación

- URL vieja (`/v/{oldToken}`) → 404
- URL nueva (`/v/{newToken}`) → panel del mismo vendedor
- Ventas históricas del vendedor se mantienen

---

## RB-005 — Ejecutar sorteo

### Pre-sorteo

- [ ] `now() >= draw_date` (BR-005)
- [ ] Al menos 1 ticket vendido (BR-005 + BR-007)
- [ ] Conexión estable (el sorteo es UN request crítico)

### Procedimiento

#### Paso 1 — Aviso público (recomendado, manual)

- Avisar por el grupo de WhatsApp: "Sorteo en 5min, abran el link"
- Compartir `https://rifatela.com/r/{publicSlug}`

#### Paso 2 — Ejecutar

1. Admin entra a `/admin/{adminToken}/raffles/{raffleId}`
2. Si pasó la `draw_date`, aparece sección **"Panel de Sorteo"**
3. Click **"Ejecutar Sorteo"** → confirmar (action irreversible)
4. La animación de la rueda comienza en pantalla del admin
5. Al terminar, ganador queda persistido (≤5s)

#### Paso 3 — Verificación

- Vista pública `/r/{publicSlug}` muestra ganador + replay
- `rng_seed` está revelado en el footer
- Click "Verificar este sorteo" → ✅

### Si falla

- Error `draw_date_not_reached` → esperar a que llegue la fecha
- Error `no_tickets_sold` → cancelar/archivar la rifa manualmente
- Error `already_drawn` → ya se ejecutó (verificar resultado, no es bug)
- Error infra (timeout, network) → Sentry capture; reintentar al cabo de 30s

### Recovery si el sorteo "se trabó" mid-execution

- Inspeccionar DB: `pnpm db:query "SELECT status, winner_ticket_id, drawn_at, rng_seed FROM raffles WHERE id='...'"`
- Si `status='drawn'` y `winner_ticket_id NOT NULL` → el sorteo SI se ejecutó. Solo refrescar UI.
- Si `status='open'` y todos los campos draw nulls → el UPDATE falló. Reintentar `executeDraw` normalmente.
- **No hacer UPDATE manual a `status='drawn'`** sin reasignar también `winner_ticket_id`, `drawn_at`, `rng_seed` (rompería invariants BR-005 y BR-006).

---

## RB-006 — Archivar rifa

### Cuándo aplica

- Rifa cancelada (0 ventas y admin no quiere esperar)
- Rifa ya sorteada y se quiere limpiar el dashboard
- Rifa abandonada / olvidada

### Procedimiento

1. `/admin/{adminToken}/raffles/{raffleId}` → menú `…` → **"Archivar"**
2. (Opcional) razón
3. Confirmar

### Efecto

- Rifa desaparece del dashboard por defecto (toggle "incluir archivadas" la trae de vuelta)
- URL pública `/r/{publicSlug}` **sigue funcionando** (BR-015) — los links compartidos en WhatsApp no se rompen
- Tickets, buyers, sellers asociados se preservan

### NO ocurre

- ❌ NO se borran datos
- ❌ NO se invalidan URLs públicas
- ❌ NO se notifica a vendedores ni compradores (no hay notificaciones en MVP)

---

## RB-007 — Investigar bug en producción

### Sources principales

1. **Sentry** — errors agrupados, stack traces, breadcrumbs
2. **Vercel logs** — `console.log` server-side por route/function
3. **Neon Console** — slow queries, locks, conexión

### Patron de investigación

1. Sentry → identificar el primer error en el grupo
2. Localizar route/server action en el stack trace
3. Si requiere DB inspection: `pnpm db:query "SELECT ..."` (read-only por design — SK.md §1.3)
4. Reproducir local con datos de prod (si es posible, anonimizar PII)

### NO hacer

- ❌ Ejecutar UPDATE/DELETE manual en prod sin script auditado
- ❌ `pnpm db:push` para "arreglar schema rápido"
- ❌ `vercel pull` (sobrescribe `.env.local` — `SK.md §7.1`)

---

## RB-008 — Restaurar de backup

### Estrategia de backup

- **Neon Postgres** incluye PITR (point-in-time recovery) por default en plan Pro
- Window: últimos 7 días en plan free; configurable en Pro
- Vercel Blob: sin backup explícito en MVP (archivos son inmutables; si se borran, se pierden)

### Procedimiento de restore

1. **Neon Console** → Project → Branches → "Restore"
2. Elegir timestamp del estado deseado
3. Crear branch nuevo desde ese punto
4. Validar data en branch test
5. **Promote** la branch a default (cuidadosamente — destructive)

### Post-restore

- Verificar que las URLs públicas siguen funcionando
- Verificar que los `seedCommit` de rifas open no cambiaron (sino BR-006 falla)
- Re-deploy si las migraciones cambiaron entre el punto de backup y ahora

---

## RB-009 — Add new admin (post-MVP placeholder)

> **MVP:** un solo admin, configurado vía env var `ADMIN_ACCESS_TOKEN`.
> **Post-MVP:** cuando se active NextAuth, este runbook se reemplazará con flow estándar.

Por ahora, "agregar admin" = compartir el adminToken con otra persona. **No es ideal**, pero está alineado con la decisión consciente del usuario (R1 aceptado).

---

## RB-010 — Monitorear salud del sistema

### Daily check (3min)

- Sentry — issues nuevos en últimas 24h
- Vercel Analytics — tráfico anómalo
- Neon — utilización de DB (deberíamos estar <10% del plan)

### Pre-evento (sorteo grande pendiente)

- Subir 30min antes a Sentry, mirar requests/min en ramp-up
- Verificar Vercel concurrent invocations no llegan al límite
- Tener `pnpm db:query` listo por si hay que inspeccionar

---

## Anti-runbooks (qué NO hacer)

| ❌ Acción                                             | Por qué NO                                          | Alternativa                                             |
| ----------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------- |
| `vercel pull` para verificar env vars                 | Sobrescribe `.env.local` — SK.md §7.1               | Leer `.env.local` o Vercel Dashboard                    |
| `pnpm db:push` para "arreglar rápido"                 | Destructivo, sin migration trail — SK.md §1.1       | `pnpm db:generate` + `pnpm db:migrate`                  |
| UPDATE manual de `raffles.status` post-sorteo         | Rompe BR-010 inmutabilidad                          | Aceptar el resultado o restaurar de backup              |
| Compartir `ADMIN_ACCESS_TOKEN` por canales no seguros | Risk R1 escalado                                    | Comunicarlo en persona o canal cifrado                  |
| Re-generar `rng_seed` de rifa en `open`               | Rompe BR-006 commit-reveal — visitantes detectarían | No regenerable post-`open` (enforced en server actions) |

---

_10 Runbooks — Rifatela — 10 procedimientos operacionales + anti-runbooks_
