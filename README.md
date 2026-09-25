# HR Machine

A single-stat MLB home-run simulator built for VS Code, GitHub, and Cloudflare Workers. It selects up to three unique hitters by estimated probability of at least one home run in one upcoming game.

## Run in VS Code

Open this folder in VS Code. Install Node.js 22 or newer. In the terminal:

```sh
npm run dev
```

Open http://localhost:8787. Local development has no package dependencies. Choose Live MLB slate and click **Find my top 3**. Demo mode is explicit and uses fictional hitters. Run `npm test` for model checks.

## Publish with GitHub and Cloudflare

1. Put these files at the root of the intended GitHub repository, preserving any existing project files until reviewed.
2. Run `pnpm install --frozen-lockfile` with pnpm 11 or newer. The included pnpm-lock.yaml pins dependencies. Alternatively use npm install and commit its lockfile if you choose to switch package managers.
3. In Cloudflare Workers & Pages, connect the GitHub repository using Workers Builds. Set the root directory to this app folder, leave the build command empty, and use `npx wrangler deploy` as the deploy command.
4. Change `name` in wrangler.jsonc to your intended Cloudflare Worker name before deploying to an existing project.

Alternatively run `npx wrangler login` then `npm run deploy` locally. No MLB API secret is required. Do not commit credentials. This folder has not been published until deployment is explicitly reported successful.

Cloudflare configuration: https://developers.cloudflare.com/workers/static-assets/binding/

## Model and limits

Rate = (season HR + 3) / (season PA + 100). This is a fixed 3% prior with 100 PA of weight, not an empirically calibrated prior. Game probability = 1 − (1 − rate)^N, with a user-selected integer N of 3, 4, or 5 plate appearances. Monte Carlo independently simulates each PA; exact probability determines ranking. Seed 2026 makes results reproducible. Doubleheader hitters are deduplicated by MLB ID; this is a per-game estimate, not a combined daily probability.

Source: MLB Stats API schedule and game boxscores at https://statsapi.mlb.com/api/v1. Today's date uses America/New_York. Only scheduled and pregame regular-season/postseason games are considered. Announced nine-player batting orders are preferred; optional unconfirmed candidates use active non-pitchers from the boxscore. Missing statistics are excluded and reported. Player season HR and PA are supplied by the boxscore feed. No historical backtest mode is provided, preventing current totals from being represented as historical forecasts. Responses may be cached for 60 seconds. Refresh close to game time; a loaded slate may become stale as games start or lineups change.

This is a transparent baseline, not a validated forecasting model. It omits pitcher quality, handedness, park, weather, injury status and variable playing time. Ranking three players does not imply that any will homer. A validation upgrade should store pregame snapshots and evaluate calibration, Brier score, and top-three hit rate on future games before making accuracy claims.

MLB data usage is subject to its terms: http://gdx.mlb.com/components/copyright.txt. Not affiliated with MLB.

