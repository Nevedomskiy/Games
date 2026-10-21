import { mkdir,readFile,writeFile,copyFile,rm } from 'node:fs/promises';
import path from 'node:path';
import { animal,balloon,shape,meadow,puzzlePiece,itemArt } from '../kids/art.js';

const root=path.resolve(import.meta.dirname,'..');
const config=JSON.parse(await readFile(path.join(root,'site/config.json'),'utf8'));
const preview=process.argv.includes('--preview');
const validEmail=typeof config.supportEmail==='string'&&/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(config.supportEmail);
if(!validEmail&&!preview)throw new Error('Set the owner-approved public supportEmail in site/config.json before publishing. Use --preview only for local review.');
const target=path.join(root,'dist-site/about');
await rm(path.join(root,'dist-site'),{recursive:true,force:true});
await mkdir(path.join(target,'assets'),{recursive:true});
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const illustrations={bunny:animal('bunny'),meadow:meadow(),animals:animal('cat'),colors:balloon('#dc9e82'),shapes:shape('star','#d4b969'),puzzles:puzzlePiece('bunny',0),homes:itemArt('homes','frog'),foods:itemArt('foods','monkey')};
for(const [name,svg] of Object.entries(illustrations))await writeFile(path.join(target,'assets',`${name}.svg`),svg);
await copyFile(path.join(root,'docs/store/icon.png'),path.join(target,'assets/icon.png'));
await copyFile(path.join(root,'docs/store/vk/snippet-1120x630.png'),path.join(target,'assets/share.png'));
await copyFile(path.join(root,'site/style.css'),path.join(target,'style.css'));
const support=validEmail?`<a class="email-link" href="mailto:${escape(config.supportEmail)}">${escape(config.supportEmail)}</a>`:'<p class="contact-pending">Контакт поддержки будет добавлен перед публикацией.</p>';
const replacements={SITE_URL:escape(config.siteUrl),VK_URL:escape(config.vkUrl),DEVELOPER:escape(config.developer),UPDATED:escape(config.updated),SUPPORT:support};
for(const filename of ['index.html','privacy.html']){
  let template=await readFile(path.join(root,'site',filename),'utf8');
  template=template.replace(/\{\{([A-Z_]+)\}\}/g,(_,name)=>{
    if(!(name in replacements))throw new Error(`Unknown site placeholder: ${name}`);
    return replacements[name];
  });
  if(template.includes('{{'))throw new Error('Unresolved site placeholder.');
  await writeFile(path.join(target,filename),template);
}
console.log(`Built dist-site/about/ (${validEmail?'public support contact configured':'local preview only; publication blocked'}).`);
