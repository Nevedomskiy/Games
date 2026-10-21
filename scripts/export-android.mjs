import { readFile,writeFile,mkdir,copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const source=path.join(root,'android/app/build/outputs/apk/debug/app-debug.apk');
const out=path.join(root,'docs/store/android');
await mkdir(out,{recursive:true});
const metadata=JSON.parse(await readFile(path.join(root,'android/app/build/outputs/apk/debug/output-metadata.json'),'utf8'));
if(metadata.applicationId!=='ru.nevedomskiy.lapki.test'||metadata.variantName!=='debug')throw new Error('Expected the Android test build');
const version=metadata.elements[0].versionName.replace(/-test$/,'');
if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error('Unexpected test version');
const name=`lapki-i-kraski-android-test-${version}.apk`;
const bytes=await readFile(source);
await copyFile(source,path.join(out,name));
await writeFile(path.join(out,'SHA256SUMS'),`${createHash('sha256').update(bytes).digest('hex')}  ${name}\n`);
console.log(`Exported ${name}: ${bytes.length} bytes. Debug test build; not for store submission.`);
