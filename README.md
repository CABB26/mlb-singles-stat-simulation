# HR Machine

MLB single-stat home-run simulation machine built for **ChatGPT + VS Code + GitHub + Cloudflare Workers**. V2.1 loads the upcoming MLB slate, optionally restricts it to a DraftKings contest pool, enriches hitters with Baseball Savant contact quality and probable-starter HR tendency, accepts optional park/weather/pitch-fit context, runs seeded Monte Carlo simulations in a browser Web Worker, and ranks both individual hitters and three-player combinations.

## V2.1 engine

The probability pipeline is intentionally transparent:

1. Stabilize season HR/PA with a 3% prior over 100 PA.
2. Adjust HR log-odds using current-season Savant barrel rate, hard-hit rate and average exit velocity. Low BBE samples are down-weighted.
3. Adjust expected opportunity for batting-order slot.
4. Pull the opposing probable starter from MLB and calculate a shrunk HR allowed per batter faced rate. Only part of the starter signal is applied because hitters may face the bullpen later.
5. Apply optional manual matchup, park, weather and pitch-fit multipliers from the HR Context CSV. Missing inputs remain neutral at 1.00.
6. Run correlated Monte Carlo trials with a shared game-environment shock plus player-level uncertainty.
7. Record 1+ HR probability, 2+ HR probability and expected HR for every hitter.
8. Simulate every three-player combination from the leading pool, recording any HR, 2+ total HR, 3+ total HR and all-three-homer probabilities.

The headline **Top Three Hitters** are ranked by simulated individual 1+ HR probability. The separate combination board is a tournament-ceiling view and can produce a different trio.

The heavy simulation runs in `public/simulator.worker.mjs`, keeping the dashboard responsive at higher trial counts.

## Data flow

`GET /api/slate` uses the MLB Stats API schedule, boxscores, season hitting feed and season pitching feed. Today is resolved in `America/New_York`. Posted nine-player batting orders are preferred. Optional unconfirmed candidates can be included from active pregame boxscore rosters. Probable-starter HR tendency is shrunk toward a neutral 3% HR/BF prior and bounded before entering the model.

`GET /api/savant` retrieves current-season Baseball Savant Exit Velocity & Barrels data. Savant joins by MLB player ID. Missing or unavailable Savant values do not invent data; the model falls back to stabilized HR/PA, batting order and available starter/context inputs.

DraftKings uploads restrict the contest pool. The optional DFF cheatsheet adds salary, injury and projection context. Contest IDs are never treated as MLB IDs. Upload matching uses normalized player name, team and opponent, and ambiguous records are reported instead of guessed. OUT/O/IL/inactive players are excluded. CSV contents stay in browser memory and clear on reload.

## HR Context CSV

Use `public/hr-context-template.csv` or download the template from the dashboard.

```csv
Name,TeamAbbrev,Date,MatchupFactor,ParkFactor,WeatherFactor,PitchFactor
Example Hitter,NYY,2026-09-29,1.00,1.00,1.00,1.00
```

`Name` and `TeamAbbrev` are required. `Date` is optional but, when supplied, must match the current slate date. Factors use **1.00 = neutral** and accept **0.50 to 1.50**. A manual `MatchupFactor` multiplies the automatic MLB probable-starter factor; park/weather/pitch inputs fill the corresponding model hooks directly.

This lets upstream work such as directional park geometry, wind, pitch-arsenal collision or bat-tracking research be normalized into one stable daily interface instead of coupling the app to one vendor schema.

## Run in VS Code

Install Node.js 22+ and pnpm 11+ or use npm.

```sh
pnpm install --frozen-lockfile
npm test
npm run dev
```

Open `http://localhost:8787`.

## GitHub workflow

Development is isolated on feature branches and reviewed through pull requests before promotion to `main`. `.github/workflows/ci.yml` contains Node regression and syntax checks for repositories where GitHub Actions is enabled.

## Cloudflare deployment

The repository includes `wrangler.jsonc` with a Worker entry point and static-assets binding. Deploy from VS Code with:

```sh
npx wrangler login
npm run deploy
```

Or connect the GitHub repository to **Cloudflare Workers Builds** and deploy `main` after review.

Before production promotion, protect the Worker with **Cloudflare Access** so the War Room requires authentication. Do not rely on an obscure `workers.dev` URL as privacy.

## Tests

```sh
npm test
```

Regression coverage includes baseline probability math, Savant feature direction, deterministic seeded simulation, hitter deduplication, three-player combo scoring, probable-starter HR shrinkage, and HR Context parsing/matching.

## Important limitations

V2.1 is a forecasting framework, not a validated betting or DFS oracle. Probable-starter HR tendency is game-specific, but handedness/platoon splits, pitch location, directional park geometry, directional wind and bat-tracking blast quality still need richer inputs or dedicated live adapters. Historical calibration/backtesting should be used before interpreting the percentages as fully calibrated real-world probabilities.

Refresh lineups close to lock. Ranking three hitters does not imply that any will homer.

Not affiliated with MLB or DraftKings.
