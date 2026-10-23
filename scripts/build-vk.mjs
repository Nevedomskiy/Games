import { cp,copyFile,mkdir,readFile,writeFile,rm,readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..'),target=path.join(root,'dist-vk');
await rm(target,{recursive:true,force:true});
await cp(path.join(root,'dist'),target,{recursive:true});
await mkdir(path.join(target,'vendor'),{recursive:true});
await copyFile(path.join(root,'platforms/vk/platform.js'),path.join(target,'kids/platform.js'));
await copyFile(path.join(root,'platforms/vk/ok-progress.js'),path.join(target,'kids/ok-progress.js'));
await copyFile(path.join(root,'platforms/vk/style.css'),path.join(target,'kids/vk.css'));
await copyFile(path.join(root,'node_modules/@vkontakte/vk-bridge/dist/browser.min.js'),path.join(target,'vendor/vk-bridge.js'));
await copyFile(path.join(root,'node_modules/@vkontakte/vk-bridge/LICENSE'),path.join(target,'vendor/VK-BRIDGE-LICENSE.txt'));
const html=await readFile(path.join(target,'index.html'),'utf8');
// Version every module import, including the adapter, so a cached VK-only
// adapter cannot accidentally read the common browser save during an OK launch.
const modules=(await readdir(path.join(target,'kids'))).filter(name=>name.endsWith('.js')).sort();
const digest=createHash('sha256');
for(const name of modules)digest.update(name).update(await readFile(path.join(target,'kids',name)));
const appVersion=digest.digest('hex').slice(0,12);
for(const name of modules){
  const file=path.join(target,'kids',name),source=await readFile(file,'utf8');
  await writeFile(file,source.replace(/from '(\.\/[^']+\.js)'/g,`from '$1?v=${appVersion}'`));
}
await writeFile(path.join(target,'index.html'),html
  .replace('<link rel="stylesheet" href="./kids/style.css">','<link rel="stylesheet" href="./kids/style.css"><link rel="stylesheet" href="./kids/vk.css">')
  .replace('<script type="module" src="./kids/app.js"></script>',`<script src="./vendor/vk-bridge.js"></script><script type="module" src="./kids/app.js?v=${appVersion}"></script>`));
execFileSync('python3',['-c',`import pathlib,zipfile
root=pathlib.Path(${JSON.stringify(target)})
with zipfile.ZipFile(${JSON.stringify(path.join(root,'artifacts/lapki-i-kraski-vk.zip'))},'w',zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(root.rglob('*')):
        if file.is_file(): archive.write(file,file.relative_to(root))
`],{stdio:'inherit'});
console.log('Built dist-vk/ and artifacts/lapki-i-kraski-vk.zip. VK account, application ID and live testing are still required.');
