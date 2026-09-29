# HR Machine

MLB single-stat home-run simulation machine built for **VS Code + GitHub + Cloudflare Workers**. V2 loads the upcoming MLB slate, optionally restricts it to a DraftKings contest pool, enriches hitters with Baseball Savant contact quality, runs seeded Monte Carlo simulations in a browser Web Worker, and ranks both individual hitters and three-player home-run combinations.

## V2 engine

The probability pipeline is intentionally transparent:

1. Stabilize season HR/PA with a 3% prior over 100 PA.
2. Adjust the log-odds of HR using current-season Savant barrel rate, hard-hit rate and average exit velocity. The Savant contribution is down-weighted for low BBE samples.
3. Adjust opportunity for batting-order slot.
4. Apply optional matchup, park, weather and pitch-arsenal multipliers when those fields are supplied. They are neutral by default.
5. Run Monte Carlo trials with a shared game-environment shock plus player-level uncertainty.
6. Record 1+ HR probability, 2+ HR probability and expected HR for each hitter.
7. Take the leading hitter pool and simulate every three-player combination, recording any HR, 2+ total HR, 3+ total HR and all-three-homer probabilities.

The heavy simulation runs in `public/simulator.worker.mjs`, keeping the dashboard responsive at higher trial counts.

## Data flow

`GET /api/slate` uses the MLB Stats API schedule, boxscores and season hitting feed. Today is resolved in `America/New_York`. Posted nine-player batting orders are preferred. Optional unconfirmed candidates can be included from active pregame boxscore rosters.

`GET /api/savant` retrieves current-season Baseball Savant Exit Velocity & Barrels data. Savant joins by MLB player ID. Missing or unavailable Savant values do not invent data; the model falls back to the stabilized HR/PA baseline plus lineup context.

DraftKings uploads restrict the contest pool. The optional DFF cheatsheet adds salary, injury and projection context. Contest IDs are never treated as MLB IDs. Upload matching uses normalized player name, team and opponent, and ambiguous records are reported instead of guessed. OUT/O/IL/inactive players are excluded. CSV contents stay in browser memory and clear on reload.

## Run in VS Code

Install Node.js 22+ and pnpm 11+ or use npm.

```sh
pnpm install --frozen-lockfile
npm test
npm run dev
```

Open `http://localhost:8787`.

## Cloudflare deployment

This repository already includes `wrangler.jsonc` with a Worker entry point and static-assets binding. Deploy from VS Code with:

```sh
npx wrangler login
npm run deploy
```

Or connect the GitHub repository to **Cloudflare Workers Builds**. The Worker can use an empty build command and the default deploy command `npx wrangler deploy`. Pushing to the connected production branch then triggers Cloudflare deployment.

To keep the War Room private, protect the Worker with **Cloudflare Access**. Worker-level Access can protect production, preview and associated domains behind sign-in.

## Tests

```sh
npm test
```

The model tests cover baseline probability math, Savant feature direction, deterministic seeded simulation, hitter deduplication and three-player combo scoring.

## Important limitations

V2 is a forecasting framework, not a validated betting or DFS oracle. Pitcher-specific HR vulnerability, pitch location, handedness/platoon splits, park geometry, directional wind and bat-tracking blast quality are model hooks but are not fully populated by the live feed yet. The next meaningful upgrades are pitcher/arsenal collision, directional park + weather, and historical backtesting with calibration metrics such as Brier score and reliability curves.

Refresh lineups close to lock. Ranking three hitters does not imply that any will homer.

Not affiliated with MLB or DraftKings.
