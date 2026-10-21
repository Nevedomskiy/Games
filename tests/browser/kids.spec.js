import { test,expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createSession,answer,advance } from '../../kids/engine.js';
import { ACTIVITIES,SESSION_LENGTH } from '../../kids/data.js';
import { itemArt,animal,puzzlePiece } from '../../kids/art.js';
const KEY='lapki-i-kraski.v1';
async function state(page){return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);}
async function chooseCorrect(page){
  const saved=await state(page);
  if(saved.session.mode==='puzzles'){
    for(const p of saved.session.task.choices.filter(p=>!saved.session.task.placed.includes(p))){await page.locator(`[data-piece="${p}"]`).click();await page.locator(`[data-slot="${p}"]`).click();}
  }else await page.locator(`[data-choice="${saved.session.task.target}"]`).click();
}
async function complete(page){
  const seen=[];
  for(let i=0;i<SESSION_LENGTH;i++){
    const current=(await state(page)).session;expect(seen).not.toContain(current.task.target);seen.push(current.task.target);
    if(i===5&&['homes','foods'].includes(current.mode)){await page.reload();await page.locator('#play').click();expect((await state(page)).session.order).toEqual(current.order);expect((await state(page)).session.task.target).toBe(current.task.target);}
    await chooseCorrect(page);
    if(i<SESSION_LENGTH-1)await expect.poll(async()=>{const s=(await state(page)).session;return `${s.status}:${s.completed}`;}).toBe(`playing:${i+1}`);
  }
  await expect(page.locator('#reward-screen')).toBeVisible();
  expect(seen).toHaveLength(10);expect((await state(page)).session.history).toEqual(seen);
}
function mockPlatform(page){return page.addInitScript(()=>{
  window.sdkCalls={ready:0,start:0,stop:0,ads:0};window.sdkEvents={};
  window.YaGames={init:async()=>({environment:{i18n:{lang:'ru'}},on:(name,fn)=>window.sdkEvents[name]=fn,features:{LoadingAPI:{ready:()=>window.sdkCalls.ready++},GameplayAPI:{start:()=>window.sdkCalls.start++,stop:()=>window.sdkCalls.stop++}},adv:{showRewardedVideo:()=>window.sdkCalls.ads++,showFullscreenAdv:()=>window.sdkCalls.ads++}})};
});}

test('desktop home and task render without errors or external assets',async({page})=>{
  const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().includes('127.0.0.1'))external.push(r.url());});
  await page.setViewportSize({width:1440,height:1000});await page.goto('/');
  await expect(page.locator('[data-mode]')).toHaveCount(6);
  await page.screenshot({path:'artifacts/kids-home.png',fullPage:true});
  await page.locator('#play').click();await expect(page.locator('.choice')).toHaveCount(3);
  await expect(page.locator('#target')).toHaveAttribute('aria-label','Силуэт: Зайчик');
  await expect(page.locator('#target')).toHaveAttribute('data-stage','hidden');
  await page.screenshot({path:'artifacts/kids-desktop.png',fullPage:true});
  expect(errors).toEqual([]);expect(external).toEqual([]);
});
for(const mode of ['animals','colors','shapes'])test(`${mode}: complete ten unique tasks, receive one sticker and replay`,async({page})=>{
  test.setTimeout(35000);
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
async function mockLongFeedbackVoice(page){
  await page.clock.install();
  await page.addInitScript(()=>{
    window.voiceLog=[];window.currentUtterance=null;
    window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
    Object.defineProperty(window,'speechSynthesis',{value:{
      getVoices(){return[{lang:'ru-RU',localService:true}];},
      cancel(){if(window.currentUtterance){window.voiceLog.push({event:'cancel',text:window.currentUtterance.text});window.currentUtterance.onerror?.({error:'canceled'});window.currentUtterance=null;}},
      speak(utterance){window.currentUtterance=utterance;window.voiceLog.push({event:'speak',text:utterance.text});},
    }});
    window.finishVoice=error=>{const utterance=window.currentUtterance;window.currentUtterance=null;window.voiceLog.push({event:error?'error':'end',text:utterance?.text});if(error)utterance?.onerror?.({error});else utterance?.onend?.();};
  });
}
test('voice feedback: colors wait for the spoken answer before starting the next task',async({page})=>{
  await mockLongFeedbackVoice(page);await page.goto('/');await page.locator('[data-mode="colors"]').click();
  const target=(await state(page)).session.task.target;
  await page.evaluate(()=>window.previousQuestion=window.currentUtterance);
  await chooseCorrect(page);
  // A late callback from the canceled question must not finish the answer.
  await page.evaluate(()=>window.previousQuestion.onend?.());await page.clock.runFor(2500);
  expect((await state(page)).session.status).toBe('feedback');
  expect((await state(page)).session.task.target).toBe(target);
  expect(await page.evaluate(()=>window.voiceLog.filter(event=>event.event==='speak').length)).toBe(2);
  await page.evaluate(()=>window.finishVoice());await page.clock.runFor(100);
  expect((await state(page)).session.status).toBe('playing');
  expect((await state(page)).session.task.target).not.toBe(target);
  expect(await page.evaluate(()=>window.voiceLog.filter(event=>event.event==='speak').length)).toBe(3);
});
test('voice feedback: a short answer still leaves time to see the correct color',async({page})=>{
  await mockLongFeedbackVoice(page);await page.goto('/');await page.locator('[data-mode="colors"]').click();await chooseCorrect(page);
  await page.evaluate(()=>window.finishVoice());await page.clock.runFor(700);
  expect((await state(page)).session.status).toBe('feedback');
  await page.clock.runFor(1100);expect((await state(page)).session.status).toBe('playing');
});
for(const recovery of ['error','mute','timeout'])test(`voice feedback: ${recovery} never leaves the next task blocked`,async({page})=>{
  await mockLongFeedbackVoice(page);await page.goto('/');await page.locator('[data-mode="colors"]').click();await chooseCorrect(page);
  await page.clock.runFor(2000);expect((await state(page)).session.status).toBe('feedback');
  if(recovery==='error')await page.evaluate(()=>window.finishVoice('synthesis-failed'));
  if(recovery==='mute')await page.locator('#sound').click();
  await page.clock.runFor(recovery==='timeout'?8200:100);
  expect((await state(page)).session.status).toBe('playing');expect((await state(page)).session.completed).toBe(1);
  if(recovery==='mute')expect(await page.evaluate(()=>window.voiceLog.filter(event=>event.event==='speak').length)).toBe(2);
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
  let s=createSession();for(let i=0;i<SESSION_LENGTH;i++){s=answer(s,s.task.target).session;if(i<SESSION_LENGTH-1)s=advance(s);}
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
      const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,240,220);
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

for(const mode of ['puzzles','homes','foods'])test(`${mode}: full new activity saves progress and awards one sticker`,async({page})=>{
  // Ten puzzles require 80 real pointer actions plus feedback animations.
  test.setTimeout(mode==='puzzles'?150000:45000);
  await page.goto('/');await page.locator(`[data-mode="${mode}"]`).click();
  await page.screenshot({path:`artifacts/kids-${mode}.png`,fullPage:true});
  await complete(page);const saved=await state(page);expect(saved.completedSessions).toBe(1);expect(saved.album).toEqual(['bunny']);
  await page.locator('#again').click();expect((await state(page)).session.completed).toBe(0);
});

test('animal-home and animal-food matching draws a connection and explains the pair',async({page})=>{
  for(const [mode,answerText] of [['homes','Пруд'],['foods','Банан']]){
    await page.goto('/');await page.locator(`[data-mode="${mode}"]`).click();
    await expect(page.locator('#target')).toHaveAttribute('data-kind','color');
    await page.getByRole('button',{name:answerText,exact:true}).click();
    await expect(page.locator('#pair-line')).toBeVisible();await expect(page.locator('#pair-line path')).toHaveAttribute('d',/^M/);
    await expect(page.locator('#feedback')).toContainText(mode==='homes'?'пруда':'бананом');
    await page.locator('#home').click();
  }
});

test('mobile puzzle: wrong slot, hint, partial save and touch completion',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();
  await page.goto('/');await page.locator('[data-mode="puzzles"]').tap();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('[data-piece="0"]').tap();await page.locator('[data-slot="1"]').tap();await page.locator('[data-slot="1"]').tap();
  await expect(page.locator('[data-slot="0"]')).toHaveClass(/gentle-hint/);
  expect((await state(page)).session.completed).toBe(0);
  await page.locator('[data-slot="0"]').tap();await expect(page.locator('.filled')).toHaveCount(1);
  await page.screenshot({path:'artifacts/kids-puzzle-mobile.png',fullPage:true});
  await page.reload();await page.locator('#play').tap();await expect(page.locator('.filled')).toHaveCount(1);
  for(const p of ['1','2','3']){await page.locator(`[data-piece="${p}"]`).tap();await page.locator(`[data-slot="${p}"]`).tap();}
  await expect(page.locator('.filled')).toHaveCount(4);expect((await state(page)).session.completed).toBe(1);
  await page.locator('#home').tap();await page.locator('[data-mode="homes"]').tap();await page.getByRole('button',{name:'Пруд',exact:true}).tap();await expect(page.locator('#pair-line')).toBeVisible();
  await page.locator('#home').tap();await page.locator('[data-mode="foods"]').tap();await page.getByRole('button',{name:'Банан',exact:true}).tap();await expect(page.locator('#pair-line')).toBeVisible();
  await context.close();
});

test('cat and fox have different outlines and puzzle quarters reconstruct the original picture',async({page})=>{
  await page.goto('/');
  const result=await page.evaluate(async data=>{
    async function image(svg){const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);});return img;}
    function canvas(){const c=document.createElement('canvas');c.width=240;c.height=220;return c;}
    const masks=[];
    for(const svg of data.shadows){const c=canvas(),ctx=c.getContext('2d');ctx.drawImage(await image(svg),0,0,240,220);masks.push(ctx.getImageData(0,0,240,220).data);}
    let union=0,intersection=0;
    for(let i=3;i<masks[0].length;i+=4){const a=masks[0][i]>128,b=masks[1][i]>128;if(a||b)union++;if(a&&b)intersection++;}
    const whole=canvas(),pieces=canvas();whole.getContext('2d').drawImage(await image(data.whole),0,0,240,220);
    for(let i=0;i<4;i++)pieces.getContext('2d').drawImage(await image(data.pieces[i]),i%2*120,Math.floor(i/2)*110,120,110);
    const a=whole.getContext('2d').getImageData(0,0,240,220).data,b=pieces.getContext('2d').getImageData(0,0,240,220).data;
    // Chrome rasterizes the same curves slightly differently in separate SVG
    // viewports. Compare image error and coverage, not exact antialiased bytes.
    let error=0,pictureUnion=0,pictureIntersection=0;
    for(let i=0;i<a.length;i++)error+=Math.abs(a[i]-b[i]);
    for(let i=3;i<a.length;i+=4){const x=a[i]>128,y=b[i]>128;if(x||y)pictureUnion++;if(x&&y)pictureIntersection++;}
    return{iou:intersection/union,meanError:error/a.length,pictureIou:pictureIntersection/pictureUnion};
  },{shadows:[itemArt('animals','cat',true),itemArt('animals','fox',true)],whole:animal('bunny'),pieces:[0,1,2,3].map(p=>puzzlePiece('bunny',String(p)))});
  expect(result.iou).toBeLessThan(.65);expect(result.meanError).toBeLessThan(.1);expect(result.pictureIou).toBeGreaterThan(.995);
});

test('updated cat and fox are visible together in the shadow game',async({page})=>{
  const s=createSession('animals');const i=s.order.indexOf('cat');[s.order[0],s.order[i]]=[s.order[i],s.order[0]];s.task={...s.task,target:'cat',choices:['cat','fox','bunny']};
  await page.addInitScript(({key,s})=>localStorage.setItem(key,JSON.stringify({session:s,sound:false})),{key:KEY,s});
  await page.goto('/');await page.locator('#play').click();
  await page.screenshot({path:'artifacts/kids-animals.png',fullPage:true});
  await page.locator('[data-choice="cat"]').click();await expect(page.locator('.correct')).toBeVisible();
});

test('new modes also run from the standalone export without external requests',async({page})=>{
  const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.setContent(await readFile(new URL('../../artifacts/lapki-i-kraski-demo.html',import.meta.url),'utf8'));
  await page.locator('[data-mode="puzzles"]').click();await page.locator('[data-piece="0"]').click();await page.locator('[data-slot="0"]').click();await expect(page.locator('.filled')).toHaveCount(1);
  await page.locator('#home').click();await page.locator('[data-mode="homes"]').click();await page.getByRole('button',{name:'Пруд',exact:true}).click();await expect(page.locator('#pair-line')).toBeVisible();
  await page.locator('#home').click();await page.locator('[data-mode="foods"]').click();await page.getByRole('button',{name:'Банан',exact:true}).click();await expect(page.locator('#pair-line')).toBeVisible();
  expect(errors).toEqual([]);expect(requests).toEqual([]);
});

for(const mode of ['homes','foods'])test(`${mode}: next question arrives promptly after a correct answer`,async({page})=>{
  await page.goto('/');await page.locator(`[data-mode="${mode}"]`).click();
  const start=await page.evaluate(()=>performance.now());await chooseCorrect(page);
  await expect(page.locator('#pair-line')).toBeVisible();
  await expect.poll(async()=>(await state(page)).session.status,{timeout:2000,intervals:[50,100,100]}).toBe('playing');
  const elapsed=await page.evaluate(()=>performance.now())-start;
  expect(elapsed).toBeGreaterThan(700);expect(elapsed).toBeLessThan(2000);
  expect((await state(page)).session.completed).toBe(1);
});

test('a legacy save upgrades in the browser without losing album, settings or puzzle progress',async({page})=>{
  const s=createSession('puzzles');delete s.order;s.version=1;s.completed=1;s.history=['cat'];s.task.placed=['0'];s.task.selected='2';
  await page.addInitScript(({key,s})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify({session:s,album:['bunny','cat'],completedSessions:2,sound:false}));},{key:KEY,s});
  await page.goto('/');await page.locator('#play').click();await expect(page.locator('.filled')).toHaveCount(1);
  const saved=await state(page);expect(saved.session.version).toBe(2);expect(saved.session.order).toHaveLength(10);expect(saved.session.task.selected).toBe('2');expect(saved.album).toEqual(['bunny','cat']);expect(saved.completedSessions).toBe(2);expect(saved.sound).toBe(false);
  await page.reload();await page.locator('#play').click();expect((await state(page)).session.order).toEqual(saved.session.order);
});

test('all expanded animal, home and food illustrations render distinct visible pictures',async({page})=>{
  await page.goto('/');
  const groups={animals:[...new Set(['animals','homes','foods'].flatMap(mode=>ACTIVITIES[mode].items.map(i=>i.id)))].map(id=>({id,label:Object.values(ACTIVITIES).flatMap(a=>a.items).find(i=>i.id===id).label,svg:animal(id)})),homes:ACTIVITIES.homes.items.map(i=>({id:i.id,label:i.answerLabel,svg:itemArt('homes',i.id)})),foods:ACTIVITIES.foods.items.map(i=>({id:i.id,label:i.answerLabel,svg:itemArt('foods',i.id)}))};
  for(const examples of Object.values(groups)){
    const signatures=await page.evaluate(async examples=>{
      const rendered=[];
      for(const example of examples){
        const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(example.svg);});
        const canvas=document.createElement('canvas');canvas.width=240;canvas.height=220;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,0,240,220).data;let opaque=0,hash=2166136261;
        for(let i=0;i<pixels.length;i++){hash=Math.imul(hash^pixels[i],16777619)>>>0;if(i%4===3&&pixels[i]>250)opaque++;}
        rendered.push({id:example.id,opaque,hash});
      }
      return rendered;
    },examples);
    for(const illustration of signatures)expect(illustration.opaque,illustration.id).toBeGreaterThan(1000);
    expect(new Set(signatures.map(i=>i.hash)).size).toBe(examples.length);
  }
  await page.setContent(`<style>body{font:16px sans-serif;background:#fbf8ee;margin:24px}.group{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}.tile{text-align:center;background:white;border-radius:16px;padding:12px}.tile svg{display:block;width:140px;height:130px;margin:auto}h2{margin-top:24px}</style>${Object.entries(groups).map(([name,examples])=>`<h2>${{animals:'Наши зверята',homes:'Домики',foods:'Угощения'}[name]}</h2><div class="group">${examples.map(i=>`<div class="tile">${i.svg}${i.label}</div>`).join('')}</div>`).join('')}`);
  await page.setViewportSize({width:1200,height:900});await page.screenshot({path:'artifacts/expanded-catalog.png',fullPage:true});
});
