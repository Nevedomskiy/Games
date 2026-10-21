import { readFile,writeFile,mkdir,copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Keep unsigned candidates separate from the debug downloads and signed store APKs.
// The owner must configure signing before a candidate can become a store release.
const root=path.resolve(import.meta.dirname,'..');
const outputs=path.join(root,'android/app/build/outputs');
const metadata=JSON.parse(await readFile(path.join(outputs,'apk/release/output-metadata.json'),'utf8'));
if(metadata.applicationId!=='ru.nevedomskiy.lapki'||metadata.variantName!=='release'||metadata.elements.length!==1)throw new Error('Expected one production release APK');
const entry=metadata.elements[0],version=entry.versionName;
if(!/^\d+\.\d+\.\d+$/.test(version)||entry.outputFile!=='app-release-unsigned.apk')throw new Error('Expected an unsigned release candidate with a plain version number');
const out=path.join(root,'artifacts/rustore');
await mkdir(out,{recursive:true});
const checksums=[];
for(const [source,extension] of [['apk/release/app-release-unsigned.apk','apk'],['bundle/release/app-release.aab','aab']]){
  const name=`lapki-i-kraski-${version}-unsigned.${extension}`;
  const bytes=await readFile(path.join(outputs,source));
  await copyFile(path.join(outputs,source),path.join(out,name));
  checksums.push(`${createHash('sha256').update(bytes).digest('hex')}  ${name}`);
  console.log(`Prepared ${name}: ${bytes.length} bytes (unsigned; signing still required).`);
}
await writeFile(path.join(out,'SHA256SUMS'),checksums.join('\n')+'\n');
await writeFile(path.join(out,'release-info.json'),JSON.stringify({applicationId:metadata.applicationId,versionName:version,versionCode:entry.versionCode,signed:false,storeApplicationId:2063773439},null,2)+'\n');
