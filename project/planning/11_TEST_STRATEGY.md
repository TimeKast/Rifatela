# 11 — Test Strategy

> **Proyecto:** Rifatela
> **Source:** `SK.md §4`, [`05_BUSINESS_RULES.md`](./05_BUSINESS_RULES.md), [`04_USER_STORIES.md`](./04_USER_STORIES.md)
> **Estado:** v1.0
> **Stack:** Vitest (unit + component RTL) + Playwright (E2E) — heredado del kit

---

## Filosofía

Rifatela es un sistema con un invariant central (zero doble-venta) + un mecanismo de trust (commit-reveal). El test strategy se ordena por **lo que rompe el producto si falla**, no por cobertura porcentual.

**Priority order:**

1. **Invariants críticos** (concurrency, immutability, commit-reveal) — testeo exhaustivo, no negociable
2. **Happy paths** de los flujos principales — E2E
3. **Sad paths** que el user vería (errores, validaciones) — component tests
4. **Edge cases** en lógica de negocio — unit tests
5. **Visual / accessibility** — Lighthouse CI + smoke tests

---

## Pirámide (per `SK.md §4.2`)

```
                ┌─────────────────┐
                │  E2E (Playwright)│   ~10-15 scenarios
                │     critical paths│   • Sorteo end-to-end
                │                  │   • Concurrency race
                └────────┬─────────┘   • Commit-reveal verify
                         │
                ┌────────┴─────────┐
                │ Component (RTL)   │   ~25-35 tests
                │  + jsdom          │   • Forms (validation)
                │                   │   • Grids (render states)
                └────────┬──────────┘   • Animations (replay)
                         │
                ┌────────┴──────────┐
                │ Unit (Vitest node)│   ~40-60 tests
                │  pure functions   │   • seedToWinner determinism
                │                   │   • publicInitials
                └───────────────────┘   • atomic UPDATE wrapper
```

**Coverage targets:**

- Unit: **≥90%** sobre `src/lib/draw/`, `src/lib/actions/`, `src/lib/utils/`
- Component: **≥80%** sobre `src/components/{raffles,sellers,public}/`
- E2E: **100%** de los flows críticos listados en §3

> **NO target porcentual sobre el repo entero.** Cubrir lo crítico bien > cubrir todo mal.

---

## §1 — Unit tests (Vitest)

### Críticos (no negociables)

#### `seedToWinner` — determinismo

```ts
// tests/unit/lib/draw/seedToWinner.test.ts
describe('seedToWinner', () => {
  it('is deterministic: same seed + same tickets → same winner', () => {
    const seed = 'abc123def456';
    const tickets = ['t1', 't2', 't3', 't4', 't5'];
    const r1 = seedToWinner(seed, tickets);
    const r2 = seedToWinner(seed, tickets);
    expect(r1).toEqual(r2);
  });

  it('different seeds produce different winners (statistically)', () => {
    const tickets = Array.from({ length: 100 }, (_, i) => `t${i}`);
    const results = Array.from(
      { length: 1000 },
      () => seedToWinner(crypto.randomBytes(32).toString('hex'), tickets).winnerIndex
    );
    const uniqueWinners = new Set(results).size;
    expect(uniqueWinners).toBeGreaterThan(50); // ~uniform distribution
  });

  it('throws on empty sold tickets (BR-005, BR-007)', () => {
    expect(() => seedToWinner('seed', [])).toThrow('no_tickets_sold');
  });

  it('single ticket wins (edge case)', () => {
    expect(seedToWinner('seed', ['t1']).winnerTicketId).toBe('t1');
  });
});
```

#### `verifyDraw` — commit-reveal

```ts
describe('verifyDraw', () => {
  it('valid: sha256(seed) matches commit → true', async () => {
    const seed = 'mysecret';
    const commit = sha256Hex(seed);
    const r = await verifyDraw(commit, seed);
    expect(r.valid).toBe(true);
    expect(r.computedHash).toBe(commit);
  });

  it('invalid: sha256(differentSeed) ≠ commit → false', async () => {
    const commit = sha256Hex('mysecret');
    const r = await verifyDraw(commit, 'tampered');
    expect(r.valid).toBe(false);
  });
});
```

#### `publicInitials` (BR-009)

```ts
describe('publicInitials', () => {
  it.each([
    ['Juan Pérez', 'J.P.'],
    ['María de los Ángeles García', 'M.D.'],
    ['Cher', 'C.'],
    [null, 'Anónimo'],
    ['', 'Anónimo'],
  ])('"%s" → "%s"', (input, expected) => {
    expect(publicInitials(input)).toBe(expected);
  });
});
```

#### `claimTicket` server action — mocked DB

```ts
describe('claimTicket', () => {
  it('returns ticket on rowCount=1', async () => {
    mockDb.update.mockReturnValueOnce({ returning: () => [{ id: 't1', status: 'sold' }] });
    const r = await claimTicket({ sellerToken, ticketId: 't1', buyerId: 'b1' });
    expect(r.ok).toBe(true);
  });

  it('returns ticket_already_sold on rowCount=0 (BR-002)', async () => {
    mockDb.update.mockReturnValueOnce({ returning: () => [] });
    const r = await claimTicket({ sellerToken, ticketId: 't1', buyerId: 'b1' });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('ticket_already_sold');
  });

  it('returns raffle_immutable if raffle drawn/archived (BR-010)', async () => {
    mockDb.query.raffles.findFirst.mockReturnValueOnce(null);
    const r = await claimTicket({ sellerToken, ticketId: 't1', buyerId: 'b1' });
    expect(r.code).toBe('raffle_immutable');
  });
});
```

### Importantes (high coverage)

- `createRaffle` — validation, side effects (raffle + prize + tickets bulk insert)
- `executeDraw` — preconditions chain (BR-005), seed reveal in response
- `revertSale` — admin-only enforcement (US-021), AdminAction persisted
- `rotateSellerToken` — old token dies, new token works
- Zod schemas — validation paths

---

## §2 — Component tests (Vitest + RTL + jsdom)

### Críticos

#### Grilla pública con dataset mixto

```tsx
// tests/unit/components/PublicTicketGrid.test.tsx
describe('<PublicTicketGrid>', () => {
  it('renders tickets disponibles + vendidos con iniciales', () => {
    const tickets = [
      { number: 1, status: 'available', buyerInitials: null },
      { number: 2, status: 'sold', buyerInitials: 'J.P.' },
      { number: 3, status: 'sold', buyerInitials: 'Anónimo' },
    ];
    render(<PublicTicketGrid tickets={tickets} />);
    expect(screen.getByTestId('ticket-1')).toHaveTextContent('1');
    expect(screen.getByTestId('ticket-2')).toHaveTextContent('J.P.');
    expect(screen.getByTestId('ticket-3')).toHaveTextContent('Anónimo');
  });

  it('NO expone phone ni email del comprador (BR-009)', () => {
    const tickets = [
      {
        number: 1,
        status: 'sold',
        buyerInitials: 'J.P.',
        // ⚠️ Si el prop tipa permite phone, este test detecta fuga
      },
    ];
    const { container } = render(<PublicTicketGrid tickets={tickets} />);
    expect(container.innerHTML).not.toMatch(/@|\+54|\d{8,}/);
  });
});
```

#### Form de comprador (US-009)

```tsx
describe('<BuyerForm>', () => {
  it('permite registro con todos los campos vacíos (BR-008)', async () => {
    const onSubmit = vi.fn();
    render(<BuyerForm onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: /registrar/i }));
    expect(onSubmit).toHaveBeenCalledWith({ name: '', phone: '', email: '' });
  });

  it('valida email format si está presente', async () => {
    render(<BuyerForm onSubmit={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/email/i), 'no-es-email');
    await userEvent.click(screen.getByRole('button', { name: /registrar/i }));
    expect(screen.getByText(/email inválido/i)).toBeVisible();
  });
});
```

#### Countdown component

```tsx
describe('<RaffleCountdown>', () => {
  it('decrementa cada segundo', () => {
    vi.useFakeTimers();
    const drawDate = new Date(Date.now() + 60_000); // 60s
    render(<RaffleCountdown drawDate={drawDate} />);
    expect(screen.getByText('00:01:00')).toBeVisible();
    vi.advanceTimersByTime(1000);
    expect(screen.getByText('00:00:59')).toBeVisible();
  });

  it('muestra "Sorteo en curso" cuando llega a 0', () => {
    vi.useFakeTimers();
    const drawDate = new Date(Date.now() + 1000);
    render(<RaffleCountdown drawDate={drawDate} />);
    vi.advanceTimersByTime(2000);
    expect(screen.getByText(/sorteo en curso/i)).toBeVisible();
  });
});
```

#### Rueda de la fortuna (replay determinista)

```tsx
describe('<DrawWheel>', () => {
  it('replay: mismo seed → misma rotación final', () => {
    const seed = 'fixed-seed-123';
    const tickets = ['t1', 't2', 't3'];
    const { rerender } = render(<DrawWheel seed={seed} tickets={tickets} />);
    const finalRotation1 = screen.getByTestId('wheel').style.transform;
    rerender(<DrawWheel seed={seed} tickets={tickets} />);
    const finalRotation2 = screen.getByTestId('wheel').style.transform;
    expect(finalRotation1).toBe(finalRotation2);
  });

  it('respect prefers-reduced-motion', () => {
    window.matchMedia = () => ({ matches: true }) as any;
    render(<DrawWheel seed="s" tickets={['t1']} />);
    expect(screen.getByTestId('wheel-reduced-motion-fallback')).toBeVisible();
  });
});
```

### Importantes

- `<RaffleForm>` — create/edit con validations
- `<SellerList>` — copy URL + rotate dialog
- `<AdminDashboard>` — metrics render con 0/1/N rifas
- `<TicketDigital>` — share button + content
- `<VerifyDrawButton>` — call Web Crypto + show ✅/❌

---

## §3 — E2E tests (Playwright)

### Críticos — No negociables

| E2E ID  | Escenario                                    | BRs / FTs validados                    | Detalle en doc 12 |
| ------- | -------------------------------------------- | -------------------------------------- | ----------------- |
| E2E-001 | Admin crea rifa + abre vista pública         | FT-001, FT-007                         | ✅                |
| E2E-002 | **Vendedor vende ticket + concurrency race** | FT-005, **FT-006 (CRITICAL)**, BR-002  | ✅                |
| E2E-003 | Sorteo end-to-end con replay verificable     | FT-008, FT-009, FT-013, BR-005, BR-006 | ✅                |
| E2E-004 | Admin revierte venta                         | FT-011, BR-010, BR-011                 | ✅                |
| E2E-005 | Vendedor archivado → token muere             | FT-002, BR-013                         | ✅                |
| E2E-006 | Sorteo: no se puede ejecutar dos veces       | FT-008, BR-005                         | ✅                |

### Importantes

| E2E ID  | Escenario                                     | BRs / FTs            |
| ------- | --------------------------------------------- | -------------------- |
| E2E-007 | Rotar URL del vendedor                        | FT-002, BR-012       |
| E2E-008 | Rifa archivada: URL pública sigue funcionando | FT-007, BR-015       |
| E2E-009 | Buyer registrado sin datos (anónimo)          | FT-004, BR-008       |
| E2E-010 | Lighthouse audit vista pública ≥90            | FT-007 + performance |

> Detalle paso a paso en [`12_E2E_SCENARIOS.md`](./12_E2E_SCENARIOS.md).

---

## §4 — Concurrency test (la joya de la corona)

```ts
// tests/e2e/concurrency.spec.ts
test('E2E-002b — dos vendedores tocan el mismo número (BR-002)', async ({ browser }) => {
  // Setup: rifa con 1 ticket disponible (max=1), 2 vendedores
  const raffle = await setupRaffleWithTickets({ maxTickets: 1 });
  const [sellerA, sellerB] = await setupSellers({ count: 2 });

  // Open dos contextos browser concurrentes
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  // Navegar ambos al panel de su vendedor
  await pageA.goto(`/v/${sellerA.token}`);
  await pageB.goto(`/v/${sellerB.token}`);

  // Registrar buyer en ambos
  await registerBuyer(pageA, { name: 'A' });
  await registerBuyer(pageB, { name: 'B' });

  // Fire claim del MISMO ticket en paralelo
  const [resA, resB] = await Promise.all([
    pageA.click(`[data-ticket="${raffle.ticketId}"]`),
    pageB.click(`[data-ticket="${raffle.ticketId}"]`),
  ]);

  // ASSERT crítico: solo UNO ganó
  const dbTicket = await db.query.tickets.findFirst({ where: eq(id, raffle.ticketId) });
  expect(dbTicket.status).toBe('sold');
  expect(dbTicket.buyerId).toBeTruthy(); // uno solo

  // ASSERT: el perdedor vio el toast
  const losingPage = dbTicket.sellerId === sellerA.id ? pageB : pageA;
  await expect(losingPage.getByText(/ya se vendió/i)).toBeVisible();
});
```

> Este test **no es opcional**. Si no pasa, no hay deploy.

---

## §5 — Lighthouse CI (performance + a11y + PWA)

Config en `lighthouserc.js`:

```js
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000/r/test-slug'], // SSG vista pública
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.85 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.85 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
      },
    },
  },
};
```

Corre en CI sobre vista pública (la que más impacta perfil real de uso WhatsApp share).

---

## §6 — Test data / fixtures

### Builders (factory pattern)

```ts
// tests/fixtures/builders.ts
export const aRaffle = (overrides?: Partial<Raffle>): Raffle => ({
  id: crypto.randomUUID(),
  name: 'Rifa Test',
  maxTickets: 100,
  drawDate: addDays(new Date(), 7),
  status: 'open',
  seedCommit: sha256Hex('test-seed'),
  publicSlug: nanoid(10),
  archivedAt: null,
  createdAt: new Date(),
  ...overrides,
});

export const aTicket = ...
export const aSeller = ...
export const aBuyer = ...
```

### DB seeds para E2E

`scripts/test-seed.ts` ejecutado en `beforeAll` de la suite E2E. Reset entre tests:

```ts
beforeEach(async () => {
  await db.delete(adminActions);
  await db.delete(tickets);
  await db.delete(buyers);
  await db.delete(prizes);
  await db.delete(raffles);
  await db.delete(sellers);
});
```

---

## §7 — Cross-cutting concerns

### Mobile testing (FT-014)

- Playwright config con `viewport: { width: 375, height: 667 }` para E2E críticos
- Visual regression (opcional, post-MVP): Chromatic / Percy snapshot en 375/768/1280

### Accessibility (a11y)

- `@axe-core/playwright` corre en E2E críticos
- Assert: `expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])`
- Lighthouse a11y ≥ 90

### Security smoke tests

- `assertSeller(invalidToken)` → 404 (not 401, no filtra info)
- `revertSale` con seller credentials → 403
- XSS attempt en `Raffle.name`: input `<script>` → rendered como texto

---

## §8 — Coverage matrix (BR → tests)

| BR     | Test type                  | File / pattern                                        |
| ------ | -------------------------- | ----------------------------------------------------- |
| BR-001 | DB constraint              | Migration test + unit (uniqueness)                    |
| BR-002 | **E2E concurrency** + unit | `concurrency.spec.ts` + `claimTicket.test.ts`         |
| BR-003 | E2E                        | E2E-001 ampliado (vender todo + countdown sigue)      |
| BR-004 | Unit                       | `seedToWinner.test.ts`                                |
| BR-005 | E2E + unit                 | E2E-003, E2E-006, `executeDraw.test.ts`               |
| BR-006 | Unit + E2E                 | `verifyDraw.test.ts`, E2E-003                         |
| BR-007 | Unit                       | `executeDraw.test.ts` con `soldCount=0`               |
| BR-008 | Component + E2E            | `BuyerForm.test.tsx`, E2E-009                         |
| BR-009 | Unit + Component           | `publicInitials.test.ts`, `PublicTicketGrid.test.tsx` |
| BR-010 | E2E + unit                 | E2E-006, middleware tests                             |
| BR-011 | E2E                        | E2E-004 + US-021 negative test                        |
| BR-012 | E2E                        | E2E-007                                               |
| BR-013 | E2E                        | E2E-005                                               |
| BR-014 | API contract test          | `archiveRaffle.test.ts` con sales=0 vs sales>0        |
| BR-015 | E2E                        | E2E-008                                               |

---

## §9 — CI pipeline

`.github/workflows/ci.yml` (heredado del kit + adaptado):

```yaml
jobs:
  verify:
    steps:
      - pnpm install --frozen-lockfile
      - pnpm lint
      - pnpm typecheck
      - pnpm test # unit + component
      - pnpm test:e2e # E2E (con Neon test branch o testcontainer Postgres)
      - lhci autorun # Lighthouse CI
```

**Gates:**

- ❌ Fail si: lint errors, typecheck errors, unit/component fails, E2E críticos fail, Lighthouse <85 performance
- ⚠️ Warn si: Lighthouse <90 SEO

---

## §10 — Anti-patterns prohibidos

| ❌ Anti-pattern                           | Por qué NO                                | Alternativa                                                             |
| ----------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| `expect(Component).toBeDefined()`         | Test shallow (SK.md §4.2)                 | Render + interact + assert DOM                                          |
| Mockear DB en todos los tests             | Pierde garantías de schema/atomic UPDATE  | Unit: mock OK; Integration: real Postgres (Neon branch o testcontainer) |
| Coverage % como goal único                | Cubre lo trivial, deja invariants sueltos | Priorizar BRs críticas                                                  |
| E2E sin reset entre tests                 | Flaky, data crosstalk                     | `beforeEach` reset                                                      |
| Skip de concurrency test si "tarda mucho" | Es EL test crítico del producto           | Mantenerlo, optimizar speed (paralelizar, reducir maxTickets)           |

---

_11 Test Strategy — Rifatela — 3 layers + BR coverage matrix + concurrency E2E como joya de la corona_
