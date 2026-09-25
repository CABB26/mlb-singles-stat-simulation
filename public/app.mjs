import {rank} from './model.mjs';
const $ = id => document.getElementById(id);
const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct = n => (n*100).toFixed(1)+'%';
const demo = ['Mason Brooks','Diego Vega','Julian Carter','Leo Santos','Evan Reed','Noah Ellis','Kai Morgan','Owen Hayes'].map((name,i)=>({id:i+1,name,team:['Harbor City','West Coast','Northside'][i%3],opponent:'Demo opponent',hr:[44,39,36,32,28,25,19,15][i],pa:580+i*9,confirmed:true,slot:i+1,gameId:1,park:'Demo ballpark'}));
function clear(message) { $('picks').innerHTML=`<div class="empty">${escape(message)}</div>`; $('rows').innerHTML='';$('count').textContent='NO CURRENT RESULTS'; }
for (const id of ['source','pa','trials','unconfirmed']) $(id).addEventListener('change',()=>{clear('Settings changed. Run the model again.');$('status').textContent='Results cleared to match your new settings.';});
async function run() {
  const button=$('run'); const controls=['source','pa','trials','unconfirmed'];
  button.disabled=true;controls.forEach(id=>$(id).disabled=true);button.textContent='Simulating…'; clear('Loading the slate…');$('status').textContent='Checking upcoming games and batting orders…';
  try {
    const isDemo=$('source').value==='demo';
    const response = isDemo ? null : await fetch('/api/slate',{signal:AbortSignal.timeout(90000)});
    const data = isDemo ? {players:demo,warnings:[],games:4,date:'DEMO',season:'Demo',fetchedAt:new Date().toISOString()} : await response.json();
    if(response && !response.ok) throw new Error(data.error || 'Could not load the slate.');
    const eligible=data.players.filter(p=>$('unconfirmed').checked || p.confirmed);
    const results=rank(eligible,{opportunities:Number($('pa').value),trials:Number($('trials').value)});
    $('date').textContent=isDemo ? 'DEMO · FICTIONAL DATA' : data.date+' · EASTERN TIME';
    $('status').textContent=(isDemo ? 'DEMO — fictional players and illustrative stats. ' : `MLB feed · ${data.games} upcoming games · Updated ${new Date(data.fetchedAt).toLocaleTimeString()}. `)+`${results.length} eligible hitters · ${Number($('trials').value).toLocaleString()} simulations each. `+(data.warnings.length ? 'INCOMPLETE COVERAGE: '+data.warnings.join(' ') : '')+(!isDemo ? ' Lineups may change; refresh before game time.' : '');
    if(!isDemo && !$('unconfirmed').checked) $('status').textContent+=` ${data.players.filter(p=>!p.confirmed).length} unconfirmed candidate entries excluded; picks cover posted lineups only.`;
    if(!results.length){clear(data.games ? 'No eligible hitters yet. Try including unconfirmed hitters or refresh later.' : 'No upcoming games remain on today’s slate.');return;}
    $('picks').innerHTML=results.slice(0,3).map((p,i)=>`<article class="card"><div class="card-top"><span class="rank">0${i+1}</span><span class="badge">${isDemo?'DEMO':p.confirmed?'LINEUP POSTED':'UNCONFIRMED'}</span></div><h3>${escape(p.name)}</h3><div class="match">${escape(p.team)}<br>vs ${escape(p.opponent)}</div><div class="prob">${(p.chance*100).toFixed(1)}<span>%</span></div><div class="meter"><i style="width:${p.chance*100}%"></i></div><div class="metrics"><div><strong>${p.hr}</strong><small>SEASON HR</small></div><div><strong>${p.pa}</strong><small>SEASON PA</small></div><div><strong>${pct(p.simulated)}</strong><small>SIMULATED</small></div></div><p class="card-note">${escape(p.park)}${p.slot?' · Batting #'+p.slot:''}<br>${pct(p.rate)} adjusted HR / PA · ${$('pa').value} assumed PA${p.gameTime?' · '+new Date(p.gameTime).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):''}</p></article>`).join('');
    if(results.length<3) $('status').textContent+=' Fewer than three eligible hitters are available.';
    $('count').textContent=`${results.length} HITTERS RANKED`;
    $('rows').innerHTML=results.slice(3).map((p,i)=>`<tr><td>${i+4}</td><td>${escape(p.name)}<small>${escape(p.team)} vs ${escape(p.opponent)}</small></td><td>${p.hr}</td><td>${p.pa}</td><td>${pct(p.chance)}</td><td>${pct(p.simulated)}</td><td>${isDemo?'Demo':p.confirmed?'Posted':'Unconfirmed'}</td></tr>`).join('');
  } catch(error) {clear('No picks generated.');$('status').textContent=error.message+' You can choose demo mode to explore the simulator.';}
  finally {button.disabled=false;controls.forEach(id=>$(id).disabled=false);button.innerHTML='Find my top 3 <span>↗</span>';}
}
$('run').addEventListener('click',run);
$('date').textContent=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric'}).format(new Date())+' · ET';
