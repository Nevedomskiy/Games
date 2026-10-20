import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { animal } from '../kids/art.js';

const out = path.resolve(import.meta.dirname, '../docs/store/vk');
await mkdir(out, { recursive: true });
// Render the original vector artwork at each platform size, without upscaling PNGs.
const bunny = animal('bunny').replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
const svg = `<svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="512" fill="#dce7c9"/><circle cx="256" cy="266" r="210" fill="#fbf1d9"/><circle cx="419" cy="82" r="29" fill="#edcc7d"/><circle cx="76" cy="386" r="19" fill="#d9a8a0"/><g transform="translate(36 33) scale(1.83)">${bunny}</g></svg>`;
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [name, size] of [['icon-universal-576.png', 576], ['icon-catalog-278.png', 278], ['icon-small-150.png', 150], ['favicon-32.png', 32]]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
    const file = path.join(out, name);
    await page.screenshot({ path: file });
    const png = await readFile(file);
    if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || png.readUInt32BE(16) !== size || png.readUInt32BE(20) !== size) {
      throw new Error(`Invalid PNG dimensions: ${name}`);
    }
    if (size === 32 && png.length > 50_000) throw new Error('Favicon exceeds 50 KB');
    console.log(`${name}: ${size}×${size}, ${png.length} bytes`);
  }
} finally {
  await browser.close();
}
