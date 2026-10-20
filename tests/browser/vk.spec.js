import { test,expect } from '@playwright/test';
const KEY='lapki-i-kraski.v1';
const state=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
async function mockVK(page,fail=false){
  await page.addInitScript(fail=>{
    window.vkCalls=[];window.vkListener=null;
    window.mockVK={send:async name=>{window.vkCalls.push(name);if(fail)throw new Error('VK unavailable');return {result:true};},subscribe:fn=>window.vkListener=fn,isWebView:()=>false,isIframe:()=>false};
  },fail);
  await page.route('**/vendor/vk-bridge.js',route=>route.fulfill({contentType:'application/javascript',body:'window.vkBridge=window.mockVK;'}));
}
test('VK build runs locally with the official bundled SDK and no external assets',async({page})=>{
  const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:5175'))external.push(r.url());});
  await page.goto('/');expect(await page.evaluate(()=>typeof window.vkBridge.send)).toBe('function');
  await page.locator('#play').click();await page.locator('[data-choice="bunny"]').click();expect((await state(page)).session.completed).toBe(1);
  expect(errors).toEqual([]);expect(external).toEqual([]);
});
test('VK lifecycle events block taps, pause feedback, resume and never request ads',async({page})=>{
  await mockVK(page);await page.goto('/?vk_app_id=12345');await page.locator('[data-mode="homes"]').click();
  await page.evaluate(()=>window.vkListener({detail:{type:'VKWebAppViewHide'}}));await page.locator('[data-choice="frog"]').click();expect((await state(page)).session.completed).toBe(0);
  await page.evaluate(()=>window.vkListener({detail:{type:'VKWebAppViewRestore'}}));await page.locator('[data-choice="frog"]').click();
  await page.evaluate(()=>window.vkListener({detail:{type:'VKWebAppViewHide'}}));await page.waitForTimeout(1100);expect((await state(page)).session.status).toBe('feedback');
  await page.evaluate(()=>window.vkListener({detail:{type:'VKWebAppViewRestore'}}));await expect.poll(async()=>(await state(page)).session.status).toBe('playing');
  expect(await page.evaluate(()=>window.vkCalls)).toEqual(['VKWebAppInit']);
});
test('VK initialization failure still allows play and reload preserves progress',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await mockVK(page,true);await page.goto('/?vk_app_id=12345');
  await page.locator('#play').click();await page.locator('[data-choice="bunny"]').click();await expect.poll(async()=>(await state(page)).session.status).toBe('playing');
  const saved=(await state(page)).session;await page.reload();await page.locator('#play').click();expect((await state(page)).session.order).toEqual(saved.order);expect((await state(page)).session.completed).toBe(1);expect(errors).toEqual([]);
});
test('VK build remains usable on a phone including puzzles and navigation',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage();
  await mockVK(page);await page.goto('/?vk_app_id=12345');await page.locator('[data-mode="puzzles"]').tap();
  for(const p of ['0','1','2','3']){await page.locator(`[data-piece="${p}"]`).tap();await page.locator(`[data-slot="${p}"]`).tap();}
  expect((await state(page)).session.completed).toBe(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#home').tap();await expect(page.locator('#home-screen')).toBeVisible();await context.close();
});

test('VK build loads modules and preserves a puzzle under the Pages /Games/ path',async({page})=>{
  const {readFile}=await import('node:fs/promises');
  const requested=[],errors=[];page.on('request',r=>requested.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/Games/**',async route=>{
    const pathname=new URL(route.request().url()).pathname;
    const relative=pathname.slice('/Games/'.length)||'index.html';
    const type=relative.endsWith('.html')?'text/html':relative.endsWith('.css')?'text/css':relative.endsWith('.js')?'application/javascript':'application/octet-stream';
    try{await route.fulfill({contentType:type,body:await readFile(new URL(`../../dist-vk/${relative}`,import.meta.url))});}
    catch{await route.fulfill({status:404,body:'Missing project asset'});}
  });
  await page.goto('/Games/');await page.locator('#play').click();await page.locator('[data-choice="bunny"]').click();
  expect((await state(page)).session.completed).toBe(1);
  await page.locator('#home').click();await page.locator('[data-mode="puzzles"]').click();
  await page.locator('[data-piece="0"]').click();await page.locator('[data-slot="0"]').click();
  await page.reload();await page.locator('#play').click();await expect(page.locator('.filled')).toHaveCount(1);
  expect((await state(page)).session.mode).toBe('puzzles');expect(errors).toEqual([]);
  expect(requested.every(url=>new URL(url).pathname.startsWith('/Games/'))).toBe(true);
});

test('VK wide iframe permits wheel scrolling to the lower activities and album',async({page})=>{
  await page.setViewportSize({width:1920,height:1000});
  await mockVK(page);
  await page.route('**/vk-frame-host',route=>route.fulfill({contentType:'text/html',body:`<!doctype html>
    <style>html,body{margin:0;height:100%;overflow:hidden}header{height:50px}iframe{display:block;width:100%;height:calc(100% - 110px);border:0}footer{height:60px}</style>
    <header>Game platform header</header><iframe title="Game" scrolling="no" src="/?vk_app_id=12345"></iframe><footer>Game platform footer</footer>`}));
  await page.goto('/vk-frame-host');
  await page.frameLocator('iframe').locator('#activities .activity-card').first().waitFor();
  const game=page.frames().find(frame=>frame.url().includes('vk_app_id=12345'));
  await page.mouse.move(960,500);await page.mouse.wheel(0,1200);
  await expect.poll(()=>game.evaluate(()=>Math.max(window.scrollY,document.body.scrollTop))).toBeGreaterThan(0);
  const foods=await game.locator('[data-mode="foods"]').boundingBox(),bounds=await page.locator('iframe').boundingBox();
  expect(foods.y).toBeGreaterThanOrEqual(bounds.y);
  expect(foods.y+foods.height).toBeLessThanOrEqual(bounds.y+bounds.height);
  await game.locator('[data-mode="foods"]').click();
  await expect(game.locator('#task-title')).toBeVisible();
  await game.locator('[data-choice="monkey"]').click();
  expect((await game.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY)).session.completed).toBe(1);
  await game.locator('#home').click();
  await page.mouse.move(960,500);await page.mouse.wheel(0,1200);
  await expect.poll(async()=>{const box=await game.locator('#see-album').boundingBox();return box.y+box.height<=bounds.y+bounds.height;}).toBe(true);
  await game.locator('#see-album').click();await expect(game.locator('#modal')).toBeVisible();
  await game.locator('#close-modal').click();await expect(game.locator('#modal')).not.toBeVisible();
});
