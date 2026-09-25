import {parseCSV,number} from '../public/csv.mjs';
export function parseSavant(csv){
  const rows=parseCSV(csv),required=['player_id','attempts','avg_hit_speed','ev95percent','brl_percent','brl_pa'];
  if(required.some(k=>!Object.hasOwn(rows[0],k)))throw new Error('Baseball Savant returned an unexpected CSV format.');
  const players=rows.map(r=>({id:number(r.player_id),bbe:number(r.attempts),exitVelocity:number(r.avg_hit_speed),hardHit:number(r.ev95percent),barrelRate:number(r.brl_percent),barrelsPerPA:number(r.brl_pa)}));
  if(players.some(p=>!Number.isInteger(p.id)||p.id<=0))throw new Error('Baseball Savant player identifiers are invalid.');
  return players;
}
export async function savant(season){
  const source=`https://baseballsavant.mlb.com/leaderboard/statcast?type=batter&year=${season}&position=&team=&min=1&csv=true`;
  const response=await fetch(source,{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('Baseball Savant is currently unavailable.');
  const csv=await response.text();
  return {season,source,fetchedAt:new Date().toISOString(),period:'Season to date; leaderboard refresh timing is controlled by Baseball Savant.',players:parseSavant(csv)};
}
