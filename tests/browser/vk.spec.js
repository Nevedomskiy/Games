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
