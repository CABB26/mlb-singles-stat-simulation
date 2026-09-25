import {test} from 'node:test';
import assert from 'node:assert/strict';
import {probability,rank} from '../public/model.mjs';
test('game probability and prior follow the documented model',()=>{
  assert.equal(probability(30,500,4).rate,33/600);
  assert.equal(probability(30,500,4).chance,1-(1-33/600)**4);
  assert.equal(probability(0,0).rate,.03);
  assert.throws(()=>probability(20,10));
});
test('simulation converges, is reproducible, and deduplicates doubleheaders',()=>{
  const players=[{id:1,gameId:1,hr:40,pa:500},{id:2,gameId:1,hr:10,pa:500},{id:1,gameId:2,hr:40,pa:500}];
  const result=rank(players,{trials:50000});assert.equal(result.length,2);assert.equal(result[0].id,1);
  for(const p of result) assert.ok(Math.abs(p.simulated-p.chance)<.01);
  assert.deepEqual(result,rank(players,{trials:50000}));
});
