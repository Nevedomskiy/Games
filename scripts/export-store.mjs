import { chromium } from '@playwright/test';
import { mkdir,writeFile,rm } from 'node:fs/promises';
import { spawn,execFileSync } from 'node:child_process';
import path from 'node:path';
import { animal,shape,meadow } from '../kids/art.js';
import { createSession,makeTask } from '../kids/engine.js';

const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'docs/store'),recording=path.join(root,'artifacts/store-recording');
await mkdir(out,{recursive:true});await rm(recording,{recursive:true,force:true});await mkdir(recording,{recursive:true});
const port=5174,base=`http://127.0.0.1:${port}`,server=spawn(process.execPath,['scripts/serve.mjs','dist'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
let browser;
try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error(`Store preview exited: ${code}`)));});
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const art=await browser.newPage({viewport:{width:512,height:512},deviceScaleFactor:1});
 const inner=svg=>svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
 await art.setContent(`<style>*{box-sizing:border-box}body{margin:0}svg{display:block;width:512px;height:512px}</style><svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="512" fill="#dce7c9"/><circle cx="256" cy="266" r="210" fill="#fbf1d9"/><circle cx="419" cy="82" r="29" fill="#edcc7d"/><circle cx="76" cy="386" r="19" fill="#d9a8a0"/><g transform="translate(36 33) scale(1.83)">${inner(animal('bunny'))}</g></svg>`);
 await art.screenshot({path:path.join(out,'icon.png')});
 await art.setViewportSize({width:800,height:470});
 await art.setContent(`<style>*{box-sizing:border-box}body{margin:0;background:#fcf9f0;font-family:'Trebuchet MS',Arial,sans-serif;color:#4c594c}.cover{width:800px;height:470px;overflow:hidden;position:relative;padding:50px 40px}.age{font-size:13px;font-weight:bold;letter-spacing:2px;color:#7e9270}h1{font-size:60px;line-height:1.02;letter-spacing:-2px;margin:24px 0 18px;width:340px}em{font-style:normal;color:#bb866b}p{font-size:19px;line-height:1.5;margin:0;width:310px}.scene{position:absolute;width:490px;height:300px;right:-38px;top:72px}.scene svg{width:100%;height:100%}.tiles{display:flex;gap:9px;position:absolute;left:40px;bottom:36px}.tile{background:#edf0e0;border:1px solid #dce2cb;border-radius:16px;width:65px;height:59px;padding:5px}.tile:nth-child(2){background:#f5e3d8;border-color:#ecd8c8}.tile:nth-child(3){background:#e9e2f0;border-color:#ddd3e4}.tile svg{width:100%;height:100%}.note{position:absolute;right:34px;bottom:46px;font-size:13px;color:#7f8e76}</style><div class="cover"><div class="age">ДЛЯ МАЛЫШЕЙ 2–4 ЛЕТ</div><h1>Лапки<br>и <em>краски</em></h1><p>Шесть занятий<br>для маленьких открытий</p><div class="scene">${meadow()}</div><div class="tiles"><div class="tile">${shape('circle','#97b99f')}</div><div class="tile">${shape('star','#e4bf69')}</div><div class="tile">${shape('heart','#d99aab')}</div></div><div class="note">Играем вместе, в своём темпе</div></div>`);
 await art.screenshot({path:path.join(out,'cover.png')});await art.close();
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1}),page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('#sound').click();
 for(const mode of ['animals','puzzles','homes','foods']){
  let session=createSession(mode,()=>.4);
  if(mode==='animals'){const i=session.order.indexOf('cat');[session.order[0],session.order[i]]=[session.order[i],session.order[0]];session.task={...makeTask(mode,'cat',()=>.4),choices:['fox','cat','bunny']};}
  await page.addInitScript(({mode,session})=>{if(sessionStorage.getItem('store-shot')===mode)localStorage.setItem('lapki-i-kraski.v1',JSON.stringify({session,sound:false}));},{mode,session});
  await page.evaluate(mode=>sessionStorage.setItem('store-shot',mode),mode);await page.reload();await page.locator('#play').click();
  if(mode==='puzzles')for(const p of ['0','3']){await page.locator(`[data-piece="${p}"]`).click();await page.locator(`[data-slot="${p}"]`).click();}
  if(mode==='homes'){await page.locator('[data-choice="frog"]').click();await page.locator('#pair-line:not([hidden])').waitFor();}
  await page.screenshot({path:path.join(out,`screenshot-${mode}.png`),animations:'disabled'});
 }
 await page.evaluate(()=>{sessionStorage.removeItem('store-shot');localStorage.removeItem('lapki-i-kraski.v1');});await page.reload();
 const client=await context.newCDPSession(page),frames=[],writes=[];
 client.on('Page.screencastFrame',event=>{
  const name=`frame-${String(frames.length).padStart(5,'0')}.jpg`;
  frames.push({name,time:event.metadata.timestamp});writes.push(writeFile(path.join(recording,name),Buffer.from(event.data,'base64')));
  client.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});
 });
 await client.send('Page.startScreencast',{format:'jpeg',quality:85,maxWidth:1280,maxHeight:720,everyNthFrame:1});
 const pause=ms=>page.waitForTimeout(ms);
 await pause(1000);await page.locator('[data-mode="animals"]').click();await pause(1200);await page.locator('[data-choice="bunny"]').click();await pause(1800);
 await page.locator('#home').click();await page.locator('[data-mode="puzzles"]').click();await pause(900);
 for(const p of ['0','1','2','3']){await page.locator(`[data-piece="${p}"]`).click();await pause(200);await page.locator(`[data-slot="${p}"]`).click();await pause(200);}
 await pause(650);await page.locator('#home').click();await page.locator('[data-mode="homes"]').click();await pause(1100);await page.locator('[data-choice="frog"]').click();await pause(650);
 await page.locator('#home').click();await page.locator('[data-mode="foods"]').click();await pause(1100);await page.locator('[data-choice="monkey"]').click();await pause(650);
 await page.locator('#home').click();await pause(800);
 await client.send('Page.stopScreencast');await Promise.all(writes);if(!frames.length)throw new Error('No video frames recorded');
 const concat=frames.map((frame,i)=>`file '${frame.name}'\nduration ${Math.max(.001,(frames[i+1]?.time??frame.time+.8)-frame.time).toFixed(6)}`).join('\n')+`\nfile '${frames.at(-1).name}'\n`;
 await writeFile(path.join(recording,'frames.txt'),concat);
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',path.join(recording,'frames.txt'),'-vf','fps=30,scale=1280:720:flags=lanczos:in_range=pc:out_range=tv,format=yuv420p','-c:v','libx264','-preset','medium','-crf','23','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-movflags','+faststart','-an',path.join(out,'gameplay-horizontal.mp4')],{stdio:'inherit'});
 if(errors.length)throw new Error(errors.join('\n'));
 console.log(`Exported icon, cover, four screenshots and actual gameplay (${frames.length} captured frames).`);
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration,size:stream=codec_name,width,height,pix_fmt','-of','json',path.join(out,'gameplay-horizontal.mp4')],{encoding:'utf8'}));
 const video=probe.streams[0];
 if(video.codec_name!=='h264'||video.width*9!==video.height*16||video.height<400||Number(probe.format.duration)>28||Number(probe.format.size)>100_000_000)throw new Error('Video does not meet the owner-provided console requirements');
 console.log(`MP4 verified: ${video.width}×${video.height}, ${Number(probe.format.duration).toFixed(2)} seconds, ${probe.format.size} bytes; no audio.`);
 await context.close();
}finally{await browser?.close();server.kill('SIGTERM');}
