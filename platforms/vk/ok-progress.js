// Storage belongs to the platform account. Never copy the shared browser save
// into OK: VK and OK use the same hosting origin, but different players.
export const OK_SAVE_KEY='lapki_ok_progress_v1';

function mergeProgress(previous,next){
  if(!previous)return next;
  if(!next)return previous;
  return {...next,
    album:[...new Set([...(previous.album||[]),...(next.album||[])])],
    completedSessions:Math.max(previous.completedSessions||0,next.completedSessions||0),
  };
}

export class OKProgressStore {
  loaded=false;
  loading=null;
  writing=false;
  pending=null;
  current=null;
  status='loading';
  constructor(bridge,onStatus=()=>{}){this.bridge=bridge;this.onStatus=onStatus;}
  notify(status){this.status=status;this.onStatus(status);}

  async load(){
    if(this.loaded)return this.current;
    if(this.loading)return this.loading;
    this.loading=this.read();
    try{return await this.loading;}finally{this.loading=null;}
  }
  async read(){
    let timer;
    try{
      const result=await Promise.race([
        this.bridge.send('VKWebAppStorageGet',{keys:[OK_SAVE_KEY]}),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Storage read timeout')),5000);}),
      ]);
      const entry=result?.keys?.find(item=>item.key===OK_SAVE_KEY);
      if(typeof entry?.value!=='string')throw new Error('Missing storage result');
      let saved=null;
      if(entry.value){
        saved=JSON.parse(entry.value);
        if(!saved||typeof saved!=='object'||Array.isArray(saved)||!Array.isArray(saved.album)
          ||!Number.isSafeInteger(saved.completedSessions)||saved.completedSessions<0)
          throw new Error('Invalid stored progress');
      }
      this.current=mergeProgress(saved,this.current);
      if(this.pending)this.pending=JSON.stringify(this.current);
      this.loaded=true;this.notify(this.pending?'saving':'saved');
      return this.current;
    }catch{this.notify('error');return null;}
    finally{clearTimeout(timer);}
  }
  save(value){
    // Detach from mutable game state before awaiting the transport.
    this.current=mergeProgress(this.current,JSON.parse(JSON.stringify(value)));
    this.pending=JSON.stringify(this.current);
    void this.flush();
  }
  async flush(){
    if(this.writing||!this.pending)return;
    if(!this.loaded){await this.load();if(!this.loaded)return;}
    if(this.writing||!this.pending)return;
    const value=this.pending;this.pending=null;this.writing=true;this.notify('saving');
    // A timeout reports failure, but does NOT start a second concurrent write.
    // Otherwise a late older write could overwrite the most recent snapshot.
    const timer=setTimeout(()=>this.notify('error'),5000);
    let success=false;
    try{
      const response=await this.bridge.send('VKWebAppStorageSet',{key:OK_SAVE_KEY,value});
      if(response?.result!==true)throw new Error('Storage write not confirmed');
      success=true;this.notify(this.pending?'saving':'saved');
    }catch{this.pending ||= value;this.notify('error');}
    finally{clearTimeout(timer);this.writing=false;}
    if(success&&this.pending)void this.flush();
  }
  retry(){if(this.pending)void this.flush();else if(!this.loaded)void this.load();}
}
