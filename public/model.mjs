const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const logit=p=>Math.log(clamp(p,1e-6,1-1e-6)/(1-clamp(p,1e-6,1-1e-6)));
const logistic=x=>1/(1+Math.exp(-x));
const ORDER_MULT={1:1.08,2:1.09,3:1.06,4:1.04,5:1.00,6:.97,7:.94,8:.91,9:.88};

export function probability(hr,pa,opportunities=4,prior=.03,strength=100){
  if(![hr,pa,opportunities,prior,strength].every(Number.isFinite)||hr<0||pa<hr||opportunities<0||!Number.isInteger(opportunities)||prior<0||prior>1||strength<=0)throw new Error('Invalid model inputs');
  const rate=(hr+strength*prior)/(pa+strength);
  return {rate,chance:1-(1-rate)**opportunities};
}

export function estimate(player,{opportunities=4,prior=.03,strength=100}={}){
  const base=probability(player.hr,player.pa,opportunities,prior,strength).rate;
  const s=player.savant||{};
  const bbe=Number.isFinite(s.bbe)?s.bbe:0;
  const rel=clamp(bbe/120,0,1);
  const barrel=Number.isFinite(s.barrelRate)?clamp((s.barrelRate-8.5)/7,-2,3):0;
  const hard=Number.isFinite(s.hardHit)?clamp((s.hardHit-39)/13,-2,2.5):0;
  const ev=Number.isFinite(s.exitVelocity)?clamp((s.exitVelocity-88.5)/4.5,-2,2.5):0;
  const contactAdj=rel*(.42*barrel+.16*hard+.14*ev);
  const orderMult=ORDER_MULT[player.slot]||1;
  const matchupMult=clamp(Number.isFinite(player.matchupFactor)?player.matchupFactor:1,.65,1.45);
  const parkMult=clamp(Number.isFinite(player.parkFactor)?player.parkFactor:1,.70,1.35);
  const weatherMult=clamp(Number.isFinite(player.weatherFactor)?player.weatherFactor:1,.75,1.30);
  const pitchMult=clamp(Number.isFinite(player.pitchFactor)?player.pitchFactor:1,.70,1.40);
  const contextMult=orderMult*matchupMult*parkMult*weatherMult*pitchMult;
  const perPA=clamp(logistic(logit(base)+contactAdj+Math.log(contextMult)),.002,.25);
  const gameChance=1-(1-perPA)**opportunities;
  const uncertainty=clamp(.30-0.00028*Math.min(player.pa||0,700)-0.001*Math.min(bbe,120),.08,.30);
  return {...player,baseRate:base,rate:perPA,chance:gameChance,uncertainty,
    factors:{contact:Math.exp(contactAdj),order:orderMult,matchup:matchupMult,park:parkMult,weather:weatherMult,pitch:pitchMult}};
}

export function random(seed){
  return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
}
function normal(rng){
  const u=Math.max(rng(),1e-12),v=Math.max(rng(),1e-12);return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}
function homerCount(rate,opportunities,shock,rng){
  const p=logistic(logit(rate)+shock);let n=0;for(let j=0;j<opportunities;j++)if(rng()<p)n++;return n;
}
function dedupe(players){
  const seen=new Set();return players.filter(p=>{const k=String(p.id);if(seen.has(k))return false;seen.add(k);return true;});
}

export function runMachine(players,{opportunities=4,trials=20000,seed=2026,comboPool=18,comboTrials=null}={}){
  if(!Number.isInteger(trials)||trials<1000||trials>250000)throw new Error('Invalid simulation count');
  if(!Number.isInteger(opportunities)||opportunities<1||opportunities>6)throw new Error('Invalid plate appearances');
  const estimated=dedupe(players).map(p=>estimate(p,{opportunities}));
  const rng=random(seed);const stats=estimated.map(()=>({one:0,two:0,total:0}));
  for(let t=0;t<trials;t++){
    const gameShock=new Map();
    for(let i=0;i<estimated.length;i++){
      const p=estimated[i],g=p.gameId??`p${p.id}`;
      if(!gameShock.has(g))gameShock.set(g,normal(rng)*.12);
      const shock=gameShock.get(g)+normal(rng)*p.uncertainty;
      const n=homerCount(p.rate,opportunities,shock,rng);
      if(n>=1)stats[i].one++;if(n>=2)stats[i].two++;stats[i].total+=n;
    }
  }
  const ranked=estimated.map((p,i)=>({...p,simulated:stats[i].one/trials,twoPlus:stats[i].two/trials,expectedHR:stats[i].total/trials}))
    .sort((a,b)=>b.simulated-a.simulated||b.twoPlus-a.twoPlus||b.pa-a.pa||a.id-b.id);
  const pool=ranked.slice(0,Math.min(comboPool,ranked.length));
  const triples=[];
  for(let a=0;a<pool.length-2;a++)for(let b=a+1;b<pool.length-1;b++)for(let c=b+1;c<pool.length;c++)triples.push({idx:[a,b,c],any:0,two:0,all:0,three:0});
  const ct=comboTrials??Math.min(trials,20000);const crng=random(seed^0x51f15e);
  for(let t=0;t<ct;t++){
    const gs=new Map(),counts=new Uint8Array(pool.length);
    for(let i=0;i<pool.length;i++){
      const p=pool[i],g=p.gameId??`p${p.id}`;if(!gs.has(g))gs.set(g,normal(crng)*.12);
      counts[i]=homerCount(p.rate,opportunities,gs.get(g)+normal(crng)*p.uncertainty,crng);
    }
    for(const x of triples){const a=counts[x.idx[0]],b=counts[x.idx[1]],c=counts[x.idx[2]],total=a+b+c;
      if(total>=1)x.any++;if(total>=2)x.two++;if(a&&b&&c)x.all++;if(total>=3)x.three++;}
  }
  const combos=triples.map(x=>({players:x.idx.map(i=>({id:pool[i].id,name:pool[i].name,team:pool[i].team})),anyHR:x.any/ct,twoPlusHR:x.two/ct,allThreeHR:x.all/ct,threePlusHR:x.three/ct}))
    .sort((a,b)=>b.allThreeHR-a.allThreeHR||b.threePlusHR-a.threePlusHR||b.twoPlusHR-a.twoPlusHR||b.anyHR-a.anyHR);
  return {players:ranked,combos,trials,comboTrials:ct,opportunities};
}

export function rank(players,options={}){return runMachine(players,options).players;}
