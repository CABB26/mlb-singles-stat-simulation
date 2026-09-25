# HR Machine

## Upload and Baseball Savant upgrade (v1.1)

Upload the daily DraftKings file and optionally the DFF cheatsheet in **Bring your slate**, then run the model. The DraftKings file restricts the contest pool. Rows with `Game Info` of `-` or blank are reported and omitted. DFF adds salary, fantasy projection, injury and imported order context; it does not restrict the pool by itself. CSV files stay in browser memory, are never sent to the server, and clear on reload. Raw uploads are not included in this repository.

Exact normalized name + team + opponent joins associate uploads with MLB candidate IDs. Contest IDs are not MLB IDs. Team aliases such as OAK/ATH and accented names are normalized. Ambiguities and unmatched names are reported, not guessed. OUT/O/IL/inactive players are excluded; DTD remains visible. MLB lineups control eligibility; imported orders never silently override them. Files with dates that differ from today's Eastern date block the run. No-game DK rows have no date and are omitted rather than assigned a guessed date. Limits: 5 MB per file; blank/duplicate headers, malformed quotes, mismatched row lengths and duplicate hitter entries are rejected.

The supplied reference DraftKings format contains no Salary column. A standard optional Salary column is supported; otherwise salary comes from matched DFF rows or remains unavailable. AvgPointsPerGame and fantasy point projections are not interpreted as home-run probability.

`GET /api/savant` retrieves the current-season Baseball Savant Exit Velocity & Barrels CSV. Barrel % is per batted ball, hard-hit % is per batted ball, exit velocity is mph. BBE means batted-ball events. Joins use MLB player IDs. Results may be cached for 30 minutes; retrieval timestamp is not the last pitch timestamp. Savant may lag games. Server timeouts or schema changes produce an explicit unavailable status; no invented values are used. The baseline ranks by HR/PA probability; Savant metrics provide evidence but do not modify the probability until validated weights exist.

Source: https://baseballsavant.mlb.com/statcast_leaderboard and https://baseballsavant.mlb.com/csv-docs. The leaderboard CSV is a public website data endpoint, not a contracted stable API; monitor its schema.

See MACHINE-ROADMAP.md for the proposed path from this baseline to a measured forecasting system.

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

Source: MLB Stats API schedule, game boxscores and the all-player season hitting feed at https://statsapi.mlb.com/api/v1. Today's date uses America/New_York. Only scheduled and pregame regular-season/postseason games are considered. Announced nine-player batting orders are preferred; optional unconfirmed candidates use active non-pitchers from the boxscore. Missing statistics are excluded and reported. HR and PA come from the regular-season hitting feed, not pregame boxscore placeholders. No historical backtest mode is provided, preventing current totals from being represented as historical forecasts. Responses may be cached for 60 seconds. Refresh close to game time; a loaded slate may become stale as games start or lineups change.

This is a transparent baseline, not a validated forecasting model. It omits pitcher quality, handedness, park, weather, injury status and variable playing time. Ranking three players does not imply that any will homer. A validation upgrade should store pregame snapshots and evaluate calibration, Brier score, and top-three hit rate on future games before making accuracy claims.

MLB data usage is subject to its terms: http://gdx.mlb.com/components/copyright.txt. Not affiliated with MLB.
