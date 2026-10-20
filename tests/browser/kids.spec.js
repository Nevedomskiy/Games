import { test,expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createSession,answer,advance } from '../../kids/engine.js';
import { ACTIVITIES } from '../../kids/data.js';
import { itemArt } from '../../kids/art.js';
const KEY='lapki-i-kraski.v1';
async function state(page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);}
async function chooseCorrect(page){const saved=await state(page);await page.locator(`[data-choice="${saved.session.task.target}"]`).click();}
async function complete(page){
  for(let i=0;i<5;i++){
    await chooseCorrect(page);
    if(i<4)await expect.poll(async()=>{const s=(await state(page)).session;return `${s.status}:${s.completed}`;}).toBe(`playing:${i+1}`);
  }
  await expect(page.locator('#reward-screen')).toBeVisible();
}
function mockPlatform(page){return page.addInitScript(()=>{
  window.sdkCalls={ready:0,start:0,stop:0,ads:0};window.sdkEvents={};
  window.YaGames={init:async()=>({environment:{i18n:{lang:'ru'}},on:(name,fn)=>window.sdkEvents[name]=fn,features:{LoadingAPI:{ready:()=>window.sdkCalls.ready++},GameplayAPI:{start:()=>window.sdkCalls.start++,stop:()=>window.sdkCalls.stop++}},adv:{showRewardedVideo:()=>window.sdkCalls.ads++,showFullscreenAdv:()=>window.sdkCalls.ads++}})};
});}

test('desktop home and task render without errors or external assets',async({page})=>{
  const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().includes('127.0.0.1'))external.push(r.url());});
  await page.setViewportSize({width:1440,height:1000});await page.goto('/');
  await expect(page.locator('[data-mode]')).toHaveCount(3);
  await page.screenshot({path:'artifacts/kids-home.png',fullPage:true});
  await page.locator('#play').click();await expect(page.locator('.choice')).toHaveCount(3);
  await expect(page.locator('#target')).toHaveAttribute('aria-label','Силуэт: Зайчик');
  await expect(page.locator('#target')).toHaveAttribute('data-stage','hidden');
  await page.screenshot({path:'artifacts/kids-desktop.png',fullPage:true});
  expect(errors).toEqual([]);expect(external).toEqual([]);
});
for(const mode of ['animals','colors','shapes'])test(`${mode}: complete five tasks, receive one sticker and replay`,async({page})=>{
  await page.goto('/');await page.locator(`[data-mode="${mode}"]`).click();await complete(page);
  const saved=await state(page);expect(saved.album).toEqual(['bunny']);expect(saved.completedSessions).toBe(1);expect(saved.session.rewarded).toBe(true);
  await page.locator('#again').click();await expect(page.locator('#game-screen')).toBeVisible();expect((await state(page)).session.completed).toBe(0);
});
test('wrong choices give help and never remove progress',async({page})=>{
  await page.goto('/');await page.locator('#play').click();const s=(await state(page)).session;
  const wrong=s.task.choices.find(c=>c!==s.task.target);
  for(let i=0;i<2;i++)await page.locator(`[data-choice="${wrong}"]`).click();
  await expect(page.locator('.gentle-hint')).toHaveAttribute('data-choice',s.task.target);
  expect((await state(page)).session.completed).toBe(0);await chooseCorrect(page);
  await expect(page.locator('.correct')).toBeVisible();expect((await state(page)).session.completed).toBe(1);
});
test('mobile touch, saved progress, navigation and album',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();
  await page.goto('/');await page.locator('[data-mode="colors"]').tap();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const button of await page.locator('.choice').all()){const box=await button.boundingBox();expect(box.width).toBeGreaterThan(80);expect(box.height).toBeGreaterThan(130);}
  await page.screenshot({path:'artifacts/kids-mobile.png',fullPage:true});
  await page.locator(`[data-choice="${(await state(page)).session.task.target}"]`).tap();
  await expect.poll(async()=>(await state(page)).session.status).toBe('playing');
  await page.reload();await page.locator('#play').tap();expect((await state(page)).session.completed).toBe(1);expect((await state(page)).session.mode).toBe('colors');
  await page.locator('#album-button').tap();await expect(page.locator('dialog')).toBeVisible();await page.locator('#close-modal').tap();
  await context.close();
});
for(const [width,height] of [[320,568],[768,1024],[844,390]])test(`viewport ${width}x${height} keeps choices visible and reachable`,async({page})=>{
    await page.setViewportSize({width,height});await page.goto('/');await page.locator('[data-mode="shapes"]').click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await chooseCorrect(page);await expect(page.locator('.correct')).toBeVisible();
});
test('SDK ready, pause blocks taps and feedback; no ads requested',async({page})=>{
  await mockPlatform(page);await page.goto('/');await page.locator('#play').click();
  expect(await page.evaluate(()=>window.sdkCalls.ready)).toBe(1);
  await page.evaluate(()=>window.sdkEvents.game_api_pause());await chooseCorrect(page);expect((await state(page)).session.completed).toBe(0);
  await page.evaluate(()=>window.sdkEvents.game_api_resume());await chooseCorrect(page);
  await page.evaluate(()=>window.sdkEvents.game_api_pause());await expect(page.locator('.correct')).toBeVisible();
  await page.evaluate(()=>window.sdkEvents.game_api_resume());
  await expect.poll(async()=>(await state(page)).session.status).toBe('playing');
  expect(await page.evaluate(()=>window.sdkCalls.ads)).toBe(0);expect(await page.evaluate(()=>window.sdkCalls.stop)).toBeGreaterThan(0);
});
test('speech prompt, repeat and mute are controlled by the user',async({page})=>{
  await page.addInitScript(()=>{
    window.spoken=[];
    Object.defineProperty(window,'speechSynthesis',{value:{cancel(){},getVoices(){return[];},speak(u){window.spoken.push(u.text);}}});
    window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
  });
  await page.goto('/');await page.locator('#play').click();expect(await page.evaluate(()=>window.spoken)).toEqual(['Кто спрятался в тени? Найди зверёнка.']);
  await page.locator('#repeat').click();expect(await page.evaluate(()=>window.spoken.length)).toBe(2);
  await page.locator('#sound').click();await page.locator('#repeat').click();expect(await page.evaluate(()=>window.spoken.length)).toBe(2);
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','false');
});
test('storage unavailable and speech unavailable still allow visual play',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked');}});Object.defineProperty(window,'speechSynthesis',{value:undefined});});
  await page.goto('/');await page.locator('#play').click();await page.getByRole('button',{name:'Зайчик',exact:true}).click();
  await expect(page.locator('.correct')).toBeVisible();await expect(page.locator('#toast')).toContainText('не сохраняет');expect(errors).toEqual([]);
});
test('keyboard can select a task and answer without a pointer',async({page})=>{
  await page.goto('/');await page.locator('#play').focus();await page.keyboard.press('Enter');
  await page.locator('[data-choice="bunny"]').focus();await page.keyboard.press('Enter');await expect(page.locator('.correct')).toBeVisible();
});
test('dialog stops advancement and can be closed with keyboard',async({page})=>{
  await page.goto('/');await page.locator('#play').click();await chooseCorrect(page);await page.locator('#album-button').click();
  await expect(page.locator('dialog')).toBeVisible();
  // Let more than the normal feedback duration pass while the dialog is open.
  await page.waitForTimeout(1800);expect((await state(page)).session.status).toBe('feedback');
  await page.keyboard.press('Escape');await expect.poll(async()=>(await state(page)).session.status).toBe('playing');
});
test('saved final feedback awards a sticker once and survives reload',async({page})=>{
  let s=createSession();for(let i=0;i<5;i++){s=answer(s,s.task.target).session;if(i<4)s=advance(s);}
  await page.addInitScript(({key,s})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({session:s,album:[],completedSessions:0,sound:false}));},{key:KEY,s});
  await page.goto('/');await page.locator('#play').click();await expect(page.locator('#reward-screen')).toBeVisible();expect((await state(page)).completedSessions).toBe(1);
  await page.reload();await page.locator('#album-button').click();await expect(page.locator('.album-item:not(.waiting)')).toHaveCount(1);expect((await state(page)).completedSessions).toBe(1);
});
test('standalone HTML runs with no server or asset requests',async({page})=>{
  const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.setContent(await readFile(new URL('../../artifacts/lapki-i-kraski-demo.html',import.meta.url),'utf8'));
  await page.locator('#play').click();await page.getByRole('button',{name:'Зайчик',exact:true}).click();await expect(page.locator('.correct')).toBeVisible();
  expect(errors).toEqual([]);expect(requests).toEqual([]);
});

test('all animal and shape silhouettes render as a single flat color without facial details',async({page})=>{
  await page.goto('/');
  const examples=['animals','shapes'].flatMap(mode=>ACTIVITIES[mode].items.map(item=>({id:`${mode}:${item.id}`,svg:itemArt(mode,item.id,true)})));
  const rendered=await page.evaluate(async examples=>{
    const result=[];
    for(const example of examples){
      const image=new Image();
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(example.svg);});
      const canvas=document.createElement('canvas');canvas.width=240;canvas.height=220;
      const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
      const pixels=ctx.getImageData(0,0,240,220).data,colors=new Set();let opaque=0;
      for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>250){opaque++;colors.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);}
      result.push({id:example.id,opaque,colors:[...colors]});
    }
    return result;
  },examples);
  for(const example of rendered){
    expect(example.opaque,example.id).toBeGreaterThan(1000);
    expect(example.colors,example.id).toContain('105,120,111');
    // Canvas unpremultiplication at antialiased edges can round a channel by 1.
    // Any facial details or original colors would differ by much more.
    for(const color of example.colors)color.split(',').map(Number).forEach((channel,i)=>expect(Math.abs(channel-[105,120,111][i]),`${example.id}: ${color}`).toBeLessThanOrEqual(1));
  }
});

for(const mode of ['animals','shapes'])test(`${mode}: shadow gives a gentle hint, reveals on success and resets for the next task`,async({page})=>{
  if(mode==='animals')await page.setViewportSize({width:390,height:844});
  await page.goto('/');await page.locator(`[data-mode="${mode}"]`).click();
  await expect(page.locator('#target')).toHaveAttribute('data-kind','shadow');
  await expect(page.locator('.reference-color')).toHaveCSS('opacity','0');
  await page.screenshot({path:`artifacts/kids-${mode==='animals'?'shadow-mobile':'shapes'}.png`,fullPage:true});
  const saved=(await state(page)).session,wrong=saved.task.choices.find(id=>id!==saved.task.target);
  await page.locator(`[data-choice="${wrong}"]`).click();await expect(page.locator('#target')).toHaveAttribute('data-stage','hidden');
  await page.locator(`[data-choice="${wrong}"]`).click();await expect(page.locator('#target')).toHaveAttribute('data-stage','hint');
  await expect(page.locator('.reference-color')).toHaveCSS('opacity','0.6');
  await page.locator(`[data-choice="${saved.task.target}"]`).click();await expect(page.locator('#target')).toHaveAttribute('data-stage','revealed');
  await expect(page.locator('.reference-color')).toHaveCSS('opacity','1');
  await expect.poll(async()=>(await state(page)).session.status).toBe('playing');
  await expect(page.locator('#target')).toHaveAttribute('data-stage','hidden');await expect(page.locator('.reference-color')).toHaveCSS('opacity','0');
});

test('color activity retains its colored reference',async({page})=>{
  await page.goto('/');await page.locator('[data-mode="colors"]').click();
  await expect(page.locator('#target')).toHaveAttribute('data-kind','color');await expect(page.locator('.reference-shadow')).toHaveCount(0);
  await expect(page.locator('#target ellipse').first()).toHaveAttribute('fill','#e97f77');
});
