import {runMachine} from './model.mjs';
self.onmessage=event=>{
  try{
    const {players,options}=event.data||{};
    const result=runMachine(players||[],options||{});
    self.postMessage({ok:true,result});
  }catch(error){
    self.postMessage({ok:false,error:error?.message||'Simulation failed'});
  }
};
