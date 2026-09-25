import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV} from '../public/csv.mjs';
import {importCSV,applyImports} from '../public/imports.mjs';
import {parseSavant} from '../src/savant.mjs';
const dkText='Position,Name,ID,Game Info,TeamAbbrev,Status\nOF,José Ramírez,123,CLE@KC 09/25/2026 07:00PM ET,CLE,DTD';
const players=[{id:608070,name:'Jose Ramirez',teamCode:'CLE',opponentCode:'KC',hr:30,pa:500,confirmed:true}];
test('CSV handles BOM, commas, escaped quotes, multiline and bad shapes',()=>{
  assert.deepEqual(parseCSV('\uFEFFname,note\r\n"Doe, Jane","a ""quote""\nnext"\r\n'),[{name:'Doe, Jane',note:'a "quote"\nnext'}]);
  assert.throws(()=>parseCSV('a,b\n1'));assert.throws(()=>parseCSV('a,a\n1,2'));assert.throws(()=>parseCSV('a\n"oops'));
});
test('DK identity is name/team/opponent, never contest ID; missing salary stays null',()=>{
  const dk=importCSV(dkText,'dk'),r=applyImports(players,'2026-09-25',{dk});
  assert.equal(r.players[0].id,608070);assert.equal(r.players[0].dkId,'123');assert.equal(r.players[0].salary,null);assert.equal(r.players[0].injury,'DTD');
  assert.throws(()=>applyImports(players,'2026-09-26',{dk}));
  assert.equal(applyImports([{...players[0],opponentCode:'MIN'}],'2026-09-25',{dk}).players.length,0);
  assert.equal(applyImports(players,'2026-09-25',{dk:importCSV(dkText.replace('DTD','IL'),'dk')}).players.length,0);
});
test('duplicate and ambiguous matches never silently select a player',()=>{
  assert.throws(()=>importCSV(dkText+'\n'+dkText.split('\n')[1],'dk'));
  const r=applyImports([...players,{...players[0],id:999}],'2026-09-25',{dk:importCSV(dkText,'dk')});assert.equal(r.players.length,0);assert.ok(r.issues.some(x=>x.includes('ambiguous')));
});
test('DK rows without a scheduled contest game are omitted with a report',()=>{
  const data=importCSV(dkText+'\nOF,No Game,124,-,NYY,','dk');assert.equal(data.rows.length,1);assert.equal(data.omitted.length,1);assert.equal(applyImports(players,'2026-09-25',{dk:data}).issues.length,1);
});
test('cheatsheet adds context without treating projections or orders as MLB confirmation',()=>{
  const cheat=importCSV('first_name,last_name,position,game_date,team,opp,salary,ppg_projection,confirmed_order\nJose,Ramirez,3B,2026-09-25,CLE,KC,5000,11.2,3','cheat');
  const p=applyImports([{...players[0],confirmed:false}],'2026-09-25',{cheat}).players[0];assert.equal(p.salary,5000);assert.equal(p.projection,11.2);assert.equal(p.confirmed,false);assert.equal(p.hr,30);
});
test('Savant metric units and missing values survive parsing',()=>{
  const rows=parseSavant('player_id,attempts,avg_hit_speed,ev95percent,brl_percent,brl_pa\n608070,100,92,45,12,8\n123,0,,0,,0');
  assert.equal(rows[0].barrelRate,12);assert.equal(rows[1].exitVelocity,null);assert.equal(rows[1].hardHit,0);assert.throws(()=>parseSavant('wrong,header\n1,2'));
});
