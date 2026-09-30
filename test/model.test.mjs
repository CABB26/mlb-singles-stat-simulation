import {test} from 'node:test';
import assert from 'node:assert/strict';
import {probability,estimate,runMachine} from '../public/model.mjs';

test('stabilized HR/PA baseline remains backward-compatible',()=>{
  assert.equal(probability(30,500,4).rate,33/600);
  assert.equal(probability(30,500,4).chance,1-(1-33/600)**4);
  assert.equal(probability(0,0).rate,.03);
  assert.throws(()=>probability(20,10));
});

test('contact quality moves HR probability in the expected direction',()=>{
  const base={id:1,gameId:1,name:'Power Bat',team:'A',hr:30,pa:500,slot:4};
  const neutral=estimate(base,{opportunities:4});
  const strong=estimate({...base,savant:{barrelRate:18,hardHit:52,exitVelocity:93,bbe:180}},{opportunities:4});
  const weak=estimate({...base,savant:{barrelRate:3,hardHit:25,exitVelocity:82,bbe:180}},{opportunities:4});
  assert.ok(strong.chance>neutral.chance);
  assert.ok(neutral.chance>weak.chance);
});

test('machine is reproducible, deduplicates hitters and scores 3-player combos',()=>{
  const players=[
    {id:1,gameId:1,name:'A',team:'NYY',hr:40,pa:500,slot:2,savant:{barrelRate:17,hardHit:50,exitVelocity:92,bbe:180}},
    {id:2,gameId:1,name:'B',team:'NYY',hr:32,pa:500,slot:3,savant:{barrelRate:14,hardHit:47,exitVelocity:91,bbe:170}},
    {id:3,gameId:2,name:'C',team:'LAD',hr:35,pa:520,slot:1,savant:{barrelRate:15,hardHit:48,exitVelocity:91,bbe:175}},
    {id:4,gameId:2,name:'D',team:'LAD',hr:20,pa:510,slot:5,savant:{barrelRate:10,hardHit:41,exitVelocity:89,bbe:160}},
    {id:1,gameId:3,name:'A',team:'NYY',hr:40,pa:500,slot:2}
  ];
  const a=runMachine(players,{trials:5000,comboTrials:3000,seed:7});
  const b=runMachine(players,{trials:5000,comboTrials:3000,seed:7});
  assert.equal(a.players.length,4);
  assert.ok(a.combos.length>0);
  assert.deepEqual(a,b);
  assert.ok(a.players[0].simulated>=a.players.at(-1).simulated);
  assert.ok(a.combos[0].allThreeHR>=0&&a.combos[0].allThreeHR<=1);
});
