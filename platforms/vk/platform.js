// This adapter replaces kids/platform.js only in the VK build.
// VK Bridge is supplied locally by the official browser distribution.
export class Platform {
  playing = false;
  available = false;
  failed = false;
  onPause = () => {};
  onResume = () => {};
  bridge = null;
  initPromise = null;

  init() {
    this.initPromise ||= this.initialize();
    return this.initPromise;
  }

  async initialize() {
    let timeout;
    try {
      const bridge=window.vkBridge;
      const launchedInVK=new URLSearchParams(location.search).has('vk_app_id')||bridge?.isWebView?.()||bridge?.isIframe?.();
      if(!launchedInVK)return null;
      if(!bridge?.send||!bridge?.subscribe){this.failed=true;return null;}
      this.bridge=bridge;
      bridge.subscribe(event=>{
        const type=event.detail?.type;
        if(type==='VKWebAppViewHide'){this.stop();this.onPause();}
        if(type==='VKWebAppViewRestore')this.onResume();
      });
      const response=await Promise.race([
        bridge.send('VKWebAppInit'),
        new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('VK initialization timed out')),5000);}),
      ]);
      if(response?.result!==true)throw new Error('VK initialization was not confirmed');
      this.available=true;
      return 'ru';
    }catch{this.failed=true;return null;}
    finally{clearTimeout(timeout);}
  }

  // The shared game tracks its own active screen. These calls do not request ads
  // or personal data; monetization requires separate platform approval.
  ready() {}
  start() {if(!document.hidden)this.playing=true;}
  stop() {this.playing=false;}
}
