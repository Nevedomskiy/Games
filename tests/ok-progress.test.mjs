import test from 'node:test';
import assert from 'node:assert/strict';
import { OKProgressStore,OK_SAVE_KEY } from '../platforms/vk/ok-progress.js';
import { Platform } from '../platforms/vk/platform.js';
const snapshot=(album=[],completedSessions=album.length)=>({session:null,album,completedSessions,sound:false,lastReward:album.at(-1)||'bunny'});
const response=value=>({keys:[{key:OK_SAVE_KEY,value:value===null?'':JSON.stringify(value)}]});
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('account cloud load uses a separate key, not browser storage or tokens',async()=>{
  const calls=[],saved=snapshot(['cat']);
  const store=new OKProgressStore({send:async(method,args)=>{calls.push([method,args]);return response(saved);}});
  assert.deepEqual(await store.load(),saved);
  assert.deepEqual(calls,[['VKWebAppStorageGet',{keys:[OK_SAVE_KEY]}]]);
});
test('writes coalesce in order and detach mutable game state',async()=>{
  const writes=[],resolve=[];
  const store=new OKProgressStore({send:(method,args)=>{
    if(method==='VKWebAppStorageGet')return Promise.resolve(response(null));
    writes.push(JSON.parse(args.value));return new Promise(done=>resolve.push(done));
  }});
  await store.load();const value=snapshot(['bunny']);store.save(value);value.album.push('cat');
  store.save(snapshot(['bunny','fox']));store.save(snapshot(['bunny','fox','frog']));
  assert.equal(writes.length,1);assert.deepEqual(writes[0].album,['bunny']);
  resolve[0]({result:true});await settle();assert.equal(writes.length,2);
  assert.deepEqual(writes[1].album,['bunny','fox','frog']);resolve[1]({result:true});await settle();assert.equal(store.status,'saved');
});
test('failed reads never overwrite cloud; recovery preserves existing stickers',async()=>{
  let offline=true;const writes=[];
  const store=new OKProgressStore({send:async(method,args)=>{
    if(method==='VKWebAppStorageGet'){if(offline)throw Error('offline');return response(snapshot(['cat'],4));}
    writes.push(JSON.parse(args.value));return {result:true};
  }});
  assert.equal(await store.load(),null);store.save(snapshot(['bunny']));await settle();assert.deepEqual(writes,[]);
  offline=false;store.retry();await settle();assert.deepEqual(writes[0].album,['cat','bunny']);assert.equal(writes[0].completedSessions,4);
  store.save(snapshot(['bunny','fox'],2));await settle();assert.deepEqual(writes.at(-1).album,['cat','bunny','fox']);
});
test('malformed cloud data is not treated as a new empty account',async()=>{
  for(const result of [{},{keys:[]},{keys:[{key:OK_SAVE_KEY,value:'broken'}]},response([])]){
    let writes=0;const store=new OKProgressStore({send:async method=>{if(method==='VKWebAppStorageSet')writes++;return result;}});
    await store.load();store.save(snapshot(['bunny']));await settle();assert.equal(store.loaded,false);assert.equal(writes,0);assert.equal(store.status,'error');
  }
});
test('a timed out read ignores its late response; a timed out write never overlaps a newer write',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});let finishRead,finishWrite;const writes=[];
  const store=new OKProgressStore({send:(method,args)=>{
    if(method==='VKWebAppStorageGet')return new Promise(done=>finishRead=done);
    writes.push(JSON.parse(args.value));return new Promise(done=>finishWrite=done);
  }});
  const read=store.load();t.mock.timers.tick(5001);assert.equal(await read,null);
  finishRead(response(snapshot(['cat'])));await settle();assert.equal(store.loaded,false);
  store.bridge.send=(method,args)=>{
    if(method==='VKWebAppStorageGet')return Promise.resolve(response(null));
    writes.push(JSON.parse(args.value));return new Promise(done=>finishWrite=done);
  };
  await store.load();store.save(snapshot(['bunny']));t.mock.timers.tick(5001);assert.equal(store.status,'error');
  store.save(snapshot(['bunny','cat']));assert.equal(writes.length,1);
  finishWrite({result:true});await settle();assert.equal(writes.length,2);finishWrite({result:true});await settle();assert.equal(store.status,'saved');
});
test('unconfirmed write retains the latest snapshot for a later retry',async()=>{
  let fail=true;const writes=[];
  const store=new OKProgressStore({send:async(method,args)=>{
    if(method==='VKWebAppStorageGet')return response(null);
    writes.push(JSON.parse(args.value));return {result:!fail};
  }});
  await store.load();store.save(snapshot(['bunny']));await settle();assert.equal(store.status,'error');
  fail=false;store.retry();await settle();assert.equal(store.status,'saved');assert.deepEqual(writes.at(-1).album,['bunny']);
});
test('all documented OK launch platforms select cloud storage; missing query uses launch parameters',async t=>{
  const previous={window:globalThis.window,location:globalThis.location};
  t.after(()=>{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
  for(const name of ['desktop_web_ok','mobile_android_ok','mobile_iphone_ok','mobile_web_ok']){
    globalThis.location={search:`?vk_platform=${name}`};assert.equal(new Platform().cloudProgress,true);
  }
  globalThis.location={search:''};globalThis.window={vkBridge:{isIframe:()=>true,subscribe(){},send:async method=>method==='VKWebAppGetLaunchParams'?{vk_platform:'mobile_iphone_ok'}:{result:true}}};
  const platform=new Platform();await platform.init();assert.equal(platform.cloudProgress,true);
  location.search='?vk_platform=desktop_web';assert.equal(new Platform().cloudProgress,false);
});
