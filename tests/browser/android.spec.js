import { test,expect } from '@playwright/test';
const key='lapki-i-kraski.v1';
const saved=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);

test('Android assets play all six modes without external requests and retain a partial puzzle',async({page,context})=>{
  const errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',route=>{
    if(new URL(route.request().url()).hostname!=='127.0.0.1'){external.push(route.request().url());return route.abort();}
    return route.continue();
  });
  await page.goto('/');await expect(page.locator('[data-mode]')).toHaveCount(6);
  await page.locator('[data-mode="foods"]').scrollIntoViewIfNeeded();await page.locator('[data-mode="foods"]').click();
  await page.locator(`[data-choice="${(await saved(page)).session.task.target}"]`).click();
  await expect.poll(async()=>(await saved(page)).session.status).toBe('playing');
  await page.reload();await page.locator('#play').click();expect((await saved(page)).session.completed).toBe(1);
  await page.locator('#home').click();await page.locator('[data-mode="puzzles"]').click();
  const piece=(await saved(page)).session.task.choices[0];
  await page.locator(`[data-piece="${piece}"]`).click();await page.locator(`[data-slot="${piece}"]`).click();
  await page.reload();await page.locator('#play').click();await expect(page.locator('.puzzle-slot.filled')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'artifacts/android-mobile-web.png',fullPage:true});
  await page.locator('#parents').click();await expect(page.locator('dialog')).toContainText('на этом устройстве');
  await page.locator('#close-modal').click();
  for(const mode of ['animals','colors','shapes','homes']){
    await page.locator('#home').click();await page.locator(`[data-mode="${mode}"]`).click();
    await page.locator(`[data-choice="${(await saved(page)).session.task.target}"]`).click();
    await expect(page.locator('.correct')).toBeVisible();
  }
  expect(errors).toEqual([]);expect(external).toEqual([]);
});
