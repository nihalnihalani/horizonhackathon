# Full-plan completion waves (branch `full-plan`)

Started 2:22 PM PT, 25 Sep 2026, after the three-hour cut shipped. Target: close the gaps between the as-built code and
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) / [CONTRACTS.md](CONTRACTS.md), demo-visible items first. `main` stays
recording-safe; each green wave is pushed to `origin/full-plan`.

## Architecture decision (lead, Opus 5.5)

Evolve the working npm `packages/*` workspace; do **not** rewrite it into the plan's Bun `services/*` layout. The
decisive tradeoff: the as-built code already passes real-SIGKILL recovery live, and a layout rewrite adds risk without
changing any invariant. Deviations recorded here are intentional.

- **Canonical events under the rows.** The control actor stays the single writer. Every canonical row it appends is
  first written as a typed `mission_events` event (`packages/shared/src/events.ts`, payload = `{table,row}`); the
  legacy tables become derived mirrors. Non-row transitions (`DISPATCH_CLAIMED`, `COMMAND_ACCEPTED`, pause/cancel,
  status changes) are events only. Restore = latest valid checkpoint at or below the watermark + contiguous ordered
  events (S01–S10). Metrics stay non-canonical.
- **Lifecycle** (`packages/shared/src/mission.ts`): CONTRACTS §3 statuses, orthogonal `reconciliationStatus`,
  transition table, command records (D02–D04), dispatch claims, named crash points.
- **Dispatch claim** is an actor-serialized command between intent visibility and the desk POST (CONTRACTS §6).
- Arms: `dr`, `naive` (= contract `transcript-ablation`), and `checkpoint` (wave 2: `checkpoint-summary-v1`).

## Waves and ownership

| Wave | Owner | Files (exclusive) | Acceptance |
|---|---|---|---|
| 1-E events/checkpoints | storage builder | `packages/storage/src/event-log.ts`, `event-restore.ts`, `checkpoint.ts`, `storage/test/events.test.ts`, storage `index.ts` exports | S01–S10 (S10 at library level) |
| 1-L lifecycle/claims/crash points | control builder | `packages/control/src/{lifecycle,actor,server,mission-port}.ts`, `packages/kernel/**`, `packages/runner/**`, control/kernel tests | D01–D04, R01, R03, R04–R11 |
| 1-O OpenBot auth + mission UI | console builder | `apps/console/**`, `packages/control/src/ag-ui/**`, `packages/control/src/auth.ts` | U03, U05, U07; mission route renders `MissionSnapshot` |
| 2-I integration | lead | swap `CanonicalEventSink` into the actor, restore from events, S10 real subprocess | R02 still green; S10 |
| 2-B benchmark/memory | bench builder | `bench/**`, `docs/results/**` | M1/C06/C07/C03, B01, `checkpoint-summary-v1`, F1–F6 |
| 2-T tooling | lead | root `package.json` scripts, `THIRD_PARTY_NOTICES.md`, `packages/task-kernel` | scripts exist and fail honestly |
| each wave | devil's advocate (Fable, read-only) | findings only | dispositions recorded in WORKLOG |

The shared contract files (`shared/src/mission.ts`, `shared/src/events.ts`, the `Projection.mission` field) are owned by
the lead. Builders request changes rather than edit them.
