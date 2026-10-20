import { readFile,readdir,mkdtemp,rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

// Publish only the built VK game. The current checkout, index and branch stay intact.
// GitHub Pages must separately be enabled by the repository owner in Settings > Pages.
const root=path.resolve(import.meta.dirname,'..'),build=path.join(root,'dist-vk');
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
for(const required of ['index.html','kids/app.js','kids/platform.js','vendor/vk-bridge.js'])if(!files.some(([name])=>name===required))throw new Error(`Missing ${required}. Run npm run build:vk first.`);
if(!files.every(([name])=>name==='index.html'||name.startsWith('kids/')||name.startsWith('vendor/')))throw new Error('Unexpected file in VK build.');
if(!files.find(([name])=>name==='kids/platform.js')[1].equals(await readFile(path.join(root,'platforms/vk/platform.js'))))throw new Error('VK adapter differs from source; rebuild before publication.');
files.push(['.nojekyll',Buffer.alloc(0)]);
files.push(['build-info.json',Buffer.from(JSON.stringify({publisher:'lapki-vk-pages',repository:`${owner}/${repository}`,sourceCommit,platform:'VK',vkApplicationId:54837649},null,2)+'\n')]);
const temporary=await mkdtemp(path.join(os.tmpdir(),'lapki-pages-'));
try{
  const env={...process.env,GIT_INDEX_FILE:path.join(temporary,'index')};
  git(['read-tree','--empty'],{env});
  for(const [name,content] of files){
    const hash=git(['hash-object','-w','--stdin'],{input:content});
    git(['update-index','--add','--cacheinfo','100644',hash,name],{env});
  }
  const tree=git(['write-tree'],{env});
  if(parent&&git(['rev-parse',`${parent}^{tree}`])===tree){console.log('gh-pages already contains this build.');}
  else{
    const commit=git(['commit-tree',tree,...(parent?['-p',parent]:[])],{input:`Publish VK game from ${sourceCommit}\n`});
    // No force push: a concurrent remote update will be rejected instead of overwritten.
    git(['push','origin',`${commit}:${ref}`],{stdio:['pipe','pipe','pipe']});
    console.log(`Published ${files.length} game files to gh-pages: ${commit}`);
  }
  console.log(`Enable Settings > Pages > Deploy from a branch > gh-pages > / (root).`);
  console.log(`Expected site after successful activation: https://${owner.toLowerCase()}.github.io/${repository}/`);
}catch(error){
  // Print the actual Git failure, while never dumping environment or credentials.
  if(error.stderr)process.stderr.write(error.stderr);
  throw error;
}finally{await rm(temporary,{recursive:true,force:true});}
