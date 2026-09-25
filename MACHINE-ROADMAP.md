# Turning HR Machine into a forecasting system

The next priority is saving predictions before games start and evaluating them after games finish. More simulations reduce numerical noise; they do not fix a poor probability model. This roadmap is proposed work, not functionality already implemented.

## 1. Establish a daily evidence trail

Use a Cloudflare scheduled Worker to retrieve bounded MLB and Savant updates, cache source snapshots in R2, and store parsed records in D1. Store player ID, game ID, source, retrieval time, source cutoff, lineup status, feature values, model version, assumptions and the prediction before first pitch. Store imported contest IDs separately from MLB IDs. Keep raw user uploads private with access controls if server storage is added; the current app keeps them local.

Refresh schedules and lineups near first pitch. Fetch Savant less frequently, with retry backoff, schema validation and explicit stale-data warnings. Begin with season data plus daily batches for rolling windows, rather than fetching years of pitch data on every page load. Stop issuing pregame picks once a game begins. Cancelled games and hitters who do not appear need explicit outcome categories.

## 2. Learn a better HR probability

Keep the current smoothed HR/PA rate as the baseline. Start with a regularized statistical model fitted on prior seasons, then compare a tree-based model only if the dataset supports it. Predict an HR per plate appearance or a game-level 1+ HR outcome; preserve that target throughout training and reporting.

Candidate features to test: season and trailing 30/60-day barrels per PA, hard-hit rate, pulled airborne contact, exit-velocity distribution, batter handedness, opposing pitcher HR/contact tendencies and handedness, park effects, and weather. Keep sample counts alongside every rate and shrink small samples toward broader estimates. Avoid over-weighting tiny batter-versus-pitcher histories.

Model playing time separately: likelihood of starting, batting slot and a distribution of plate appearances. For varying PA probabilities w_n and per-PA HR rate p, calculate game probability as the sum of w_n × [1 − (1 − p)^n]. Account for starter/bullpen exposure if that improves held-out performance. Do not turn salary, fantasy projections, xwOBA or barrel percentage directly into an HR probability without a fitted and tested relationship.

## 3. Test in time order

Train on older games, validate on later games and reserve a final untouched period. Features for each prediction must contain only information available before that game. Current season-end totals cannot be used to recreate earlier pregame predictions. A random row split risks leakage across the same players and time periods.

Measure Brier score, log loss, calibration by probability band, and top-three hit rate. Compare against the existing HR/PA baseline on the same eligible player pool. Report sample size, coverage and uncertainty; a handful of winning nights is not proof. Evaluate known starters separately from provisional picks. Separate model uncertainty from Monte Carlo sampling error.

## 4. Automate only the validated workflow

After a model improves held-out results, publish versioned weights with tests through GitHub and deploy on Cloudflare. Keep an easy rollback and monitor missing feeds, changed columns, implausible values and prediction drift. Record outcomes each day and show a results history. Retrain on a defined schedule, and promote a new model only when it passes the same evaluation gate.

The daily flow should become: ingest → validate → resolve MLB identities → enforce contest and lineup eligibility → score → freeze pregame predictions → collect outcomes → evaluate. The app should show three picks with their game, probability, lineup status, source freshness and the strongest measured reasons.

## Recommended next build

Implement pregame snapshot storage and outcome tracking first. This creates the evidence needed to decide whether Savant features, matchup adjustments or a more complex model actually improve forecasts. No automated collection schedule or storage has been created in v1.1.

## Sources

- MLB's [Baseball Savant leaderboard](https://baseballsavant.mlb.com/statcast_leaderboard) defines the contact metrics available to this app.
- MLB's [Statcast CSV documentation](https://baseballsavant.mlb.com/csv-docs) documents pitch/event fields for a future historical pipeline.
