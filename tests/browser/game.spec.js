import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const key = 'kotokvartal.v1';
const fullState = () => ({ board: Array.from({ length: 25 }, (_, i) => i % 2 ? 2 : 3), score: 120, turns: 30, next: 1, later: 1, maxLevel: 3, revives: 0 });
async function seedFull(page) {
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify({ state, best: state.score, discovered: state.maxLevel })), { key, state: fullState() });
}
async function mockSDK(page, mode = 'reward', language = 'ru') {
  await page.addInitScript(({ mode, language }) => {
    window.sdkCalls = { ready: 0, start: 0, stop: 0, ads: 0 };
    window.sdkEvents = {};
    window.YaGames = { init: async () => ({
      environment: { i18n: { lang: language } },
      on: (name, handler) => { window.sdkEvents[name] = handler; },
      features: {
        LoadingAPI: { ready: () => window.sdkCalls.ready++ },
        GameplayAPI: { start: () => window.sdkCalls.start++, stop: () => window.sdkCalls.stop++ },
      },
      adv: { showRewardedVideo: ({ callbacks }) => {
        window.sdkCalls.ads++; callbacks.onOpen();
        setTimeout(() => {
          if (mode === 'reward') callbacks.onRewarded();
          if (mode === 'error') callbacks.onError(new Error('no ad'));
          else callbacks.onClose();
        }, 50);
      } },
    }) };
  }, { mode, language });
}

test('desktop: first merge, free undo, persistence and no runtime errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/');
  await expect(page.locator('.cell')).toHaveCount(25);
  await page.locator('[data-index="10"]').click();
  await expect(page.locator('#score')).toHaveText('65');
  await expect(page.locator('.occupied')).toHaveCount(2);
  await expect(page.locator('#merge-message')).toContainText('Новый дом');
  await page.reload();
  await expect(page.locator('#score')).toHaveText('65');
  await page.locator('#undo').click();
  await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('.occupied')).toHaveCount(3);
  await expect(page.locator('#undo')).toBeDisabled();
  await expect(page.locator('#best')).toHaveText('65');
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'artifacts/desktop.png', fullPage: true });
});

test('mobile: touch, instructions, sound, restart and no horizontal overflow', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#help').tap();
  await expect(page.locator('dialog')).toBeVisible();
  await page.locator('[data-action="close"]').tap();
  await page.locator('[data-index="10"]').tap();
  await expect(page.locator('#score')).toHaveText('65');
  await page.locator('#sound').tap();
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#restart').tap();
  await page.locator('[data-action="new"]').tap();
  await expect(page.locator('#score')).toHaveText('0');
  await expect(page.locator('#merge-message')).toHaveCSS('opacity', '0');
  await page.screenshot({ path: 'artifacts/mobile.png', fullPage: true });
  await context.close();
});

test('narrow and landscape viewports keep all 25 cells reachable', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  for (const [width, height] of [[320, 568], [844, 390], [768, 1024]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('[data-index="24"]').click();
    await expect(page.locator('[data-index="24"]')).toHaveClass(/occupied/);
  }
});

test('keyboard navigation places a building', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-index="0"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-index="1"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-index="1"]')).toHaveClass(/occupied/);
});

test('full board shows results and local mode does not pretend to show ads', async ({ page }) => {
  await seedFull(page); await page.goto('/');
  await expect(page.locator('dialog')).toBeVisible();
  await expect(page.locator('[data-action="reward"]')).toBeDisabled();
  await page.locator('[data-action="new"]').click();
  await expect(page.locator('dialog')).not.toBeVisible();
  await expect(page.locator('.empty')).toHaveCount(22);
});

test('real full-board play reaches game over, then undo restores play', async ({ page }) => {
  await page.goto('/');
  for (let i = 0; i < 300; i++) {
    if (await page.locator('dialog').isVisible()) break;
    await page.locator('.empty').first().click();
  }
  await expect(page.locator('dialog')).toBeVisible();
  await expect(page.locator('.empty')).toHaveCount(0);
  await page.locator('[data-action="undo"]').click();
  await expect(page.locator('dialog')).not.toBeVisible();
  await expect(page.locator('#undo')).toBeDisabled();
  expect(await page.locator('.empty').count()).toBeGreaterThan(0);
});

test('SDK readiness, gameplay pauses and English localization', async ({ page }) => {
  await mockSDK(page, 'reward', 'en');
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#next-name')).toHaveText('Little home');
  expect(await page.evaluate(() => window.sdkCalls.ready)).toBe(1);
  await page.locator('[data-index="0"]').click();
  await page.evaluate(() => window.sdkEvents.game_api_pause());
  await page.locator('[data-index="1"]').click();
  await expect(page.locator('[data-index="1"]')).toHaveClass(/empty/);
  await page.evaluate(() => window.sdkEvents.game_api_resume());
  await page.locator('[data-index="1"]').click();
  await expect(page.locator('[data-index="1"]')).toHaveClass(/occupied/);
  expect(await page.evaluate(() => window.sdkCalls.stop)).toBeGreaterThan(0);
});

test('rewarded continuation clears three cells only after onRewarded', async ({ page }) => {
  await mockSDK(page); await seedFull(page); await page.goto('/');
  await page.locator('[data-action="reward"]').click();
  await expect(page.locator('dialog')).not.toBeVisible();
  await expect(page.locator('.empty')).toHaveCount(3);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kotokvartal.v1')).state.revives)).toBe(1);
  expect(await page.evaluate(() => window.sdkCalls.ads)).toBe(1);
});

for (const mode of ['skip', 'error']) {
  test(`no reward for ad ${mode}`, async ({ page }) => {
    await mockSDK(page, mode); await seedFull(page); await page.goto('/');
    await page.locator('[data-action="reward"]').click();
    await expect(page.locator('#toast')).toBeVisible();
    await expect(page.locator('.empty')).toHaveCount(0);
    await expect(page.locator('[data-action="reward"]')).toBeEnabled();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kotokvartal.v1')).state.revives)).toBe(0);
  });
}

test('blocked storage and invalid saves do not prevent gameplay', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }));
  await page.goto('/');
  await page.locator('[data-index="10"]').click();
  await expect(page.locator('#score')).toHaveText('65');
  await expect(page.locator('#toast')).toContainText('Хранилище');
});

test('failed SDK init falls back to an explicitly offline game', async ({ page }) => {
  await page.addInitScript(() => { window.YaGames = { init: () => Promise.reject(new Error('offline')) }; });
  await page.goto('/');
  await expect(page.locator('#platform-status')).toContainText('Автономный');
  await page.locator('[data-index="10"]').click();
  await expect(page.locator('#score')).toHaveText('65');
});

test('self-contained HTML plays without a server or external requests', async ({ page }) => {
  const errors = [];
  const network = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
  // Managed cloud Chromium blocks file:// navigation. Exercise the exact file
  // contents in a blank document instead, without changing browser policies.
  await page.setContent(await readFile(new URL('../../artifacts/kotokvartal-demo.html', import.meta.url), 'utf8'));
  await expect(page.locator('.cell')).toHaveCount(25);
  await page.locator('[data-index="10"]').click();
  await expect(page.locator('#score')).toHaveText('65');
  await page.locator('#undo').click();
  await expect(page.locator('#score')).toHaveText('0');
  expect(errors).toEqual([]);
  expect(network).toEqual([]);
});
