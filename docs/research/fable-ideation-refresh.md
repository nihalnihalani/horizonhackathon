# Fresh Fable ideation — 25 September 2026

## Provenance

Actual invocation through the installed, authenticated Claude CLI: `--model fable --effort high`, safe mode, tools disabled, no session persistence. Resolved model reported by the CLI: **claude-fable-5-1**. The first sandboxed attempt could not read existing authentication; the approved outside-sandbox call used the existing Claude subscription and succeeded. No login or credential changes were made.

Round 1 duration: 100.4 seconds. CLI list-price estimate: $0.4255 (not a claim of an extra subscription charge). These are brainstorming proposals, **not verified performance results**. Sponsor/API facts were supplied from local briefs; Fable did no independent web research.

Raw response: [fable-ideation-raw.json](fable-ideation-raw.json). Exact prompt: [fable-ideation-prompt.txt](fable-ideation-prompt.txt).

## Reviewer cautions

- The proposed 1/5 versus 5/5 outcome is hypothetical. No benchmark was run. Evaluate a fixed suite and report actual results, including ties; do not select only failures of a baseline.
- Sponsor removal tests in round 1 overclaim necessity. These are load-bearing components in the proposed implementation, but alternative databases or deterministic curators could serve the same architectural role.
- Supersession, temporal state, intelligent forgetting, and crash resume already have strong prior art. They are mechanisms, not sufficient novelty claims.
- RawTree stores an append-only patch log; current mutable state is a projection. Do not imply support for transactional row mutation.
- The recommendations below are Fable's actual output, preserved verbatim for traceability; they are not the final research conclusion.

## Round 1 — actual Fable output

Here are six ideas, then the top two. All sponsor claims below are proposals against the stated capabilities, not verified results.

**1. Pull the Plug** (continuity under catastrophe)
- Pitch: a codebase-migration agent that survives being killed mid-run and resumes at the exact file, without re-reading its own transcript or re-fetching the web.
- Who needs it: anyone running multi-hour agent jobs that die on rate limits, deploys, or laptop lids. Failure prevented: restarting from zero and redoing paid work.
- Demo beat: objective is migrating a real 40-file repo from pydantic v1 to v2. At file 23 a big red button labeled TEST EVENT kills the process. Screen goes dark. Restart. Agent reads a 2 KB projection, says "resuming at file 24, symbol map has 11 entries," finishes, tests go green. Counter shows files reprocessed: 0.
- State: durable is a typed ledger of per-file status plus a per-symbol API map with source citation ids. Discarded is every raw diff, every fetched doc page, and all chain-of-thought. Intelligent forgetting: once a file's tests pass, its diff and reasoning are evicted and only a hash plus status remain. Selective recall pulls one file's history only if its tests later fail.
- Sponsors: RawTree stores ledger patches, argMax projection gives current state, resume is a query. Remove it and restart must replay a transcript. Nimble fetches the migration guide and changelog once, cached for replay. Remove it and the symbol map is hand-written, which judges will notice. Liquid curates each observed symbol into keep, supersede, or discard as constrained JSON. Remove it and the ledger bloats with every doc excerpt and resume cost climbs.
- MVP cuts: one repo, one kill point, planner is an ordinary local model. Test: kill at file N, assert reprocessed files equals zero and suite passes. Fair baseline is restart by replaying the full transcript log. It proves resume tokens and correctness on this repo only.
- Hardest assumption: the migration itself works reliably in five hours. Reduce by pre-running the migration and choosing files the planner already handles.

**2. Unlearn** (contrarian deletion)
- Pitch: an agent that writes correct code against a library only because it deliberately deletes superseded API facts it found on the web.
- Who needs it: developers whose agents hallucinate old signatures because the web is full of stale docs. Failure prevented: code that compiles against 2022 and breaks against today.
- Demo beat: objective is five coding tasks against pydantic v2. Nimble returns mixed v1 and v2 excerpts, which is the real state of the web. Split screen. Left agent keeps everything and writes a v1 validator that fails. Right agent's curator marks the v1 claim superseded, evicts it, and writes v2 that passes. Scoreboard shows 1 of 5 versus 5 of 5. Then the user asks "why not the old way?" and the agent recalls the evicted claim with its citation.
- State: durable is a symbol map keyed by function name with version and trust. Discarded is every superseded entry, moved out of the working set entirely, not summarized. Recall is by key on demand only.
- Sponsors: Nimble provides real conflicting excerpts and trust reports used as a tie-breaker input, never as truth. Remove it and the conflict is fabricated. Liquid classifies same-key claims into supersede or keep. Remove it and the planner must read all excerpts, which is the failing baseline. RawTree holds evicted claims so recall works after pages leave the prompt. Remove it and "why not the old way" gets "I don't remember."
- MVP cuts: five tasks, cached search results, one library. Test: pass rate of generated snippets against installed library tests, both arms same planner and prompt. Proves curation helps on this library set, nothing broader.
- Hardest assumption: the full-context baseline actually fails. Reduce by picking known breaking changes such as validator versus field_validator and dict versus model_dump.

**3. Shift Change**
- Pitch: a long support-ticket agent replaced by a fresh instance every ten minutes, with only a typed handover packet crossing the boundary.
- Who needs it: teams whose agents degrade over hours. Failure prevented: the dead-eyed agent that has forgotten the customer's constraint from hour one.
- Demo beat: countdown hits zero, old agent leaves, new one reads a handover packet under 1 KB and immediately honors a constraint stated 40 minutes earlier. Accelerated replay is labeled.
- State: durable is constraints, decisions, open questions. Discarded is all dialogue. Forgetting: resolved questions are removed rather than marked done.
- Sponsors: Nimble researches vendor answers, Liquid writes the handover as constrained JSON, RawTree reconstructs the packet across shifts. Remove RawTree and the packet is a file, which is fatal to differentiation.
- Test: constraint-honoring rate across shifts versus one long-context agent. Weak because a single long-context agent may do fine within demo length.
- Hardest assumption: showing degradation without an intentionally broken baseline. Eliminated for that reason.

**4. Deposition**
- Pitch: hours after a decision, cross-examine the agent and it reconstructs exactly what it knew, from what source, at that moment, though the source text is long gone.
- Who needs it: regulated teams. Failure prevented: "the agent did it and nobody can say why."
- Demo beat: prosecutor-style questions, agent answers with citation ids and excerpts, then a follow-up reveals the evidence changed later and the agent says so.
- State: durable is decision records with evidence ids. Discarded is page text. Recall by decision id.
- Sponsors: Nimble trust reports supply the excerpts, RawTree stores them, Liquid tags which evidence was decision-bearing.
- Test: answer accuracy against a ground-truth event log.
- Hardest assumption: it stays distinct from ASOF. It does not. Bitemporal belief lookup is the same category. Eliminated.

**5. Quarantine**
- Pitch: new web claims enter a probation tier and only reach the working set after corroboration, so one bad forum post cannot poison a day-long plan.
- Who needs it: agents that act on research. Failure prevented: a confidently wrong action from a single source.
- Demo beat: a labeled test-event claim arrives, the agent visibly refuses to promote it, a second search contradicts it, it is evicted with a reason.
- State: durable is promoted facts with corroboration count. Probation is a bounded ring that drops the oldest uncorroborated claims. That drop is the intelligent forgetting.
- Sponsors: Nimble runs the corroborating search and supplies trust as an input, Liquid decides promote or hold, RawTree keeps the probation history.
- Test: fraction of planted claims that reach the working set.
- Hardest assumption: honest planting without simulating the whole problem. Borderline. Strong mechanism, but the disaster is abstract on screen.

**6. Fuel Gauge**
- Pitch: an agent under a shrinking token ration completes a long task by evicting to survive.
- Demo: a gauge drops, the curator evicts, work continues.
- Eliminated: this is budget management dressed as a metaphor, and the prompt is explicit that budget tricks are not novelty.

**Selection**

| Idea | Theme | Demo | Sponsors | Feasible | Different | Total |
|---|---|---|---|---|---|---|
| Pull the Plug | 5 | 5 | 4 | 4 | 3 | 21 |
| Unlearn | 5 | 4 | 5 | 4 | 5 | 23 |
| Quarantine | 4 | 3 | 5 | 3 | 4 | 19 |
| Shift Change | 4 | 3 | 3 | 4 | 2 | 16 |

Top two are Pull the Plug and Unlearn. They share a domain and a state schema, so building one makes the other cheap.

Stronger pick is Unlearn. It is the only idea where deletion is the hero rather than persistence. The five-of-five scoreboard is honest, deterministic, and legible in five seconds. Every sponsor removal breaks a specific visible thing. Its differentiation, as a proposal, is that supersede is a first-class patch type with recall, not a summary.

Why it might still lose. If the full-context baseline happens to write v2 code, the demo collapses, so verify the baseline fails on real cached results before committing. Judges may also read it as narrow to one library. The mitigation is to run the kill-button scene from Pull the Plug as the final ten seconds of the same demo, which the shared ledger makes possible, but only if the core five tasks are green by hour three.

## Round 2 provenance and review

Fresh critique call used the same explicit model and restrictions; resolved model **claude-fable-5-1**. Duration: 84.8 seconds. CLI list-price estimate: $0.3785. Both successful calls total approximately $0.8040 in list-price estimates; actual subscription billing is not established by this metadata.

Exact prompt: [fable-critique-prompt.txt](fable-critique-prompt.txt). Raw response: [fable-critique-raw.json](fable-critique-raw.json).

This prompt added the parent's latest competitor findings and challenged the invented benchmark figures. Fable changed its recommendation to **Dead Reckoning**, a trip agent that reconciles action receipts and revalidates volatile facts after a crash before repairing or blocking its itinerary.

### Corrections required before turning round 2 into an implementation plan

1. **Intent is not a success receipt.** Write and confirm a durable intent before the sandbox action. Execute with a stable idempotency key, then persist its result receipt. A crash between execution and receipt persistence requires querying the sandbox's authoritative action status by key. If status cannot be established, block for reconciliation; never invent a receipt or blindly repeat an irreversible action. RawTree alone does not provide atomicity across external services.
2. **Exactly three sponsors means Liquid cannot be cut.** Keep a narrow, validatable Liquid curator task and make schema/validator failures visible. A deterministic fallback is reasonable for reliability but a demo using only that fallback does not substantiate a working Liquid integration.
3. **Prior-art claims need evidence.** The assertion that Letta, Mem0, and Zep do not model receipts or epochs was not verified by Fable and must not be repeated as fact. Present the differentiated product workflow and measured result, not unsupported exclusivity.
4. **Sponsor jobs are substitutable.** RawTree is the implemented durable event/state store; SQLite or another database could replace it. Nimble is the implemented evidence acquisition and revalidation interface; manually typed source data would weaken its demonstration but is technically possible.
5. **Mark simulation boundaries.** A seeded campsite closure is a test event in the controlled environment, never a live Nimble discovery. Real public pages can ground locations, operating hours, and initial constraints. Cached source snapshots and accelerated replay must be labeled. No real booking, cancellation, or email is sent.
6. **Memory and actions need separate truth sources.** The agent's durable projection records beliefs, commitments, and action identifiers; the sandbox's authoritative ledger determines whether an action happened. A test should kill after action success but before the agent stores its receipt, not only between cleanly completed steps.
7. **Do not hinge success on a bad baseline.** Freeze fixtures in advance. Compare same-model, same-information implementations and report ties, failures, total tokens, resumed duplicate actions, source freshness checks, and final constraint validity. Three fixtures demonstrate those specific cases, not general long-horizon reliability.
8. **Avoid treating deprecation as a guaranteed failure.** Parent's fresh Pydantic guide research found that `.dict` and `@validator` remain supported as deprecated APIs. The first round's examples do not establish broken behavior. A coding variant would need original contract tests for semantic changes and acknowledge existing tools such as bump-pydantic.

## Round 2 — actual Fable output

**Critique of round one**

Pull the Plug is a checkpoint, not memory. Nothing changes in the world during the outage, so resume proves persistence only, which Letta MemFS already ships. It never distinguishes what the agent believed from what it had already done. Unlearn's scoreboard was fiction, and picking breaking changes until the baseline fails is rigging by construction. Its hero is a filter on version strings, which reads as pinning plus search. Both are coding demos with no stake a judge feels in the body. Neither has action receipts, so neither can answer the only question that matters after a crash: which of my past actions actually happened. The real gap, given prior art on rollback repair and staleness, is revalidation of the external world plus receipt-gated resumption. I do not prefer Unlearn anymore. It loses to the direction below on vividness, honesty of evaluation, and distance from existing products.

**Three concepts**

Shared definitions. A stale memory is a belief about the world that is no longer true, such as a ferry time. A stale commitment is an action the agent already took whose precondition no longer holds, or that the resumed agent does not know it took. Prose can be re-read. Commitments cannot be un-done by forgetting them.

1. Dead Reckoning (non-coding, trip). An agent plans a three-day island camping trip: ferry, campsite, permit, gear pickup. Bookings go to a local deterministic booking desk that records every dry-run action under an idempotency key. Mid-booking, after the ferry is reserved but before the campsite, the plug is pulled. Labeled clock skip of 48 hours. Labeled disturbance in the sandbox: campsite closed. Real web data via Nimble: the park's alert page and ferry timetable, cached. On wake the agent reconstructs from RawTree, sees the ferry receipt, revalidates volatile facts, cancels via a compensating action, rebooks a different site or blocks if no site fits the permit window. Proves: zero duplicate irreversible actions in the sandbox, stale facts revalidated before use, a verified final itinerary or a stated block. Does not prove: real vendor exactly-once, or that revalidation picks correct sources in general.

2. Receipt Check (coding with side effects). A release agent bumps version, tags, publishes to a local registry, posts changelog. Crash after the tag is pushed. Nimble finds the upstream dependency was yanked while asleep. Resume must not re-tag or double-publish, and must block the release on the yank. Proves receipt-gated idempotency on a local git plus registry. Does not prove anything about PyPI or GitHub. Weaker theater: a tag is not something a judge feels.

3. Event Desk (non-coding, event). An agent confirms 12 speakers for a meetup through a local mail sandbox and holds a venue. Crash after 7 confirmations sent. While asleep, one speaker cancels (labeled) and the venue page now lists lower capacity (real page, cached). Resume sends only 5 remaining confirmations, revalidates capacity, reshuffles or blocks. Proves no duplicate emails and capacity-checked finalization. Does not prove judgment about real venues. Less vivid than a trip because the disturbance is a number.

Recommendation: Dead Reckoning. It has a body-level stake, a real irreversible action before the crash, and a simulator that can say the trip is valid or not.

**Dead Reckoning in full**

Pitch: an agent that wakes after a crash, checks its own receipts before it checks its plan, revalidates the world, and only then finishes or blocks the trip.

90-second beats:
- 0 to 10: itinerary on screen, four steps, booking desk visible with an empty receipt roll.
- 10 to 25: agent books ferry, a receipt stub prints with an idempotency key. It begins the campsite step.
- 25 to 30: plug pulled. Screen dark. Timer labeled "48h skipped".
- 30 to 40: two labeled cards: "TEST EVENT: campsite A closed" injected into the sandbox, and the real park alert page date shown from Nimble cache.
- 40 to 55: restart. Agent prints the reconstructed projection: one receipt, ferry reserved, campsite intent with no receipt, three volatile facts flagged for revalidation.
- 55 to 75: Nimble claims arrive with citations. Curator proposes supersede on the campsite fact. Validator accepts. Agent issues a cancel receipt for the ferry only if the new plan needs a different sailing, then books campsite B.
- 75 to 90: simulator verdict: itinerary valid, duplicate irreversible actions zero. Beside it, the naive-resume arm's real verdict on the same fixture, whatever it turned out to be.

Retention policy:
- Durable: commitments, receipts, epoch markers, and promoted facts with citation and observed-at. Never evicted.
- Archived with lineage: superseded facts and cancelled commitments, recallable by key.
- Offloaded: raw fetched pages, stored by hash, recallable by citation id.
- Discarded: search results that were never promoted and all reasoning traces. 24-hour expiry, no recall promise.
- Recall: by key or citation id only, never by similarity.

Typed state sketch:

```
Fact       {key, value, source_url, observed_at, valid_until, volatile: bool, epoch}
Commitment {key, resource, status: intent|reserved|cancelled, receipt_id?, reversible: bool, deadline}
Receipt    {receipt_id, idempotency_key, kind, target, result, at, compensates?: receipt_id}
Epoch      {n, started_at, reason: boot|resume}
PlanStep   {id, depends_on: [fact keys], commitment_key, status}
```

Sponsor jobs:
- RawTree: append-only patches, receipts, epochs. Resume is a single argMax reconstruction plus two read-only queries: commitments lacking receipts, and volatile facts older than the current epoch. Without it, resume replays a transcript.
- Nimble: revalidation of each flagged volatile fact, returning structured claims with citations and a trust report used as curator input, never as truth. Without it, the world change is hand-typed.
- Liquid: constrained-JSON curator proposing same-key patches only: supersede fact, mark commitment stale, propose plan repair. Every proposal passes validators before it lands. Without it, patch proposals are rule-based, which the cut line allows.

Deterministic invariants, all checked in code:
1. Intent before act: no sandbox action executes without a receipt row written first.
2. No re-execution of an idempotency key that already has a success receipt.
3. No plan step executes while depending on a volatile fact from a prior epoch that has not been revalidated.
4. At most one active commitment per resource.
5. An irreversible commitment is superseded only by a compensating receipt or an explicit block.
6. Terminal state is either every step committed with a receipt, or the plan marked blocked with a reason string.

Evaluation: three fixed fixtures, unchanged world, ferry time changed, campsite closed after booking. Two arms on identical prompts and planner: receipt-gated resume versus naive resume from the saved plan. Report duplicate irreversible actions and simulator validity per fixture, ties included. If the naive arm also gets zero duplicates on a fixture, the slide says so.

Five-hour cut line:
- Hour 1: schema, RawTree ingest, argMax reconstruction test.
- Hour 2: booking desk simulator with receipts and idempotency keys, invariants 1, 2, 4.
- Hour 3: Nimble revalidation from cached real pages, invariant 3, rule-based patch proposer.
- Hour 4: swap in Liquid curator behind the validators. If it misbehaves, keep the rule-based proposer and say so.
- Hour 5: fixtures, both arms, demo script.
Cuts in order: live Nimble to cached, Liquid to rules, three fixtures to two.

Why it could win: Letta, Mem0 and Zep store and repair beliefs. None model receipts, epochs, or the rule that a commitment outlives the prose about it. The plug pull reveals real causal behavior, because the receipt is what stops the second ferry booking, and the judge can see the row that stopped it.

Why it could lose: judges may file it under workflow engines rather than memory. The sandbox can feel like a toy if the receipt roll looks fake. The naive arm may tie on every fixture, which would leave the story resting on revalidation alone. That is still an honest result, but a quieter one.
