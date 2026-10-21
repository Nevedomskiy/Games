import { mkdir,readFile,writeFile,copyFile,rm } from 'node:fs/promises';
import { build } from 'esbuild';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const target=path.join(root,'dist-android');
await rm(target,{recursive:true,force:true});
await mkdir(path.join(target,'kids'),{recursive:true});
const html=await readFile(path.join(root,'index.html'),'utf8');
await writeFile(path.join(target,'index.html'),html.replace('<link rel="stylesheet" href="./kids/style.css">','<link rel="stylesheet" href="./kids/style.css"><link rel="stylesheet" href="./kids/android.css">'));
await copyFile(path.join(root,'kids/style.css'),path.join(target,'kids/style.css'));
await copyFile(path.join(root,'platforms/android/style.css'),path.join(target,'kids/android.css'));
await mkdir(path.join(target,'third-party'),{recursive:true});
for(const name of ['core','android','app'])await copyFile(path.join(root,`node_modules/@capacitor/${name}/LICENSE`),path.join(target,`third-party/capacitor-${name}-LICENSE.txt`));
await build({
  absWorkingDir:root,entryPoints:['kids/app.js'],outfile:path.join(target,'kids/app.js'),bundle:true,format:'esm',target:'chrome89',charset:'utf8',
  plugins:[{name:'android-platform',setup(builder){
    builder.onResolve({filter:/^\.\/platform\.js$/},args=>args.importer===path.join(root,'kids/app.js')?{path:path.join(root,'platforms/android/platform.js')}:undefined);
  }}],
});
// This is a build-specific copy; browser/VK wording stays unchanged.
const file=path.join(target,'kids/app.js');
let js=await readFile(file,'utf8');
if(!js.includes('Альбом сохраняется только в этом браузере.'))throw new Error('Android storage wording was not found');
js=js.replace('Альбом сохраняется только в этом браузере.','Альбом сохраняется на этом устройстве. Удаление приложения удалит прогресс.');
await writeFile(file,js);
console.log('Android web assets built in dist-android/ (all six activities, no ads or purchases).');
