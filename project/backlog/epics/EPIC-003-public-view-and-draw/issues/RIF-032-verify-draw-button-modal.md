# RIF-032: `<VerifyDrawButton>` + SCR-010 Verify modal

| Field              | Value                                     |
| ------------------ | ----------------------------------------- |
| **Epic**           | EPIC-003 Public View & Draw               |
| **Priority**       | P0                                        |
| **Story Points**   | 3                                         |
| **Dependencies**   | RIF-025, RIF-028 (verifyDraw function)    |
| **User Stories**   | US-024, US-025                            |
| **Features**       | FT-013                                    |
| **Business Rules** | BR-006                                    |
| **Screens**        | SCR-010                                   |
| **Components**     | CMP-011                                   |
| **Agents**         | `frontend-specialist`, `security-auditor` |
| **Skills**         | `kb-components`, `kb-web-crypto`          |

## Problem

Botón + modal para que visitante verifique commit-reveal cliente-side. States: idle → computing → success ✅ / failure ❌. Muestra el cálculo step-by-step para transparencia.

## Acceptance Criteria

```gherkin
Given raffle status='open' (pre-sorteo)
When render <VerifyDrawButton seedCommit={...} rngSeed={null} />
Then button está disabled
And texto "Se podrá verificar después del sorteo"

Given raffle status='drawn' (rng_seed revelado)
When render
Then button enabled, label "✅ Verificar este sorteo", primary style

Given click en el botón
When abre el modal SCR-010
Then muestra:
  - "Hash publicado pre-sorteo": <SeedCommitDisplay value={seedCommit} />
  - "Seed revelado en sorteo": <SeedCommitDisplay value={rngSeed} />
  - "Hash recalculado aquí": spinner "Calculando..."
And invoca verifyDraw(seedCommit, rngSeed) async

Given verifyDraw retorna { valid: true, computedHash }
When la promesa resuelve
Then muestra:
  - "Hash recalculado": <SeedCommitDisplay value={computedHash} /> con border verde
  - Card verde grande "✅ SORTEO VERIFICADO — El hash coincide. El sorteo no fue manipulado."
And card flip animation 300ms

Given verifyDraw retorna { valid: false, computedHash }
When la promesa resuelve
Then muestra:
  - "Hash recalculado": border rojo
  - Card roja grande "❌ HASH NO COINCIDE — Contactá al organizador."
And este caso debe ser teóricamente imposible si server no manipuló rngSeed

Given user tiene Web Crypto API
When invoke
Then funciona

Given browsers sin Web Crypto (legacy)
When invoke
Then fallback: deshabilita button + texto "Tu navegador no soporta verificación"
```

## Implementation notes

- `<VerifyDrawButton>` Client Component
- Modal: shadcn Dialog primitive
- Computation usa async/await + small artificial delay (200-400ms) para mostrar el "calculando" feedback (UX, no funcional)
- Estado en local component state: idle / computing / success / failure
- Resultado NO se cachea — cada vez que abre el modal, recalcula (transparencia)

## Done when

- [ ] Component + modal implementados
- [ ] Component tests: estados pre/post sorteo + valid/invalid scenarios
- [ ] E2E (parte E2E-003 Acto 3): visitante presiona verify → ✅
- [ ] Unit test: si `seedCommit` tampered, muestra ❌
- [ ] `pnpm verify` pasa
