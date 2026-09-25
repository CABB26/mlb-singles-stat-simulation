import {rank} from './model.mjs';
import {importCSV,applyImports} from './imports.mjs';
const $ = id => document.getElementById(id);
const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct = n => (n*100).toFixed(1)+'%';
const metric=(n,suffix='')=>n===undefined||n===null?'n/a':n.toFixed(1)+suffix;
let imports={dk:null,cheat:null};
let loadingFile=false;
const demo = ['Mason Brooks','Diego Vega','Julian Carter','Leo Santos','Evan Reed','Noah Ellis','Kai Morgan','Owen Hayes'].map((name,i)=>({id:i+1,name,team:['Harbor City','West Coast','Northside'][i%3],opponent:'Demo opponent',hr:[44,39,36,32,28,25,19,15][i],pa:580+i*9,confirmed:true,slot:i+1,gameId:1,park:'Demo ballpark'}));
function clear(message) { $('picks').innerHTML=`<div class="empty">${escape(message)}</div>`; $('rows').innerHTML='';$('count').textContent='NO CURRENT RESULTS';$('savant-status').textContent='';$('import-report').hidden=true; }
for (const id of ['source','pa','trials','unconfirmed','savant']) $(id).addEventListener('change',()=>{clear('Settings changed. Run the model again.');$('status').textContent='Results cleared to match your new settings.';});
for(const kind of ['dk','cheat']) $(kind+'-file').addEventListener('change',async()=>{
  const file=$(kind+'-file').files[0];imports[kind]=null;clear('Uploads changed. Run the model again.');
  if(!file){$(kind+'-info').textContent='No file selected.';return;}
  loadingFile=true;$('run').disabled=true;['dk-file','cheat-file','clear-files'].forEach(id=>$(id).disabled=true);
  try{if(file.size>5_000_000)throw new Error('File exceeds 5 MB.');const parsed=importCSV(await file.text(),kind);imports[kind]=parsed;$(kind+'-info').textContent=`${file.name} · ${parsed.rows.length} hitters · ${parsed.pitchers} pitchers removed`;$('upload-status').textContent='File loaded locally. Run the model to match it against today’s upcoming games.';}
  catch(error){$(kind+'-file').value='';$(kind+'-info').textContent='File rejected.';$('upload-status').textContent=error.message;}
  finally{loadingFile=false;$('run').disabled=false;['dk-file','cheat-file','clear-files'].forEach(id=>$(id).disabled=false);}
});
$('clear-files').addEventListener('click',()=>{imports={dk:null,cheat:null};for(const kind of ['dk','cheat']){$(kind+'-file').value='';$(kind+'-info').textContent='No file selected.';}$('upload-status').textContent='Uploads cleared. Live mode will use the full MLB candidate pool.';clear('Uploads cleared. Run the model again.');});
async function run() {
  if(loadingFile)return;
  const button=$('run'); const controls=['source','pa','trials','unconfirmed','savant','dk-file','cheat-file','clear-files'];
  button.disabled=true;controls.forEach(id=>$(id).disabled=true);button.textContent='Simulating…'; clear('Loading the slate…');$('status').textContent='Checking upcoming games and batting orders…';
  try {
    const isDemo=$('source').value==='demo';
    const response = isDemo ? null : await fetch('/api/slate',{signal:AbortSignal.timeout(90000)});
    const data = isDemo ? {players:demo,warnings:[],games:4,date:'DEMO',season:'Demo',fetchedAt:new Date().toISOString()} : await response.json();
    if(response && !response.ok) throw new Error(data.error || 'Could not load the slate.');
    const joined=isDemo?{players:data.players,issues:[],excluded:0}:applyImports(data.players,data.date,imports);
    $('import-report').hidden=!joined.issues.length;
    $('import-issues').innerHTML=joined.issues.map(issue=>`<li>${escape(issue)}</li>`).join('');
    if(imports.dk||imports.cheat)$('upload-status').textContent=isDemo?'Demo mode ignores uploaded files.':`${joined.players.length} matched game entries before lineup filtering; ${joined.excluded} entries excluded for OUT/IL status; ${joined.issues.length} match issues. See the report below.`;
    const eligible=joined.players.filter(p=>$('unconfirmed').checked || p.confirmed);
    if(!isDemo&&$('savant').checked){
      $('status').textContent='MLB slate loaded. Fetching Baseball Savant contact metrics…';
      try{const sr=await fetch('/api/savant',{signal:AbortSignal.timeout(25000)});const sd=await sr.json();if(!sr.ok)throw new Error(sd.error||'Savant unavailable.');const byId=new Map(sd.players.map(p=>[p.id,p]));for(const p of eligible)p.savant=byId.get(p.id)||null;const matched=new Set(eligible.filter(p=>p.savant).map(p=>p.id)).size;
        $('savant-status').textContent=`Baseball Savant · ${sd.season} season · Retrieved ${new Date(sd.fetchedAt).toLocaleString()} · ${matched} eligible hitters matched. Contact metrics do not alter HR probability. Feed refresh timing may lag games; cache up to 30 minutes.`;
      }catch(error){$('savant-status').textContent=error.message+' Savant values are unavailable; MLB baseline only.';}
    }else $('savant-status').textContent=isDemo?'Demo mode: no live Savant metrics.':'Savant metrics disabled.';
    const results=rank(eligible,{opportunities:Number($('pa').value),trials:Number($('trials').value)});
    $('date').textContent=isDemo ? 'DEMO · FICTIONAL DATA' : data.date+' · EASTERN TIME';
    $('status').textContent=(isDemo ? 'DEMO — fictional players and illustrative stats. ' : `MLB feed · ${data.games} upcoming games · Updated ${new Date(data.fetchedAt).toLocaleTimeString()}. `)+`${results.length} eligible hitters · ${Number($('trials').value).toLocaleString()} simulations each. `+(data.warnings.length ? 'INCOMPLETE COVERAGE: '+data.warnings.join(' ') : '')+(!isDemo ? ' Lineups may change; refresh before game time.' : '');
    if(!isDemo && !$('unconfirmed').checked) $('status').textContent+=` ${data.players.filter(p=>!p.confirmed).length} unconfirmed candidate entries excluded; picks cover posted lineups only.`;
    if(!results.length){$('picks').innerHTML=`<div class="empty">${data.games?'No eligible hitters yet. Try including unconfirmed hitters or refresh later.':'No upcoming games remain on today’s slate.'}</div>`;return;}
    $('picks').innerHTML=results.slice(0,3).map((p,i)=>`<article class="card"><div class="card-top"><span class="rank">0${i+1}</span><span class="badge">${isDemo?'DEMO':p.confirmed?'LINEUP POSTED':'UNCONFIRMED'}</span></div><h3>${escape(p.name)}</h3><div class="match">${escape(p.team)}<br>vs ${escape(p.opponent)}</div><div class="prob">${(p.chance*100).toFixed(1)}<span>%</span></div><div class="meter"><i style="width:${p.chance*100}%"></i></div><div class="metrics"><div><strong>${p.hr}</strong><small>SEASON HR</small></div><div><strong>${p.pa}</strong><small>SEASON PA</small></div><div><strong>${pct(p.simulated)}</strong><small>SIMULATED</small></div></div><p class="card-note">${escape(p.park)}${p.slot?' · Batting #'+p.slot:''}<br>${pct(p.rate)} adjusted HR / PA · ${$('pa').value} assumed PA${p.gameTime?' · '+new Date(p.gameTime).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):''}</p></article>`).join('');
    if(results.length<3) $('status').textContent+=' Fewer than three eligible hitters are available.';
    $('count').textContent=`${results.length} HITTERS RANKED`;
    $('rows').innerHTML=results.slice(3).map((p,i)=>`<tr><td>${i+4}</td><td>${escape(p.name)}<small>${escape(p.team)} vs ${escape(p.opponent)}</small></td><td>${p.hr}</td><td>${p.pa}</td><td>${pct(p.chance)}</td><td>${pct(p.simulated)}</td><td>${isDemo?'Demo':p.confirmed?'Posted':'Unconfirmed'}</td></tr>`).join('');
    [...$('picks').children].forEach((card,i)=>{const p=results[i],s=p.savant;card.insertAdjacentHTML('beforeend',`<div class="savant-metrics"><div><strong>${metric(s?.barrelRate,'%')}</strong><small>BARREL / BBE</small></div><div><strong>${metric(s?.hardHit,'%')}</strong><small>HARD HIT</small></div><div><strong>${metric(s?.exitVelocity)}</strong><small>AVG EV · MPH</small></div></div><p class="fineprint">${s?`${s.bbe??'n/a'} batted balls${s.bbe<50?' · Small sample':''}`:'Savant data unavailable'}</p>${p.salary!==null&&p.salary!==undefined||p.projection!==null&&p.projection!==undefined||p.injury||p.importedOrder?`<p class="upload-context">${p.salary!=null?'Salary $'+p.salary.toLocaleString()+' · ':''}${p.projection!=null?'DFF fantasy projection '+p.projection+' · ':''}${p.importedOrder?'CSV order #'+p.importedOrder+' · ':''}${escape(p.injury||'No injury flag in matched upload')}</p>`:''}`);});
    [...$('rows').children].forEach((row,i)=>{const p=results[i+3],s=p.savant;row.children[6].textContent+=(p.injury?' / '+p.injury:'');row.insertAdjacentHTML('beforeend',`<td>${p.salary!=null?'$'+p.salary.toLocaleString():'n/a'}</td><td>${metric(s?.barrelRate,'%')}<small>${s?.bbe??'n/a'} BBE</small></td><td>${metric(s?.hardHit,'%')}</td><td>${metric(s?.exitVelocity,' mph')}</td>`);});
  } catch(error) {clear('No picks generated.');$('status').textContent=error.message+' You can choose demo mode to explore the simulator.';}
  finally {button.disabled=false;controls.forEach(id=>$(id).disabled=false);button.innerHTML='Find my top 3 <span>↗</span>';}
}
$('run').addEventListener('click',run);
$('date').textContent=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric'}).format(new Date())+' · ET';
