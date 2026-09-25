import {parseCSV,number} from './csv.mjs';
export const TEAM_CODES={108:'LAA',109:'ARI',110:'BAL',111:'BOS',112:'CHC',113:'CIN',114:'CLE',115:'COL',116:'DET',117:'HOU',118:'KC',119:'LAD',120:'WSH',121:'NYM',133:'ATH',134:'PIT',135:'SD',136:'SEA',137:'SF',138:'STL',139:'TB',140:'TEX',141:'TOR',142:'MIN',143:'PHI',144:'ATL',145:'CWS',146:'MIA',147:'NYY',158:'MIL'};
const aliases={AZ:'ARI',OAK:'ATH',CHW:'CWS',KCR:'KC',SDP:'SD',SFG:'SF',TBR:'TB',WSN:'WSH',ANA:'LAA'};
const teamKey=s=>aliases[s?.toUpperCase()]||s?.toUpperCase()||'';
const nameKey=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const key=p=>nameKey(p.name)+'|'+teamKey(p.teamCode);
const out=s=>/^(O|OUT|IL|IR|INACTIVE|IL\d+|\d+[- ]?DAY IL)$/i.test(s||'');
export function importCSV(text,kind) {
  const raw=parseCSV(text),h=Object.keys(raw[0]);
  const required=kind==='dk'?['Name','ID','Position','Game Info','TeamAbbrev']:['first_name','last_name','position','game_date','team','opp'];
  const missing=required.filter(k=>!h.includes(k));if(missing.length)throw new Error('Missing columns: '+missing.join(', '));
  const omitted=[];
  const rows=raw.map((r,i)=>{
    if(kind==='dk'&&(!r['Game Info']||r['Game Info']==='-')){omitted.push(`${r.Name}: no DraftKings game listed; excluded from the contest pool.`);return null;}
    let date,opponent;
    if(kind==='dk') {const m=r['Game Info'].match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);date=m?`${m[3]}-${m[1]}-${m[2]}`:'';const teams=r['Game Info'].split(' ')[0].split('@').map(teamKey);opponent=teams.find(t=>t!==teamKey(r.TeamAbbrev))||'';}
    else{date=r.game_date;opponent=teamKey(r.opp);}
    const name=kind==='dk'?r.Name:`${r.first_name} ${r.last_name}`.trim();const teamCode=teamKey(kind==='dk'?r.TeamAbbrev:r.team);
    if(!name||!teamCode||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date)))throw new Error(`Row ${i+2} needs a valid player, team and game date.`);
    return {name,teamCode,date,opponent,dkId:kind==='dk'?r.ID:null,position:kind==='dk'?r.Position:r.position,
      injury:kind==='dk'?r.Status||'':r.injury_status||'',salary:number(kind==='dk'?r.Salary:r.salary),projection:kind==='dk'?null:number(r.ppg_projection),importedOrder:kind==='dk'?null:number(r.confirmed_order)};
  }).filter(p=>p&&p.position!=='P'&&p.position!=='SP'&&p.position!=='RP');
  if(!rows.length)throw new Error('No hitters found in this CSV.');
  const seen=new Set();for(const r of rows){const k=key(r)+'|'+r.date+'|'+r.opponent;if(seen.has(k))throw new Error(`Duplicate hitter entry for ${r.name}; resolve duplicate rows before importing.`);seen.add(k);}
  return {kind,rows,total:raw.length,pitchers:raw.filter(r=>['P','SP','RP'].includes(kind==='dk'?r.Position:r.position)).length,omitted};
}
export function applyImports(players,date,{dk=null,cheat=null}={}) {
  const issues=[...(dk?.omitted||[]),...(cheat?.omitted||[])],matchedKeys=new Set();let excluded=0;
  for(const file of [dk,cheat].filter(Boolean)) {
    if(file.rows.some(r=>r.date!==date))throw new Error(`${file.kind==='dk'?'DraftKings':'Cheatsheet'} contains dates other than ${date}. Upload a matching daily file.`);
  }
  const dkMap=new Map(),cheatMap=new Map();
  for(const [file,map] of [[dk,dkMap],[cheat,cheatMap]]) for(const r of file?.rows||[]) {const k=key(r);const list=map.get(k)||[];list.push(r);map.set(k,list);}
  const nameIds=new Map();for(const p of players){const k=key(p);if(!nameIds.has(k))nameIds.set(k,new Set());nameIds.get(k).add(p.id);}
  const result=[];
  for(const p of players){
    const k=key(p); const opponent=teamKey(p.opponentCode);
    const matching=map=>(map.get(k)||[]).filter(r=>!r.opponent||r.opponent===opponent);
    const d=matching(dkMap),c=matching(cheatMap);
    if(dk&&!d.length)continue;
    if((d.length||c.length)&&(nameIds.get(k).size>1||d.length>1||c.length>1)){issues.push(`${p.name}: ambiguous match, omitted.`);continue;}
    const dr=d[0],cr=c[0]; if(dr)matchedKeys.add(k);
    if(out(dr?.injury)||out(cr?.injury)){excluded++;continue;}
    result.push({...p,dkId:dr?.dkId??null,salary:dr?.salary??cr?.salary??null,projection:cr?.projection??null,
      injury:[dr?.injury,cr?.injury].filter(Boolean).filter((s,i,a)=>a.indexOf(s)===i).join(' / '),importedOrder:cr?.importedOrder??null});
  }
  if(dk)for(const r of dk.rows)if(!matchedKeys.has(key(r)))issues.push(`${r.name} (${r.teamCode}): no unique match in upcoming MLB candidates.`);
  if(cheat)for(const r of cheat.rows)if(!players.some(p=>key(p)===key(r)&&p.opponentCode===r.opponent))issues.push(`${r.name} (${r.teamCode}): cheatsheet row has no upcoming MLB match.`);
  return {players:result,issues:[...new Set(issues)],excluded};
}
