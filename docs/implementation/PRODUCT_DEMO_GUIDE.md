# Run the reservation product

From the repository root:

```sh
npm install
npm run demo:product
```

Open <http://127.0.0.1:4430/>. The existing root `.env` needs `NIMBLE_API_KEY` for current operator source checks. This entrypoint does not invoke a coding assistant, planner model, RawTree or Liquid. `./run.sh product` is equivalent. The OpenBot missions page links to the same product.

## A short product demonstration

1. Show the supported ferry departure: Tiburon to Angel Island, October 9, 2026 at 10:00 AM Pacific.
2. Enter two adults and a $100 total ferry budget. Choose **Prepare ferry booking**.
3. Watch real operator schedule and FAQ reads complete. Expand source evidence to see the retrieval time, Nimble request ID and content hash.
4. Inspect the actual embedded FareHarbor form: the departure and adult count are selected. The external link opens the same selected values in a new tab.
5. Explain the boundary: the app has prepared the form; the user reviews the current fare, terms and personal information and completes the provider checkout. No reservation or seat hold has been created by this app.
6. Change the party size to three and repeat. A $20 budget for two adults should instead stop with a precise budget explanation before source calls.
7. Refresh the app or restart its service: the saved preparation and evidence remain available. Download its JSON record for a reviewable artifact.

This is a bounded working pilot, not a general travel agent. It supports one observed departure and 1–6 adult tickets. The price shown in the app is a timestamped prior browser observation, not a newly fetched quote. The provider form shows its current total and availability. FareHarbor's documented `ctrs` parameter preserves the observed customer-type-rate ID and adult count; we do not claim undocumented API access or browser session transfer. Source-check failures stop preparation visibly.

The source checker uses only the official operator schedule and FAQ. It does not check campsite availability or book permits/gear. The originally suggested October 9–11 overnight trip was not available in the inspected campground results; the product does not substitute a fictional campsite.

## Saved records and rehearsal

Preparations and their source evidence are stored in `artifacts/product/preparations.sqlite`. This is a separate preparation journal, not a booking ledger or canonical mission store. On an interrupted check, restart records the interruption; it does not silently repeat hosted calls. The production service binds only `127.0.0.1:4430` and rejects cross-origin mutations.

The independent key-free recovery rehearsal remains available with `npm run demo:local` at <http://127.0.0.1:4420/>. Its booking desk and world changes are simulated; its worker termination and persistence are real. Do not use it as evidence of a travel reservation.

Focused checks: `npm run test:product`. Repository compile check: `npm run check:types`.
