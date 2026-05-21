# RIF-037: Archive raffle (BR-014, BR-015)

| Field              | Value                                       |
| ------------------ | ------------------------------------------- |
| **Epic**           | EPIC-004 Admin Tools & Polish               |
| **Priority**       | P1                                          |
| **Story Points**   | 3                                           |
| **Dependencies**   | RIF-001, RIF-012, RIF-009                   |
| **User Stories**   | US-015                                      |
| **Business Rules** | BR-014, BR-015                              |
| **Agents**         | `backend-specialist`, `frontend-specialist` |
| **Skills**         | `kb-server-actions`                         |
| **API Contract**   | `archiveRaffle(input)` doc 08               |

## Problem

Admin puede archivar una rifa (soft-delete via `archived_at`). Esto la oculta del dashboard por default pero la URL pública sigue accesible (BR-015 — links viejos no se rompen).

## Acceptance Criteria

```gherkin
Given una rifa cualquiera (open o drawn, con o sin ventas)
When admin click "Archivar" en SCR-003 menú
Then ConfirmDialog destructive aparece con info: "Esta rifa se ocultará del dashboard. La URL pública seguirá funcionando."
And input opcional "Razón"

When confirmo
Then archiveRaffle action invoke:
  - SET archived_at=NOW() WHERE id=?
  - INSERT AdminAction(action_type='archive_raffle', details={reason})
And toast "Rifa archivada"
And redirige al dashboard

Given dashboard default
When abre /admin
Then NO ve la rifa archivada
When toggle "incluir archivadas"
Then SI la ve, con badge "Archivada"

Given E2E-008
When visitante abre /r/{publicSlug} de rifa archivada
Then ve la rifa normal (BR-015 — no 404)

Given intento delete (hard) vía API
When invoke
Then 404 (no existe el endpoint hard-delete en MVP — solo archive)

Given rifa archivada que vuelvo a archivar (idempotencia)
When invoke
Then es no-op (archived_at no se actualiza) — opcional, también puede retornar error 'already_archived'
```

## Implementation notes

```ts
// src/lib/actions/raffles/archive.ts
export const archiveRaffle = (input: unknown) =>
  withAuth(
    { resource: 'raffles', action: 'archive', schema: ArchiveRaffleSchema },
    input,
    async (data) => {
      await db
        .update(raffles)
        .set({ archivedAt: new Date() })
        .where(and(eq(raffles.id, data.raffleId), isNull(raffles.archivedAt)));

      await db.insert(adminActions).values({
        actionType: 'archive_raffle',
        raffleId: data.raffleId,
        details: { reason: data.reason },
      });

      revalidatePath('/admin');
      return { ok: true, data: { archivedAt: new Date() } };
    }
  );
```

- Dashboard query del RIF-009 ya filtra por `archived_at IS NULL` con toggle
- Vista pública NO filtra por archived_at (BR-015)

## Done when

- [ ] Action implementada
- [ ] UI integrada en SCR-003 menú "Archivar"
- [ ] Unit test
- [ ] E2E-008: archivar rifa + URL pública sigue 200
- [ ] `pnpm verify` pasa
