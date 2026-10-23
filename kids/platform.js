// This adapter replaces kids/platform.js only in the VK build.
// VK Bridge is supplied locally by the official browser distribution.
import { OKProgressStore } from './ok-progress.js?v=87a9afdbd81c';
const OK_PLATFORMS=new Set(['desktop_web_ok','mobile_android_ok','mobile_iphone_ok','mobile_web_ok']);
export class Platform {
  playing = false;
  available = false;
  failed = false;
  onPause = () => {};
  onResume = () => {};
  bridge = null;
  initPromise = null;
  network = 'unknown';
  embedded = false;
  progressStore = null;
  onProgressStatus = () => {};
  get cloudProgress(){return this.network==='ok';}

  constructor(){
    const value=new URLSearchParams(location.search).get('vk_platform');
    if(value)this.network=OK_PLATFORMS.has(value)?'ok':'vk';
  }

  init() {
    this.initPromise ||= this.initialize();
    return this.initPromise;
  }

  async initialize() {
    let timeout;
    try {
      const bridge=window.vkBridge;
      const launchedInVK=new URLSearchParams(location.search).has('vk_app_id')||bridge?.isWebView?.()||bridge?.isIframe?.();
      this.embedded=Boolean(launchedInVK);
      if(!launchedInVK)return null;
      if(!bridge?.send||!bridge?.subscribe){this.failed=true;return null;}
      this.bridge=bridge;
      bridge.subscribe(event=>{
        const type=event.detail?.type;
        if(type==='VKWebAppViewHide'){this.stop();this.onPause();}
        if(type==='VKWebAppViewRestore'){this.onResume();this.retryProgress();}
      });
      const response=await Promise.race([
        bridge.send('VKWebAppInit'),
        new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('VK initialization timed out')),5000);}),
      ]);
      if(response?.result!==true)throw new Error('VK initialization was not confirmed');
      this.available=true;
      if(this.network==='unknown'){
        clearTimeout(timeout);
        try{
          const params=await Promise.race([
            bridge.send('VKWebAppGetLaunchParams'),
            new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Launch parameters timeout')),3000);}),
          ]);
          if(params?.vk_platform)this.network=OK_PLATFORMS.has(params.vk_platform)?'ok':'vk';
        }catch{}
      }
      return 'ru';
    }catch{this.failed=true;return null;}
    finally{clearTimeout(timeout);}
  }

  async loadProgress(){
    // Unknown embedded launches must not read a VK/browser album into OK.
    if(this.network==='unknown'&&this.embedded){this.onProgressStatus('unknown');return null;}
    if(!this.cloudProgress)return undefined;
    this.progressStore=new OKProgressStore(this.bridge,status=>this.onProgressStatus(status));
    return this.progressStore.load();
  }
  saveProgress(value){this.progressStore?.save(value);}
  retryProgress(){this.progressStore?.retry();}

  // The shared game tracks its own active screen. These calls do not request ads
  // or personal data; monetization requires separate platform approval.
  ready() {}
  start() {if(!document.hidden)this.playing=true;}
  stop() {this.playing=false;}
}
