import {test} from 'node:test';
import assert from 'node:assert/strict';
import {slate} from '../src/worker.mjs';
test('feed excludes started games, respects posted lineups, and reports failed games',async()=>{
  const original=globalThis.fetch;
  const game=(id,state)=>({gamePk:id,gameType:'R',status:{codedGameState:state},gameDate:'2026-09-25T23:00:00Z',teams:{away:{team:{name:'Away'}},home:{team:{name:'Home'}}},venue:{name:'Park'}});
  const player=id=>({person:{id,fullName:'Player '+id},position:{abbreviation:'DH'},status:{code:'A'},seasonStats:{batting:{homeRuns:20,plateAppearances:300}}});
  const order=Array.from({length:9},(_,i)=>i+1);
  globalThis.fetch=async url=>{
    if(url.includes('/schedule')) return Response.json({dates:[{games:[game(1,'P'),game(2,'I'),game(3,'F'),game(4,'S')]}]});
    if(url.includes('/game/4/')) return new Response('',{status:503});
    assert.ok(url.includes('/game/1/'));
    return Response.json({teams:{away:{battingOrder:order,players:Object.fromEntries([...order,10].map(id=>[id,player(id)]))},home:{battingOrder:[],players:{11:player(11)}}}});
  };
  try {const data=await slate();assert.equal(data.games,2);assert.equal(data.players.length,10);assert.equal(data.players.filter(p=>p.confirmed).length,9);assert.equal(data.warnings.length,1);assert.ok(!data.players.some(p=>p.id===10));}
  finally {globalThis.fetch=original;}
});
