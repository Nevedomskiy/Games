import { test,expect } from '@playwright/test';
import { createSession,answer,advance } from '../../kids/engine.js';
const KEY='lapki_ok_progress_v1',LEGACY='lapki-i-kraski.v1';
const URL='/?vk_app_id=54837649&vk_platform=desktop_web_ok';
const legacy={album:['owl'],completedSessions:9,sound:false,lastReward:'owl',session:null};
async function connect(page,server,account='a'){
  await page.exposeFunction('okRequest',async(method,args)=>{
    server.calls.push(method);
    if(method==='VKWebAppInit'){if(server.failInit)throw Error('offline');return {result:true};}
    if(method==='VKWebAppGetLaunchParams')return server.unknownParams?{}:{vk_platform:'mobile_iphone_ok'};
    if(method==='VKWebAppStorageGet'){
      if(server.wait)await server.wait;
      if(server.failRead)throw Error('offline');
      expect(args.keys).toEqual([KEY]);return {keys:[{key:KEY,value:server.data.get(account)||''}]};
    }
    if(method==='VKWebAppStorageSet'){
      if(server.failWrite)throw Error('offline');
      expect(args.key).toBe(KEY);server.data.set(account,args.value);return {result:true};
    }
    throw Error(`Unexpected request: ${method}`);
  });
  await page.addInitScript(({legacy,key})=>{
    localStorage.setItem(key,JSON.stringify(legacy));
    window.mockOK={send:(...args)=>window.okRequest(...args),subscribe:fn=>window.okListener=fn,isIframe:()=>true,isWebView:()=>false};
  },{legacy,key:LEGACY});
  await page.route('**/vendor/vk-bridge.js',route=>route.fulfill({contentType:'application/javascript',body:'window.vkBridge=window.mockOK;'}));
}
const remote=(server,id='a')=>JSON.parse(server.data.get(id)||'null');
const server=()=>({calls:[],data:new Map()});

test('OK puzzle resumes on a second device, keeps accounts and VK browser data separate',async({browser})=>{
  const cloud=server();
  const first=await browser.newContext(),page=await first.newPage();await connect(page,cloud);await page.goto(URL);
  await page.locator('[data-mode="puzzles"]').click();
  await page.locator('[data-piece="0"]').click();await page.locator('[data-slot="0"]').click();
  await expect.poll(()=>remote(cloud)?.session.task.placed).toEqual(['0']);
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),LEGACY)).toEqual(legacy);
  expect(await page.evaluate(()=>localStorage.length)).toBe(1);
  await first.close();
  const second=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),phone=await second.newPage();
  await connect(phone,cloud);await phone.goto(URL);await phone.locator('#play').tap();
  await expect(phone.locator('.filled')).toHaveCount(1);
  await phone.locator('[data-piece="1"]').tap();await phone.locator('[data-slot="1"]').tap();
  await expect.poll(()=>remote(cloud)?.session.task.placed).toEqual(['0','1']);
  await phone.locator('#parents').tap();await expect(phone.locator('#modal')).toContainText('хранилище вашего аккаунта');
  expect(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await second.close();
  const third=await browser.newContext(),other=await third.newPage();await connect(other,cloud,'b');await other.goto(URL);
  await expect(other.locator('#play-label')).toHaveText('Начать играть');await other.locator('#play').click();
  await expect.poll(()=>remote(cloud,'b')?.session.completed).toBe(0);expect(remote(cloud,'b').album).toEqual([]);
  expect(remote(cloud).session.task.placed).toEqual(['0','1']);await third.close();
});
test('delayed cloud load gates play and never flashes the browser album',async({page})=>{
  const cloud=server();let release;cloud.wait=new Promise(done=>release=done);
  cloud.data.set('a',JSON.stringify({session:createSession('colors'),album:['cat'],completedSessions:2,sound:false,lastReward:'cat'}));
  await connect(page,cloud);await page.goto(URL);await expect.poll(()=>cloud.calls.includes('VKWebAppStorageGet')).toBe(true);
  expect(await page.locator('.shell').evaluate(el=>el.inert)).toBe(true);
  expect(cloud.calls.includes('VKWebAppStorageSet')).toBe(false);release();
  await expect(page.locator('#play-label')).toHaveText('Продолжить играть');await page.locator('#play').click();
  await expect.poll(()=>remote(cloud)?.session.mode).toBe('colors');expect(remote(cloud).album).toEqual(['cat']);
});
test('offline reads keep play available without overwriting the cloud, then recover on reconnect',async({page})=>{
  const cloud=server();cloud.failRead=true;
  cloud.data.set('a',JSON.stringify({session:null,album:['cat'],completedSessions:4,sound:false,lastReward:'cat'}));
  await connect(page,cloud);await page.goto(URL);await expect(page.locator('#progress-status')).toContainText('Не удалось');
  await page.locator('[data-mode="puzzles"]').click();await page.locator('[data-piece="0"]').click();await page.locator('[data-slot="0"]').click();
  expect(cloud.calls.includes('VKWebAppStorageSet')).toBe(false);
  cloud.failRead=false;await page.evaluate(()=>dispatchEvent(new Event('online')));
  await expect.poll(()=>remote(cloud)?.session?.task?.placed).toEqual(['0']);expect(remote(cloud).album).toEqual(['cat']);
  await page.reload();await page.locator('#play').click();await expect(page.locator('.filled')).toHaveCount(1);
  await page.locator('#album-button').click();await expect(page.locator('.album-item:not(.waiting)')).toHaveCount(1);
});
test('write rejection is visible, and reconnect retries the latest progress',async({page})=>{
  const cloud=server();cloud.failWrite=true;await connect(page,cloud);await page.goto(URL);
  await page.locator('[data-mode="puzzles"]').click();await page.locator('[data-piece="0"]').click();await page.locator('[data-slot="0"]').click();
  await expect(page.locator('#progress-status')).toContainText('Не удалось');expect(remote(cloud)).toBeNull();
  cloud.failWrite=false;await page.evaluate(()=>dispatchEvent(new Event('online')));
  await expect.poll(()=>remote(cloud)?.session.task.placed).toEqual(['0']);await expect(page.locator('#progress-status')).toContainText('сохранён');
});
test('native OK without query platform is identified through Bridge launch parameters',async({page})=>{
  const cloud=server();await connect(page,cloud);await page.goto('/?vk_app_id=54837649');
  await page.locator('#play').click();await expect.poll(()=>remote(cloud)?.session.mode).toBe('animals');
  expect(remote(cloud).album).toEqual([]);expect(cloud.calls).toContain('VKWebAppGetLaunchParams');
});
test('an unidentified embedded launch does not read a VK album or request cloud writes',async({page})=>{
  const cloud=server();cloud.unknownParams=true;await connect(page,cloud);await page.goto('/?vk_app_id=54837649');
  await expect(page.locator('#progress-status')).toContainText('без сохранения');
  await page.locator('#play').click();await page.locator('[data-choice="bunny"]').click();
  await expect(page.locator('.correct')).toBeVisible();expect(cloud.calls.some(name=>name.startsWith('VKWebAppStorage'))).toBe(false);
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),LEGACY)).toEqual(legacy);
});
test('OK initialization failure does not leak or change VK local progress',async({page})=>{
  const cloud=server();cloud.failInit=true;cloud.failRead=true;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await connect(page,cloud);await page.goto(URL);await page.locator('#play').click();
  await page.locator('[data-choice="bunny"]').click();await expect(page.locator('.correct')).toBeVisible();
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),LEGACY)).toEqual(legacy);expect(errors).toEqual([]);
});
test('a completed cloud walk grants one sticker and does not grant it again after reload',async({page})=>{
  let session=createSession('colors');
  for(let i=0;i<10;i++){session=answer(session,session.task.target).session;if(i<9)session=advance(session);}
  const cloud=server();cloud.data.set('a',JSON.stringify({session,album:[],completedSessions:0,sound:false,lastReward:'bunny'}));
  await connect(page,cloud);await page.goto(URL);await page.locator('#play').click();
  await expect(page.locator('#reward-screen')).toBeVisible();await expect.poll(()=>remote(cloud)?.completedSessions).toBe(1);
  expect(remote(cloud).album).toEqual(['bunny']);expect(remote(cloud).session.rewarded).toBe(true);
  await page.reload();await page.locator('#album-button').click();await expect(page.locator('.album-item:not(.waiting)')).toHaveCount(1);
  expect(remote(cloud).completedSessions).toBe(1);
});
