import { chromium } from '@playwright/test';
import { mkdir,copyFile,readFile } from 'node:fs/promises';
import { spawn,execFileSync } from 'node:child_process';
import path from 'node:path';
import { createSession } from '../kids/engine.js';

const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'docs/store/android/images');
await mkdir(out,{recursive:true});
const port=5178,base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['scripts/serve.mjs','dist-android'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
let browser;
try {
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Android preview did not start')),10000);
    server.stdout.once('data',()=>{clearTimeout(timeout);resolve();});
    server.once('error',error=>{clearTimeout(timeout);reject(error);});
    server.once('exit',code=>{clearTimeout(timeout);reject(new Error(`Preview exited: ${code}`));});
  });
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  const files=['icon-512.png'];
  await copyFile(path.join(root,'docs/store/icon.png'),path.join(out,files[0]));
  const errors=[],external=[];
  for(const [index,mode] of ['home','animals','colors','shapes','puzzles','homes','foods'].entries()){
    const context=await browser.newContext({viewport:{width:540,height:960},deviceScaleFactor:2});
    try {
      const session=mode==='home'?null:createSession(mode,()=>.4);
      await context.addInitScript(session=>{
        localStorage.setItem('lapki-i-kraski.v1',JSON.stringify({session,sound:false}));
      },session);
      await context.route('**/*',route=>{
        if(new URL(route.request().url()).origin!==base){external.push(route.request().url());return route.abort();}
        return route.continue();
      });
      const page=await context.newPage();
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(base);
      await page.locator('[data-mode="animals"]').waitFor();
      if(mode!=='home')await page.locator('#play').click();
      if(mode==='puzzles')for(const piece of ['0','3']){
        await page.locator(`[data-piece="${piece}"]`).click();
        await page.locator(`[data-slot="${piece}"]`).click();
      }
      await page.evaluate(()=>scrollTo(0,0));
      const file=`${String(index+1).padStart(2,'0')}-${mode}-1080x1920.png`;
      await page.screenshot({path:path.join(out,file),animations:'disabled'});
      const png=await readFile(path.join(out,file));
      if(png.readUInt32BE(16)!==1080||png.readUInt32BE(20)!==1920)throw new Error(`Wrong dimensions: ${file}`);
      files.push(file);
    } finally {await context.close();}
  }
  if(errors.length||external.length)throw new Error(JSON.stringify({errors,external}));
  execFileSync('python3',['-c',`import pathlib,sys,zipfile
folder=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(folder.parent/'rustore-images.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for name in sys.argv[2:]: archive.write(folder/name,arcname=name)
with zipfile.ZipFile(folder.parent/'rustore-images.zip') as archive:
    assert archive.testzip() is None and archive.namelist()==sys.argv[2:]
`,out,...files]);
  console.log('Exported icon and seven 1080×1920 PNGs from Android web assets (Chromium; not native-device screenshots).');
} finally {await browser?.close();server.kill('SIGTERM');}
