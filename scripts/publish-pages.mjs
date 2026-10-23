import { readFile,readdir,mkdtemp,rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

// Publish either the VK game or the public information site, preserving the other.
// The current checkout, index and branch stay intact.
// GitHub Pages must separately be enabled by the repository owner in Settings > Pages.
const siteOnly=process.argv.includes('--site-only'),dryRun=process.argv.includes('--dry-run');
const root=path.resolve(import.meta.dirname,'..'),build=path.join(root,siteOnly?'dist-site':'dist-vk');
if(siteOnly){
  const {supportEmail}=JSON.parse(await readFile(path.join(root,'site/config.json'),'utf8'));
  if(typeof supportEmail!=='string'||!supportEmail.includes('@'))throw new Error('Public support contact is required.');
}
const git=(args,options={})=>execFileSync('git',args,{cwd:root,encoding:'utf8',...options}).trim();
const sourceCommit=git(['rev-parse','HEAD']);
const remote=git(['remote','get-url','origin']);
const match=remote.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
if(!match)throw new Error('Expected the existing GitHub HTTPS origin. No remote was changed.');
const [,owner,repository]=match;
const ref='refs/heads/gh-pages';
const remoteLine=git(['ls-remote','--heads','origin',ref]);
let parent=null;
if(remoteLine){
  git(['fetch','--no-tags','origin',ref]);parent=git(['rev-parse','FETCH_HEAD']);
  let previous;
  try{previous=JSON.parse(git(['show',`${parent}:build-info.json`],{stdio:['pipe','pipe','pipe']}));}catch{}
  if(previous?.publisher!=='lapki-vk-pages'||previous?.repository!==`${owner}/${repository}`)throw new Error('Existing gh-pages is not managed by this script. Publication stopped to preserve it.');
}
if(siteOnly&&!parent)throw new Error('Publish the VK game first; the information site must preserve the existing game.');
const files=[];
async function collect(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const filename=path.join(directory,entry.name);
    if(entry.isDirectory())await collect(filename);
    else if(entry.isFile())files.push([path.relative(build,filename).split(path.sep).join('/'),await readFile(filename)]);
    else throw new Error('Publication does not allow symlinks or special files.');
  }
}
await collect(build);
if(siteOnly){
  for(const required of ['about/index.html','about/privacy.html','about/style.css','about/assets/icon.png'])if(!files.some(([name])=>name===required))throw new Error(`Missing ${required}. Run npm run build:site first.`);
  if(!files.every(([name])=>/^about\/(index\.html|privacy\.html|style\.css|assets\/[a-z-]+\.(png|svg))$/.test(name)))throw new Error('Unexpected file in public information site.');
  files.push(['about/build-info.json',Buffer.from(JSON.stringify({publisher:'lapki-public-site',sourceCommit,publishedAt:new Date().toISOString()},null,2)+'\n')]);
}else{
  for(const required of ['index.html','kids/app.js','kids/platform.js','vendor/vk-bridge.js'])if(!files.some(([name])=>name===required))throw new Error(`Missing ${required}. Run npm run build:vk first.`);
  if(!files.every(([name])=>name==='index.html'||name.startsWith('kids/')||name.startsWith('vendor/')))throw new Error('Unexpected file in VK build.');
  const unversion=content=>content.toString().replace(/(from '\.\/[^']+\.js)\?v=[a-f0-9]{12}'/g,"$1'");
  for(const name of ['platform.js','ok-progress.js'])if(unversion(files.find(([file])=>file===`kids/${name}`)?.[1]||'')!==await readFile(path.join(root,'platforms/vk',name),'utf8'))throw new Error('VK adapter differs from source; rebuild before publication.');
  files.push(['.nojekyll',Buffer.alloc(0)]);
  files.push(['build-info.json',Buffer.from(JSON.stringify({publisher:'lapki-vk-pages',repository:`${owner}/${repository}`,sourceCommit,platform:'VK',vkApplicationId:54837649},null,2)+'\n')]);
}
const temporary=await mkdtemp(path.join(os.tmpdir(),'lapki-pages-'));
try{
  const env={...process.env,GIT_INDEX_FILE:path.join(temporary,'index')};
  git(parent?['read-tree',parent]:['read-tree','--empty'],{env});
  // Replace only this publisher's own namespace, including files removed from source.
  const managed=siteOnly?['about']:['index.html','kids','vendor','.nojekyll','build-info.json'];
  const oldFiles=git(['ls-files','-z','--',...managed],{env}).split('\0').filter(Boolean);
  for(const name of oldFiles)git(['update-index','--force-remove','--',name],{env});
  for(const [name,content] of files){
    const hash=git(['hash-object','-w','--stdin'],{input:content});
    git(['update-index','--add','--cacheinfo','100644',hash,name],{env});
  }
  const tree=git(['write-tree'],{env});
  if(parent){
    const changed=git(['diff','--name-only',`${parent}^{tree}`,tree]).split('\n').filter(Boolean);
    const allowed=name=>siteOnly?name.startsWith('about/'):['index.html','.nojekyll','build-info.json'].includes(name)||name.startsWith('kids/')||name.startsWith('vendor/');
    if(!changed.every(allowed))throw new Error('Publication would change files outside its managed namespace.');
    console.log(`Verified ${siteOnly?'existing game':'information site'} is preserved. ${changed.length} changed paths.`);
  }
  if(dryRun){console.log(`Dry run: prepared ${files.length} files; no remote changes.`);}
  else if(parent&&git(['rev-parse',`${parent}^{tree}`])===tree){console.log('gh-pages already contains this build.');}
  else{
    const commit=git(['commit-tree',tree,...(parent?['-p',parent]:[])],{input:`Publish ${siteOnly?'information site':'VK game'} from ${sourceCommit}\n`});
    // No force push: a concurrent remote update will be rejected instead of overwritten.
    git(['push','origin',`${commit}:${ref}`],{stdio:['pipe','pipe','pipe']});
    console.log(`Published ${files.length} ${siteOnly?'site':'game'} files to gh-pages: ${commit}`);
  }
  console.log(`Enable Settings > Pages > Deploy from a branch > gh-pages > / (root).`);
  console.log(`Expected site after successful activation: https://${owner.toLowerCase()}.github.io/${repository}/${siteOnly?'about/':''}`);
}catch(error){
  // Print the actual Git failure, while never dumping environment or credentials.
  if(error.stderr)process.stderr.write(error.stderr);
  throw error;
}finally{await rm(temporary,{recursive:true,force:true});}
