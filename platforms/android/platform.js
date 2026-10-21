import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';

const NativeVoice=registerPlugin('LapkiVoice');

export class Platform {
  playing=false;
  available=false;
  failed=false;
  onPause=()=>{};
  onResume=()=>{};
  onBack=()=>false;
  #started=false;
  #app;
  #voice;
  #native;
  #warned=false;

  constructor({native=Capacitor.isNativePlatform(),app=App,voice=NativeVoice}={}) {
    this.#native=native;this.#app=app;this.#voice=voice;
  }

  async init() {
    if(this.#started||!this.#native)return 'ru';
    this.#started=true;
    try {
      await this.#app.addListener('appStateChange',({isActive})=>{
        if(isActive)this.onResume();else{this.stop();this.cancelVoice();this.onPause();}
      });
      await this.#app.addListener('backButton',()=>{
        if(!this.onBack())this.#app.exitApp().catch(()=>{});
      });
      this.available=true;
    } catch { this.failed=true; }
    return 'ru';
  }
  ready() {}
  start() {if(!document.hidden)this.playing=true;}
  stop() {this.playing=false;}
  cancelVoice() {if(this.#native)this.#voice.cancel().catch(()=>{});}
  say(text) {
    if(!this.#native)return;
    this.#voice.speak({text}).then(({spoken,reason})=>{
      if(!spoken&&reason==='missing_voice'&&!this.#warned){
        this.#warned=true;
        const toast=document.getElementById('toast');
        if(toast){toast.textContent='Для озвучки нужен русский голос в настройках синтеза речи Android. Игра доступна и без голоса.';toast.classList.add('visible');setTimeout(()=>toast.classList.remove('visible'),7000);}
      }
    }).catch(()=>{});
  }
}
