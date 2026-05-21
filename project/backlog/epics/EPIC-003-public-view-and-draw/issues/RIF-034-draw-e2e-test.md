# RIF-034: E2E-003 sorteo end-to-end ⭐ CRITICAL (CI GATE)

| Field              | Value                                                |
| ------------------ | ---------------------------------------------------- |
| **Epic**           | EPIC-003 Public View & Draw                          |
| **Priority**       | **P0 — CRITICAL**                                    |
| **Story Points**   | 5                                                    |
| **Dependencies**   | RIF-026, RIF-029, RIF-030, RIF-031, RIF-032, RIF-008 |
| **User Stories**   | US-016, US-018, US-024, US-025                       |
| **Features**       | FT-008, FT-009, FT-013                               |
| **Business Rules** | BR-004, BR-005, BR-006                               |
| **E2E ID**         | E2E-003                                              |
| **Agents**         | `quality-engineer`, `test-engineer`                  |
| **Skills**         | `kb-e2e`, `kb-playwright`                            |

## Problem

Test E2E que valida el sorteo end-to-end: pre-sorteo commit publicado → admin ejecuta → server compute + reveal → visitante ve replay con mismo ganador → visitante verifica commit-reveal ✅. Si este test no pasa, el "North Star" del producto está roto.

## Acceptance Criteria

```gherkin
Given setup:
  - Raffle con maxTickets=10, drawDate (mockeada al pasado)
  - 5 tickets vendidos por 2 sellers a 5 buyers distintos
  - seedCommit publicado en raffle.seedCommit
When ejecuto la E2E test
Then:

ACTO 1 — Pre-sorteo público
  - Abro /r/{publicSlug} como visitante (browser context limpio)
  - Verifico que seedCommit truncado es visible en footer
  - Verifico que rngSeed NO está en el HTML (page.content() no contiene el rngSeed real)
  - Click "¿Cómo se verifica este sorteo?" → modal explicativo aparece

ACTO 2 — Admin ejecuta
  - Cambio context al admin (otro browser context)
  - Abro /admin/{token}/raffles/{id}/draw
  - Verifico botón "Ejecutar Sorteo" enabled
  - Click + confirm
  - Espero animación (page.waitFor 4500ms)
  - Verifico "Ganador: #N" en la pantalla

ACTO 3 — Visitante post-sorteo verifica
  - Vuelvo al context visitante, recargo /r/{publicSlug}
  - Verifico que muestra mismo ganador #N (replay determinista)
  - Verifico que rngSeed ahora SI es visible (revelado)
  - Click "Verificar este sorteo"
  - Espero promesa Web Crypto
  - Verifico que aparece "✅ Sorteo verificado"
  - Verifico que computedHash === seedCommit (mismo string)

Y al final:
  - DB assertions: raffle.status='drawn', winner_ticket_id NOT NULL, rng_seed NOT NULL, drawn_at NOT NULL
  - Function assertions: seedToWinner(rngSeed, soldIds).winnerTicketId === raffle.winnerTicketId

Given el test corre en CI
When falla en cualquier paso
Then deploy queda bloqueado
```

## Implementation notes

```ts
// tests/e2e/draw.spec.ts
test.describe('@critical — Sorteo end-to-end', () => {
  test('E2E-003: pre-sorteo commit → admin ejecuta → visitante verifica', async ({ browser }) => {
    // Setup
    await resetDb(db);
    const raffle = await setupRaffleWithSoldTickets({ maxTickets: 10, soldCount: 5 });
    // Force drawDate al pasado
    await db
      .update(raffles)
      .set({ drawDate: new Date(Date.now() - 60_000) })
      .where(eq(raffles.id, raffle.id));

    // ACTO 1
    const visitorCtx = await browser.newContext();
    const visitorPage = await visitorCtx.newPage();
    await visitorPage.goto(`/r/${raffle.publicSlug}`);
    await expect(visitorPage.locator(`text=${raffle.seedCommit.slice(0, 8)}`)).toBeVisible();
    expect(await visitorPage.content()).not.toContain(raffle.rngSeed!);

    // ACTO 2
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await adminPage.goto(`/admin/${ADMIN_TOKEN}/raffles/${raffle.id}/draw`);
    await adminPage.click('text=Ejecutar Sorteo');
    await adminPage.click('text=Confirmar');
    await adminPage.waitForTimeout(4500);
    await expect(adminPage.locator('text=GANADOR')).toBeVisible();

    // ACTO 3
    await visitorPage.reload();
    await expect(visitorPage.locator(`text=${raffle.rngSeed!.slice(0, 8)}`)).toBeVisible();
    await visitorPage.click('text=Verificar este sorteo');
    await expect(visitorPage.locator('text=Sorteo verificado')).toBeVisible({ timeout: 3000 });

    // DB invariants
    const final = await db.query.raffles.findFirst({ where: eq(raffles.id, raffle.id) });
    expect(final?.status).toBe('drawn');
    expect(final?.winnerTicketId).toBeTruthy();
    expect(final?.drawnAt).toBeTruthy();
  });
});
```

- Tag `@critical` → corre en gate
- Helper `setupRaffleWithSoldTickets` en builders (RIF-008)
- Mock drawDate al pasado vía direct DB update

## Done when

- [ ] Test escrito y pasa local
- [ ] CI: tag `@critical` corre en cada PR como bloqueante
- [ ] Test 10x consecutivo sin flakiness
- [ ] Code review by quality-engineer
