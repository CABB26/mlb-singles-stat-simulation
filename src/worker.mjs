import {TEAM_CODES} from '../public/imports.mjs';
import {savant} from './savant.mjs';
const BASE='https://statsapi.mlb.com/api/v1';
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
export function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
async function mlb(path){const r=await fetch(BASE+path,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('MLB data request failed');return r.json();}
function statMap(data,label){const block=data?.stats?.[0],splits=block?.splits;if(!Array.isArray(splits)||Number(block?.totalSplits||0)>splits.length)throw new Error(`Incomplete MLB ${label} statistics.`);const map=new Map();for(const split of splits){const id=split.player?.id;if(!id)continue;if(map.has(id))throw new Error(`Duplicate MLB ${label} totals.`);map.set(id,split.stat||{});}return map;}
export function pitcherMatchup(stat){const bf=Number(stat?.battersFaced),hr=Number(stat?.homeRuns);if(!Number.isFinite(bf)||!Number.isFinite(hr)||bf<0||hr<0)return {factor:1,rate:null};const rate=(hr+3)/(bf+100);const relative=clamp(rate/.03,.65,1.45);return {rate,factor:clamp(1+(relative-1)*.65,.78,1.30)};}
export async function slate(){
  const date=today(),season=date.slice(0,4);
  const schedule=await mlb(`/schedule?sportId=1&date=${date}`);
  const games=(schedule.dates||[]).flatMap(d=>d.games).filter(g=>['S','P'].includes(g.status.codedGameState)&&['R','F','D','L','W'].includes(g.gameType));
  const empty={stats:[{splits:[],totalSplits:0}]};
  const [hittingData,pitchingData]=games.length?await Promise.all([
    mlb(`/stats?stats=season&group=hitting&season=${season}&sportIds=1&playerPool=ALL&limit=10000`),
    mlb(`/stats?stats=season&group=pitching&season=${season}&sportIds=1&playerPool=ALL&limit=10000`)
  ]):[empty,empty];
  const seasonStats=statMap(hittingData,'hitting'),pitcherStats=statMap(pitchingData,'pitching');
  const players=[],warnings=[];let missingStats=0,starterMatched=0,starterTotal=0;
  for(let offset=0;offset<games.length;offset+=4){
    await Promise.all(games.slice(offset,offset+4).map(async game=>{
      try{
        const box=await mlb(`/game/${game.gamePk}/boxscore`);
        for(const side of ['away','home']){
          const other=side==='home'?'away':'home',team=box.teams[side],order=team.battingOrder||[],announced=order.length===9;
          const probable=game.teams?.[other]?.probablePitcher||null;starterTotal++;
          const starter=probable?.id?pitcherStats.get(probable.id):null,matchup=pitcherMatchup(starter);if(starter)starterMatched++;
          for(const p of Object.values(team.players||{})){
            if(announced?!order.includes(p.person.id):(p.position?.abbreviation==='P'||p.status?.code!=='A'))continue;
            const stats=seasonStats.get(p.person.id);if(!Number.isFinite(stats?.plateAppearances)||!Number.isFinite(stats?.homeRuns)){missingStats++;continue;}
            players.push({id:p.person.id,name:p.person.fullName,team:game.teams[side].team.name,opponent:game.teams[other].team.name,
              teamCode:TEAM_CODES[game.teams[side].team.id]||'',opponentCode:TEAM_CODES[game.teams[other].team.id]||'',gameId:game.gamePk,gameTime:game.gameDate,
              park:game.venue.name,hr:stats.homeRuns,pa:stats.plateAppearances,confirmed:announced,slot:order.indexOf(p.person.id)+1,
              probablePitcher:probable?.fullName||'',probablePitcherId:probable?.id||null,probablePitcherHrRate:matchup.rate,matchupFactor:matchup.factor});
          }
        }
      }catch{warnings.push(`Could not load ${game.teams.away.team.name} at ${game.teams.home.team.name}.`);}
    }));
  }
  if(missingStats)warnings.push(`${missingStats} candidates omitted because season HR/PA data was unavailable.`);
  if(starterTotal&&starterMatched<starterTotal)warnings.push(`Probable-starter HR context available for ${starterMatched} of ${starterTotal} team matchups; missing starters use a neutral matchup factor.`);
  return {date,season:Number(season),fetchedAt:new Date().toISOString(),games:games.length,players,warnings,starterCoverage:{matched:starterMatched,total:starterTotal},source:BASE};
}
export default {async fetch(request,env,ctx){
  const url=new URL(request.url);
  if(url.pathname==='/api/savant'){
    if(request.method!=='GET')return new Response('Method not allowed',{status:405});const season=Number(today().slice(0,4));const key=new Request(url.origin+`/api/savant?season=${season}`),cache=typeof caches!=='undefined'?caches.default:null,cached=await cache?.match(key);if(cached)return cached;
    try{const response=Response.json(await savant(season),{headers:{'Cache-Control':'public, max-age=1800'}});if(cache)ctx.waitUntil(cache.put(key,response.clone()));return response;}catch{return Response.json({error:'Baseball Savant is unavailable or its data format changed. HR rankings still use the MLB baseline; Savant metrics are unavailable.'},{status:502});}
  }
  if(url.pathname==='/api/slate'){
    if(request.method!=='GET')return new Response('Method not allowed',{status:405});const key=new Request(url.origin+'/api/slate'),cache=typeof caches!=='undefined'?caches.default:null,cached=await cache?.match(key);if(cached)return cached;
    try{const response=Response.json(await slate(),{headers:{'Cache-Control':'public, max-age=60'}});if(cache)ctx.waitUntil(cache.put(key,response.clone()));return response;}catch{return Response.json({error:'The MLB feed is unavailable. Try again shortly. No live picks were generated.'},{status:502});}
  }
  if(url.pathname.startsWith('/api/'))return new Response('Not found',{status:404});return env.ASSETS.fetch(request);
}};
