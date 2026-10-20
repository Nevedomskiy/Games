import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';
import { meadow, shape } from '../kids/art.js';
import { createSession, makeTask, validSession } from '../kids/engine.js';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'docs/store/vk');
const port = 5176, base = `http://127.0.0.1:${port}`;
const files = ['snippet-1120x630.png'];
await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['scripts/serve.mjs', 'dist-vk'], {
  cwd: root, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'],
});
let browser;
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('VK preview did not start')), 10_000);
    server.stdout.once('data', () => { clearTimeout(timeout); resolve(); });
    server.once('error', error => { clearTimeout(timeout); reject(error); });
    server.once('exit', code => { clearTimeout(timeout); reject(new Error(`VK preview exited: ${code}`)); });
  });
  browser = await chromium.launch({
    headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'],
  });
  const cover = await browser.newPage({ viewport: { width: 1120, height: 630 }, deviceScaleFactor: 1 });
  await cover.setContent(`<style>
    *{box-sizing:border-box}body{margin:0;background:#fcf9f0;color:#4c594c;font-family:'Trebuchet MS',Arial,sans-serif}
    .cover{width:1120px;height:630px;position:relative;overflow:hidden;padding:66px 56px}
    .age{font-size:16px;font-weight:bold;letter-spacing:2.1px;color:#7e9270}
    h1{font-size:80px;line-height:1.04;letter-spacing:-3px;margin:32px 0 25px;width:420px}
    em{font-style:normal;color:#bb866b}p{font-size:23px;line-height:1.6;margin:0;width:370px}
    .scene{position:absolute;width:690px;height:410px;right:-24px;top:128px}.scene svg{width:100%;height:100%}
    .tiles{position:absolute;left:56px;bottom:51px;display:flex;gap:12px}
    .tile{width:80px;height:72px;padding:7px;border-radius:19px;background:#edf0e0;border:1px solid #dce2cb}
    .tile:nth-child(2){background:#f5e3d8;border-color:#ecd8c8}.tile:nth-child(3){background:#e9e2f0;border-color:#ddd3e4}
    .tile svg{display:block;width:100%;height:100%}.note{position:absolute;right:56px;bottom:69px;font-size:16px;color:#7f8e76}
  </style><div class="cover"><div class="age">ДЛЯ МАЛЫШЕЙ 2–4 ЛЕТ</div>
  <h1>Лапки<br>и <em>краски</em></h1><p>Шесть занятий<br>для маленьких открытий</p>
  <div class="scene">${meadow()}</div><div class="tiles">
  <div class="tile">${shape('circle', '#97b99f')}</div><div class="tile">${shape('star', '#e4bf69')}</div>
  <div class="tile">${shape('heart', '#d99aab')}</div></div><div class="note">Играем вместе, в своём темпе</div></div>`);
  await cover.screenshot({ path: path.join(out, files[0]) });
  await cover.close();

  const errors = [], external = [];
  for (const mode of ['animals', 'puzzles', 'homes', 'foods']) {
    const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
    try {
      const session = createSession(mode, () => .4);
      if (mode === 'animals') {
        const cat = session.order.indexOf('cat');
        [session.order[0], session.order[cat]] = [session.order[cat], session.order[0]];
        session.task = { ...makeTask(mode, 'cat', () => .4), choices: ['fox', 'cat', 'bunny'] };
      }
      if (!validSession(session)) throw new Error(`Invalid screenshot session: ${mode}`);
      await context.addInitScript(session => {
        localStorage.setItem('lapki-i-kraski.v1', JSON.stringify({ session, sound: false }));
      }, session);
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (!request.url().startsWith(`${base}/`)) external.push(request.url()); });
      await page.goto(base);
      await page.locator('#play').click();
      if (mode === 'puzzles') {
        for (const piece of ['0', '3']) {
          await page.locator(`[data-piece="${piece}"]`).click();
          await page.locator(`[data-slot="${piece}"]`).click();
        }
        if (await page.locator('.puzzle-slot.filled').count() !== 2) throw new Error('Puzzle pieces were not placed');
      }
      if (mode === 'homes') {
        await page.locator('[data-choice="frog"]').click();
        await page.locator('#pair-line:not([hidden])').waitFor();
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      const box = await page.locator('#playground').boundingBox();
      if (!box || box.height > 568) throw new Error(`Playground does not fit the screenshot: ${mode}`);
      // Capture the actual play area at native size; omit the surrounding site header.
      const name = `screenshot-${mode}-1200x600.png`;
      await page.screenshot({ path: path.join(out, name), clip: { x: 0, y: Math.floor(box.y - 16), width: 1200, height: 600 }, animations: 'disabled' });
      files.push(name);
    } finally { await context.close(); }
  }
  if (errors.length || external.length) throw new Error(JSON.stringify({ errors, external }));
  for (const [index, name] of files.entries()) {
    const png = await readFile(path.join(out, name));
    const [width, height] = index === 0 ? [1120, 630] : [1200, 600];
    if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || png.readUInt32BE(16) !== width || png.readUInt32BE(20) !== height) {
      throw new Error(`Invalid PNG: ${name}`);
    }
    console.log(`${name}: ${width}×${height}, ${png.length} bytes`);
  }
  execFileSync('python3', ['-c', `import pathlib,sys,zipfile
folder=pathlib.Path(sys.argv[1])
names=sys.argv[2:]
with zipfile.ZipFile(folder/'vk-images.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for name in names: archive.write(folder/name,arcname=name)
with zipfile.ZipFile(folder/'vk-images.zip') as archive:
    assert archive.namelist()==names and archive.testzip() is None
    for name in names: assert archive.read(name)==(folder/name).read_bytes()
print('vk-images.zip: verified five PNG files at archive root')
`, out, ...files], { stdio: 'inherit' });
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
