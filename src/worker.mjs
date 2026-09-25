const BASE = 'https://statsapi.mlb.com/api/v1';
export function today() { return new Intl.DateTimeFormat('en-CA', {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
async function mlb(path) {
  const r = await fetch(BASE + path, {signal: AbortSignal.timeout(15000)});
  if (!r.ok) throw new Error('MLB data request failed');
  return r.json();
}
export async function slate() {
  const date = today();
  const schedule = await mlb(`/schedule?sportId=1&date=${date}`);
  const games = (schedule.dates || []).flatMap(d => d.games).filter(g => ['S','P'].includes(g.status.codedGameState) && ['R','F','D','L','W'].includes(g.gameType));
  const players = []; const warnings = []; let missingStats = 0;
  // Four simultaneous requests stay below the Worker connection limit.
  for (let offset = 0; offset < games.length; offset += 4) {
    await Promise.all(games.slice(offset,offset+4).map(async game => {
      try {
        const box = await mlb(`/game/${game.gamePk}/boxscore`);
        for (const side of ['away','home']) {
          const team = box.teams[side]; const order = team.battingOrder || [];
          const announced = order.length === 9;
          for (const p of Object.values(team.players || {})) {
            if (announced ? !order.includes(p.person.id) : (p.position?.abbreviation === 'P' || p.status?.code !== 'A')) continue;
            const stats = p.seasonStats?.batting;
            if (!Number.isFinite(stats?.plateAppearances) || !Number.isFinite(stats?.homeRuns)) { missingStats++; continue; }
            players.push({id:p.person.id, name:p.person.fullName, team:game.teams[side].team.name, opponent:game.teams[side === 'home' ? 'away' : 'home'].team.name,
              gameId:game.gamePk, gameTime:game.gameDate, park:game.venue.name, hr:stats.homeRuns, pa:stats.plateAppearances, confirmed:announced, slot:order.indexOf(p.person.id)+1});
          }
        }
      } catch { warnings.push(`Could not load ${game.teams.away.team.name} at ${game.teams.home.team.name}.`); }
    }));
  }
  if (missingStats) warnings.push(`${missingStats} candidates omitted because season HR/PA data was unavailable.`);
  return {date, season:Number(date.slice(0,4)), fetchedAt:new Date().toISOString(), games:games.length, players, warnings, source:BASE};
}
export default {async fetch(request, env, ctx) {
  const url = new URL(request.url);
  if (url.pathname === '/api/slate') {
    if (request.method !== 'GET') return new Response('Method not allowed',{status:405});
    const key = new Request(url.origin + '/api/slate');
    const cache = typeof caches !== 'undefined' ? caches.default : null;
    const cached = await cache?.match(key); if(cached) return cached;
    try { const response = Response.json(await slate(),{headers:{'Cache-Control':'public, max-age=60'}}); if(cache) ctx.waitUntil(cache.put(key,response.clone())); return response; }
    catch { return Response.json({error:'The MLB feed is unavailable. Try again shortly. No live picks were generated.'},{status:502}); }
  }
  if (url.pathname.startsWith('/api/')) return new Response('Not found',{status:404});
  return env.ASSETS.fetch(request);
}};
