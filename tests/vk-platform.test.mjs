import test from 'node:test';
import assert from 'node:assert/strict';
import { Platform } from '../platforms/vk/platform.js';

function fixture(t,{bridge,search='?vk_app_id=12345'}={}){
  const previous={window:globalThis.window,location:globalThis.location,document:globalThis.document};
  globalThis.window={vkBridge:bridge};globalThis.location={search};globalThis.document={hidden:false};
  t.after(()=>{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
}
test('VK init is sent once, and game lifecycle does not request ads or personal data',async t=>{
  const calls=[],listeners=[];fixture(t,{bridge:{send:async method=>{calls.push(method);return {result:true};},subscribe:fn=>listeners.push(fn)}});
  const platform=new Platform();assert.equal(await platform.init(),'ru');assert.equal(await platform.init(),'ru');assert.equal(platform.available,true);
  platform.ready();platform.start();assert.equal(platform.playing,true);platform.stop();assert.equal(platform.playing,false);
  assert.deepEqual(calls,['VKWebAppInit']);assert.equal(listeners.length,1);
});
test('VK hide and restore events pause and resume the shared game',async t=>{
  let listener,pauses=0,resumes=0;fixture(t,{bridge:{send:async()=>({result:true}),subscribe:fn=>listener=fn}});
  const platform=new Platform();platform.onPause=()=>pauses++;platform.onResume=()=>resumes++;await platform.init();platform.start();
  listener({detail:{type:'VKWebAppViewHide'}});assert.equal(platform.playing,false);assert.equal(pauses,1);
  listener({detail:{type:'VKWebAppViewRestore'}});assert.equal(resumes,1);listener({detail:{type:'OtherEvent'}});assert.equal(resumes,1);
  document.hidden=true;platform.start();assert.equal(platform.playing,false);
});
test('opening the VK build outside VK does not wait for a transport or request initialization',async t=>{
  let sent=false;fixture(t,{search:'',bridge:{isWebView:()=>false,isIframe:()=>false,send:()=>{sent=true;},subscribe(){}}});
  const platform=new Platform();assert.equal(await platform.init(),null);assert.equal(sent,false);assert.equal(platform.failed,false);
});
test('native VK transport initializes even when query parameters are absent',async t=>{
  fixture(t,{search:'',bridge:{isWebView:()=>true,send:async()=>({result:true}),subscribe(){}}});
  const platform=new Platform();await platform.init();assert.equal(platform.available,true);
});
test('missing, rejected or broken VK bridge fails safely without aborting the game',async t=>{
  fixture(t);
  for(const bridge of [undefined,{send:async()=>{throw new Error('offline');},subscribe(){}},{send:async()=>({result:false}),subscribe(){}},{send:async()=>({result:true}),subscribe(){throw new Error('broken transport');}}]){
    window.vkBridge=bridge;const platform=new Platform();assert.equal(await platform.init(),null);assert.equal(platform.failed,true);assert.equal(platform.available,false);
  }
});
test('a stalled VK initialization times out and a late response cannot mark it ready',async t=>{
  let resolve;fixture(t,{bridge:{send:()=>new Promise(done=>resolve=done),subscribe(){}}});
  t.mock.timers.enable({apis:['setTimeout']});const platform=new Platform(),pending=platform.init();t.mock.timers.tick(5001);
  assert.equal(await pending,null);resolve({result:true});await Promise.resolve();assert.equal(platform.available,false);assert.equal(platform.failed,true);
});
