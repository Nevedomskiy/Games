import { cp,copyFile,mkdir,readFile,writeFile,rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..'),target=path.join(root,'dist-vk');
await rm(target,{recursive:true,force:true});
await cp(path.join(root,'dist'),target,{recursive:true});
await mkdir(path.join(target,'vendor'),{recursive:true});
await copyFile(path.join(root,'platforms/vk/platform.js'),path.join(target,'kids/platform.js'));
await copyFile(path.join(root,'platforms/vk/style.css'),path.join(target,'kids/vk.css'));
await copyFile(path.join(root,'node_modules/@vkontakte/vk-bridge/dist/browser.min.js'),path.join(target,'vendor/vk-bridge.js'));
await copyFile(path.join(root,'node_modules/@vkontakte/vk-bridge/LICENSE'),path.join(target,'vendor/VK-BRIDGE-LICENSE.txt'));
const html=await readFile(path.join(target,'index.html'),'utf8');
await writeFile(path.join(target,'index.html'),html
  .replace('<link rel="stylesheet" href="./kids/style.css">','<link rel="stylesheet" href="./kids/style.css"><link rel="stylesheet" href="./kids/vk.css">')
  .replace('<script type="module" src="./kids/app.js"></script>','<script src="./vendor/vk-bridge.js"></script><script type="module" src="./kids/app.js"></script>'));
execFileSync('python3',['-c',`import pathlib,zipfile
root=pathlib.Path(${JSON.stringify(target)})
with zipfile.ZipFile(${JSON.stringify(path.join(root,'artifacts/lapki-i-kraski-vk.zip'))},'w',zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(root.rglob('*')):
        if file.is_file(): archive.write(file,file.relative_to(root))
`],{stdio:'inherit'});
console.log('Built dist-vk/ and artifacts/lapki-i-kraski-vk.zip. VK account, application ID and live testing are still required.');
