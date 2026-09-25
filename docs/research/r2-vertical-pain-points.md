# Vertical pain points for long-horizon agents (last30days + web, 2026-09-25)

Sources: 5 last30days runs (YouTube 51 videos, HN 10 stories; Reddit/X unavailable: ScrapeCreators 402, X not logged in) + 6 Firecrawl web searches. Raw data: .firecrawl/dr2/v/

| Vertical | 2026 pain (evidence) | Long-horizon-state angle |
|---|---|---|
| Legal | 2,046 verified court cases with AI-fabricated citations as of May 2026, up from ~200 a year earlier (HAQQ tracker, built on Charlotin DB); Sullivan & Cromwell's "please don't sanction us" letter, Apr 2026 (Above the Law) | Every claim carries a source, trust grade and excerpt; blame any sentence back to where it came from |
| Compliance (all high-risk AI) | EU AI Act high-risk obligations enforceable **Aug 2, 2026**; Art. 12 requires automatic, tamper-evident logs, retained ≥6 months (Art. 26(6)) (Help Net Security, TrueScreen) | An append-only event log plus as-of queries is Article 12 record-keeping as a byproduct |
| Healthcare prior auth | 2026 state laws (e.g., Iowa HF 2635) allow AI for initial review but ban AI as the sole basis for a denial (Becker's); ~1 in 4 physicians report prior auth caused a serious adverse event (Develop Health, citing AMA) | Payer policies change; the agent must apply the policy *in force on the date of service*, which is a bi-temporal query |
| Finance ops / payments | "Payments are a state and exception management problem"; partial settlements aren't hard failures (Automation Anywhere) | Explicit mutable state per invoice or payment with supersession, not a chat log |
| Enterprise ops overall | 78% have pilots, 14% at production scale (Mar 2026 survey of 650); single-task >80% drops to ≤38% in continuous real-world settings (Xoras Systems video); McKinsey: only 6% are AI high performers (McKinsey Live, Sep 22); HN: "most of the pain at scale isn't the agents themselves, it's observability" | Continuous runs are where agents collapse; observability means state plus provenance |
