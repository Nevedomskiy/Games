import { chromium } from '@playwright/test';
import { mkdir,rm } from 'node:fs/promises';
import path from 'node:path';
import { animal } from '../kids/art.js';

const root=path.resolve(import.meta.dirname,'..');
const res=path.join(root,'android/app/src/main/res');
const bunny=animal('bunny').replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
const svg=`<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="512" fill="#dce7c9"/><circle cx="256" cy="266" r="210" fill="#fbf1d9"/><g transform="translate(36 33) scale(1.83)">${bunny}</g></svg>`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try {
  const page=await browser.newPage({deviceScaleFactor:1});
  for(const [density,size] of [['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]]){
    const dir=path.join(res,`mipmap-${density}`);await mkdir(dir,{recursive:true});
    await page.setViewportSize({width:size,height:size});
    await page.setContent(`<style>body{margin:0}svg{width:100vw;height:100vh;display:block}</style>${svg}`);
    for(const name of ['ic_launcher','ic_launcher_round'])await page.screenshot({path:path.join(dir,`${name}.png`)});
    await rm(path.join(dir,'ic_launcher_foreground.png'),{force:true});
  }
}finally{await browser.close();}
console.log('Android launcher icons rendered from original game artwork.');
