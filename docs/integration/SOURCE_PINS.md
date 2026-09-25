# Source pins and review scope

Reviewed 25 September 2026. Existing local clones were reused; neither reference tree was modified. GitHub current HEAD was checked through `gh api repos/CopilotKit/{openmuse,openbot}/commits/HEAD`.

| Project | Local path | Reviewed commit | Upstream commit date |
| --- | --- | --- | --- |
| OpenMuse | `reference/openmuse` | [f5534c77a8c8740cf792ca73b1f7737829fb7518](https://github.com/CopilotKit/openmuse/tree/f5534c77a8c8740cf792ca73b1f7737829fb7518) | 2026-09-24T23:52:00Z |
| OpenBot | `reference/openbot` | [3c73cf00efba46122dfd0447485e2b61f1d6a2cd](https://github.com/CopilotKit/openbot/tree/3c73cf00efba46122dfd0447485e2b61f1d6a2cd) | 2026-09-23T18:18:02Z |

## Verified manifest facts

| Surface | OpenMuse | OpenBot |
| --- | --- | --- |
| Package manager | pnpm 11.19.0 | Bun 1.3.14 |
| Server runtime | Node; engines >=22; README recommends Node 24 LTS | Bun |
| UI | Expo / React Native / React Native Web | React 19.2, Vite 7, TanStack Router/Query |
| CopilotKit | 1.70.1 | 1.70.1 |
| AG-UI core/client | 0.0.59 | 0.0.59 |
| Operational store | Embedded PGlite or PostgreSQL | PostgreSQL / Drizzle |
| Conversation persistence | CopilotKit Intelligence required | CopilotKit Intelligence required |
| License files | MIT, OpenMuse contributors | MIT, CopilotKit |

CopilotKit Intelligence is a separate service/dependency; the repository MIT licenses do not by themselves grant an Intelligence deployment entitlement. Preserve upstream license/copyright notices in copied material and disclose what was reused versus built for the hackathon. Check the event's reuse policy with organizers if it is not published; preparation and source inspection are distinct from claiming pre-existing code as event-created work.

## Local tooling observed (not a compatibility test)

- Node v25.2.1
- Bun 1.3.2 — older than OpenBot's pinned 1.3.14
- pnpm 11.19.0
- Docker CLI 24.0.7 — daemon availability was not tested.

The three reviewers used the user-requested HIGH → Luna/high lane for bounded source review. `TYPESAFE_API_KEY` was absent; no Jev call was made. No code implementation cycle occurred, and no model judgment substitutes for build/typecheck/test evidence.

## What was and was not verified

Verified: source layouts, critical execution paths, package manifests, license files, current commit IDs, relevant existing tests, and integration seams.

Not verified: dependency installation, successful application startup, CopilotKit Intelligence account entitlement, sponsor credentials, Docker daemon, local Liquid inference, or either application's complete test suite. This deliverable is an implementation plan, not a working integration.

Pre-existing workspace changes in `.gitignore` and `docs/candidates/` were left in place. Existing `FINAL_PROJECT.md` and `WIN_PLAN.md` were treated as the newer domain specification; the new integration plan describes the changes necessary to put that specification inside the two reference architectures.
