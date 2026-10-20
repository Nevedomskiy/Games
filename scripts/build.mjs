import { mkdir, copyFile, readdir, rm, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
await rm(path.join(root, 'dist'), { recursive: true, force: true });
await mkdir(path.join(root, 'dist/kids'), { recursive: true });
await mkdir(path.join(root, 'artifacts'), { recursive: true });
await copyFile(path.join(root, 'index.html'), path.join(root, 'dist/index.html'));
for (const file of await readdir(path.join(root, 'kids'))) {
  if (/\.(js|css)$/.test(file)) await copyFile(path.join(root, 'kids', file), path.join(root, 'dist/kids', file));
}
// Standard-library ZIP creation: no bundler, runtime packages or CDN assets.
execFileSync('python3', ['-c', `import pathlib, zipfile
root = pathlib.Path(${JSON.stringify(path.join(root, 'dist'))})
with zipfile.ZipFile(${JSON.stringify(path.join(root, 'artifacts/lapki-i-kraski.zip'))}, 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(root.rglob('*')):
        if file.is_file(): archive.write(file, file.relative_to(root))
`], { stdio: 'inherit' });
// A downloadable offline demo for a first playtest, without Node or a web server.
// These fixed modules have unique top-level names; the normal platform build keeps native ESM.
const order = ['kids/data.js', 'kids/engine.js', 'kids/art.js', 'kids/platform.js', 'kids/app.js'];
const demoScript = (await Promise.all(order.map(file => readFile(path.join(root, file), 'utf8'))))
  .map(source => source.replace(/^import .+ from .+;\n/gm, '').replace(/^export /gm, ''))
  .join('\n');
const css = await readFile(path.join(root, 'kids/style.css'), 'utf8');
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const demo = html.replace('<link rel="stylesheet" href="./kids/style.css">', () => `<style>${css}</style>`)
  .replace('<script type="module" src="./kids/app.js"></script>', () => `<script type="module">${demoScript.replace(/<\/script/gi, '<\\/script')}</script>`);
await writeFile(path.join(root, 'artifacts/lapki-i-kraski-demo.html'), demo);
console.log('Built dist/, artifacts/lapki-i-kraski.zip and artifacts/lapki-i-kraski-demo.html');
