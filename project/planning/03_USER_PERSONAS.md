# 03 — User Personas

> **Proyecto:** Rifatela
> **Source:** [`00_DISCOVERY_BRIEF.md`](./00_DISCOVERY_BRIEF.md) §2
> **Estado:** v1.0
> **ID namespace:** `P-XXX`

---

## Resumen

3 personas en MVP. **Ninguna requiere registración tradicional** — el acceso se controla por URLs secretas (`/admin/{token}`, `/v/{token}`, `/r/{slug}`).

| ID    | Persona            | Rol                   | Device principal             | Volumen esperado |
| ----- | ------------------ | --------------------- | ---------------------------- | ---------------- |
| P-001 | Carla la Admin     | Organizadora          | Mobile + Desktop             | 1 por org        |
| P-002 | Diego el Vendedor  | Vendedor amateur      | Mobile (celular en la calle) | 3-15 por rifa    |
| P-003 | Marta la Visitante | Compradora / familiar | Mobile (WhatsApp)            | 50-500 por rifa  |

---

## P-001 — Carla la Admin

> _"Soy la presidenta de la comisión directiva del club. Organizamos rifas dos veces al año para juntar plata para los chicos. Antes lo hacía con planilla de Excel y un grupo de WhatsApp; siempre se nos perdían números."_

### Demografía y contexto

- Edad: 35-65 (skew alto, no es nativa digital pero usa WhatsApp y Mercado Pago)
- Rol fuera de la app: presidenta de club / madre voluntaria / tesorera de asociación / organizadora de evento benéfico
- Tech comfort: medio. Usa apps cotidianas, no instala extensiones de browser ni configura DNS.

### Goals

1. Lanzar una rifa rápido (sin curva de aprendizaje)
2. Tener visibilidad clara de cuántos boletos vendió cada vendedor
3. Demostrar transparencia al cierre (el sorteo no fue trucho)
4. Compartir el link de la rifa por WhatsApp y que se vea bien

### Pain points (estado actual)

- Doble-venta del mismo número entre vendedores que no se sincronizan
- Cuaderno con anotaciones a mano → imposible compartir estado en vivo
- Disputas post-sorteo sobre si el número ganador "salió" o no
- Cobrar manualmente sin tracking de quién vendió qué

### Capacidades en Rifatela

- Crear rifa (FT-001)
- Dar de alta vendedores y compartir su URL única (FT-002)
- Ver dashboard con métricas en tiempo real (FT-012)
- Revertir ventas mal asignadas (FT-011)
- Ejecutar el sorteo en la fecha (FT-008)
- Rotar URL de vendedor si se le filtró (FT-002)

### Constraints / what she WON'T do

- ❌ Configurar DNS, instalar apps, leer docs técnicos
- ❌ Recordar passwords largas (por eso URL secreta es OK para MVP)
- ❌ Manejar pagos dentro de la app (los cobra ella aparte)

### Success metric desde la persona

_"Lancé la rifa en 5 minutos, los vendedores se sumaron desde WhatsApp, y el día del sorteo la gente vio la rueda girar y nadie dudó del ganador."_

---

## P-002 — Diego el Vendedor

> _"Me sumé a vender la rifa del club porque la presidenta me mandó un link por WhatsApp. Yo vendo cuando voy a la cancha o cuando paso a buscar a mi hijo al cole. Necesito algo que abra en 2 segundos y no me complique."_

### Demografía y contexto

- Edad: 25-60 (amplio rango, todos voluntarios)
- Rol fuera de la app: padre/madre/socio del club / amigo del organizador
- Tech comfort: bajo a medio. Su mundo es WhatsApp + cámara + transferencia bancaria.
- **Device:** 95% celular (Android baseline, hay iPhones), conexión 4G variable

### Goals

1. Vender lo más rápido posible cuando alguien le dice "quiero el 47"
2. No equivocarse de número (que no aparezca como vendido cuando no lo está, o viceversa)
3. Saber cuántos vendió él/ella vs los demás (gamification natural)
4. Mandar al comprador algo que diga "tenés el N°47" para que no se olvide

### Pain points (estado actual)

- Llevar la lista en papel y olvidarla en casa
- No saber si Juan (otro vendedor) ya vendió el 47 a su sobrina
- El cliente le pide "comprobante" y Diego le tiene que sacar foto a una hoja escrita

### Capacidades en Rifatela

- Entrar a su panel por URL única, sin password (FT-003)
- Registrar comprador con datos mínimos (incluso sin nombre — FT-004)
- Ver grilla en vivo de números disponibles vs vendidos (FT-005)
- Sistema le bloquea automáticamente vender un número ya tomado (FT-006)
- Compartir ticket digital al comprador por WhatsApp en 1 tap (FT-010)

### Constraints / what he WON'T do

- ❌ Cargar muchos datos del comprador (puede registrar sin nombre)
- ❌ Pelear con concurrencia (el sistema se la resuelve)
- ❌ Esperar más de 2 segundos a que cargue una pantalla
- ❌ Llamar al admin para corregir errores → vendedor NO tiene undo, debe pedir al admin (FT-011)

### Success metric desde la persona

_"Vendí 12 boletos en una hora caminando por la cancha, le pasé el ticket por WhatsApp a cada uno, y veo que voy primero en el ranking de vendedores."_

---

## P-003 — Marta la Visitante

> _"Me llegó un link por el grupo de WhatsApp del cole. Lo abrí, vi qué rifa era, qué premio, cuánto faltaba para el sorteo, y le dije a mi cuñado por audio que quería el 23. Después esperé el sorteo y entré el día que se hacía a ver quién ganó."_

### Demografía y contexto

- Edad: cualquier adulto, principalmente 25-65
- Rol: comprador potencial / familiar de un comprador / curioso del entorno
- Tech comfort: variable, pero la app no le exige nada (no login, no instalación obligatoria)
- **Device:** 90% celular vía WhatsApp link

### Goals

1. Decidir en 10 segundos si quiere comprar (premio + fecha + precio implícito)
2. Comunicarse offline con un vendedor para reservar su número
3. Confiar en que el sorteo no fue manipulado
4. Ver el resultado el día del sorteo aunque no haya estado conectada en vivo

### Pain points (estado actual)

- Recibir capturas de pantalla borrosas con la rifa
- No saber qué números están libres
- Dudar si el sorteo se hizo correctamente (sospecha de favoritismo)

### Capacidades en Rifatela

- Abrir vista pública de la rifa sin login (FT-007)
- Ver countdown grande, premio con imagen, grilla de números (con iniciales en vendidos)
- Ver `seed_commit` pre-publicado → señal de transparencia (FT-013)
- Post-sorteo: ver replay determinista de la rueda + verificar `sha256(seed) == commit` (FT-009, FT-013)

### Constraints / what she WON'T do

- ❌ Crear cuenta, descargar nada (puede instalar PWA opcional en v1.1)
- ❌ Comprar dentro de la app (los pagos pasan por fuera)
- ❌ Esperar más de 3 segundos a que cargue la primera vista pública (LCP target)

### Success metric desde la persona

_"Abrí el link, vi todo claro, le dije a Diego que quería el 23, y el día del sorteo vi cómo la rueda eligió el 78. Le di al botón ´verificar´ y dio ✅. Me quedé tranquila."_

---

## Cross-persona — Decisiones de auth que afectan a las 3

| Decisión brief                               | Impacto                                                       |
| -------------------------------------------- | ------------------------------------------------------------- |
| Sin password en ningún rol (F24)             | Carla y Diego acceden por URL secreta; Marta por slug público |
| Tokens en path (`/v/{token}`), no en query   | Reduce leak via referrer headers                              |
| Admin puede rotar token de vendedor (FT-002) | Mitigación si Diego comparte el link por error                |

---

## Anti-personas (quién NO es target del MVP)

- ❌ **Casinos / juegos de azar regulados** — Rifatela no es plataforma de gambling licenciada
- ❌ **Empresas multi-sucursal** — single-tenant, no hay org-boundary
- ❌ **Usuarios que requieren auth fuerte (2FA, SSO)** — para esos casos, la versión post-MVP con magic link / OAuth

---

_03 User Personas — Rifatela — 3 personas + anti-personas, mapeo a features FT-XXX_
