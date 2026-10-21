import test from 'node:test';
import assert from 'node:assert/strict';
import { Platform } from '../platforms/android/platform.js';

test('Android lifecycle pauses voice and returns Back to the game before exiting',async()=>{
  const events={},calls=[];
  const platform=new Platform({native:true,app:{addListener:async(name,fn)=>events[name]=fn,exitApp:async()=>calls.push('exit')},voice:{cancel:async()=>calls.push('cancel'),speak:async()=>({spoken:true})}});
  platform.onPause=()=>calls.push('pause');platform.onResume=()=>calls.push('resume');
  await platform.init();await platform.init();
  assert.equal(platform.available,true);assert.equal(Object.keys(events).length,2);
  platform.onBack=()=>true;events.backButton();assert.ok(!calls.includes('exit'));
  platform.onBack=()=>false;events.backButton();assert.ok(calls.includes('exit'));
  platform.playing=true;events.appStateChange({isActive:false});
  assert.equal(platform.playing,false);assert.deepEqual(calls.slice(-2),['cancel','pause']);
  events.appStateChange({isActive:true});assert.equal(calls.at(-1),'resume');
});

test('Android container failures do not block initialization or register browser listeners',async()=>{
  const browser=new Platform({native:false,app:{addListener(){throw new Error('must not be called');}}});
  assert.equal(await browser.init(),'ru');assert.equal(browser.failed,false);
  const broken=new Platform({native:true,app:{addListener:async()=>{throw new Error('transport unavailable');}}});
  assert.equal(await broken.init(),'ru');assert.equal(broken.failed,true);
});
