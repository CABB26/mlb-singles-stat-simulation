import {test} from 'node:test';
import assert from 'node:assert/strict';
import {slate,pitcherMatchup} from '../src/worker.mjs';

test('starter HR matchup is shrunk and bounded',()=>{
  assert.equal(pitcherMatchup(null).factor,1);
  const low=pitcherMatchup({homeRuns:5,battersFaced:500});
  const high=pitcherMatchup({homeRuns:35,battersFaced:500});
  assert.ok(low.factor<1);assert.ok(high.factor>1);assert.ok(high.factor<=1.30);assert.ok(low.factor>=.78);
});

test('feed excludes started games, respects posted lineups, enriches probable starters, and reports failed games',async()=>{
  const original=globalThis.fetch;
  const game=(id,state)=>({gamePk:id,gameType:'R',status:{codedGameState:state},gameDate:'2026-09-25T23:00:00Z',teams:{away:{team:{id:1,name:'Away'},probablePitcher:{id:101,fullName:'Away Starter'}},home:{team:{id:2,name:'Home'},probablePitcher:{id:102,fullName:'Home Starter'}}},venue:{name:'Park'}});
  const player=id=>({person:{id,fullName:'Player '+id},position:{abbreviation:'DH'},status:{code:'A'}});
  const order=Array.from({length:9},(_,i)=>i+1);
  globalThis.fetch=async url=>{
    if(url.includes('/schedule'))return Response.json({dates:[{games:[game(1,'P'),game(2,'I'),game(3,'F'),game(4,'S')]}]});
    if(url.includes('group=hitting'))return Response.json({stats:[{totalSplits:11,splits:Array.from({length:11},(_,i)=>({player:{id:i+1},stat:{homeRuns:25,plateAppearances:450}}))}]});
    if(url.includes('group=pitching'))return Response.json({stats:[{totalSplits:2,splits:[{player:{id:101},stat:{homeRuns:10,battersFaced:500}},{player:{id:102},stat:{homeRuns:30,battersFaced:500}}]}]});
    if(url.includes('/game/4/'))return new Response('',{status:503});
    assert.ok(url.includes('/game/1/'));
    return Response.json({teams:{away:{battingOrder:order,players:Object.fromEntries([...order,10].map(id=>[id,player(id)]))},home:{battingOrder:[],players:{11:player(11)}}}});
  };
  try{
    const data=await slate();
    assert.equal(data.games,2);assert.equal(data.players.length,10);assert.equal(data.players[0].hr,25);assert.equal(data.players[0].pa,450);assert.equal(data.players.filter(p=>p.confirmed).length,9);assert.ok(!data.players.some(p=>p.id===10));
    assert.equal(data.players[0].probablePitcher,'Home Starter');assert.ok(data.players[0].matchupFactor>1);assert.equal(data.starterCoverage.matched,2);assert.equal(data.starterCoverage.total,2);assert.equal(data.warnings.length,1);
  }finally{globalThis.fetch=original;}
});
