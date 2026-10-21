import { test,expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const config=JSON.parse(await readFile(new URL('../../site/config.json',import.meta.url),'utf8'));

test('parents can find support, use the FAQ with a keyboard and read the privacy page',async({page})=>{
  const failures=[],external=[];
  page.on('pageerror',error=>failures.push(error.message));
  page.on('request',request=>{if(!request.url().startsWith('http://127.0.0.1:5179/'))external.push(request.url());});
  await page.goto('/about/index.html');
  await expect(page.getByRole('heading',{level:1})).toContainText('Большие открытия.');
  await expect(page.getByRole('link',{name:'Играть в VK'})).toHaveAttribute('href',config.vkUrl);
  await page.locator('.site-header').getByRole('link',{name:'Поддержка'}).click();
  await expect(page.locator('#support')).toBeInViewport();
  await expect(page.getByRole('link',{name:config.supportEmail})).toHaveAttribute('href',`mailto:${config.supportEmail}`);
  const summary=page.getByText('Куда сохраняются наклейки и прогресс?',{exact:true});
  await summary.focus();await page.keyboard.press('Enter');
  await expect(page.locator('details[open]')).toContainText('Облачной синхронизации');
  await page.getByRole('link',{name:'Конфиденциальность',exact:true}).click();
  await expect(page).toHaveURL(/\/about\/privacy.html$/);
  await expect(page.getByRole('heading',{level:1})).toHaveText('Политика конфиденциальности');
  await expect(page.getByRole('link',{name:config.supportEmail})).toBeVisible();
  await expect(page.locator('main')).toContainText('GitHub Pages');
  await page.getByRole('link',{name:'На страницу игры',exact:false}).click();
  expect(new URL(page.url()).pathname).toBe('/about/');
  await expect(page.getByRole('heading',{level:1})).toContainText('Большие открытия.');
  expect(failures).toEqual([]);expect(external).toEqual([]);
});

test('site and policy fit small phones, tablets and desktop without horizontal scrolling',async({page})=>{
  for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:900});
    for(const name of ['index','privacy']){
      await page.goto(`/about/${name}.html`);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await expect(page.locator('h1')).toBeVisible();
      await page.locator('.site-footer').scrollIntoViewIfNeeded();
      await expect(page.locator('.site-footer')).toBeInViewport();
    }
  }
});

test('public site loads its illustrations and makes no storage or cookie changes',async({page,context})=>{
  const failed=[];
  page.on('response',response=>{if(response.status()>=400)failed.push(response.url());});
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/about/index.html');
  for(const img of await page.locator('img').all()){
    await img.scrollIntoViewIfNeeded();
    await expect.poll(()=>img.evaluate(element=>element.complete&&element.naturalWidth>0)).toBe(true);
  }
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:'artifacts/site-desktop.png',fullPage:true});
  await page.screenshot({path:'artifacts/site-desktop-hero.png'});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'artifacts/site-mobile.png',fullPage:true});
  expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}))).toEqual({local:0,session:0});
  expect(await context.cookies()).toEqual([]);
  expect(failed).toEqual([]);
});
