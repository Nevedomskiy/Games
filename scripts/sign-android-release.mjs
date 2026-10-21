import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Secrets come from a private file outside tracked source. Never print it or the environment.
const configPath=process.env.LAPKI_SIGNING_CONFIG;
if(!configPath)throw new Error('Set LAPKI_SIGNING_CONFIG to a private signing.json file.');
const config=JSON.parse(await readFile(configPath,'utf8'));
for(const name of ['keyStore','keyAlias','storePassword','keyPassword'])if(typeof config[name]!=='string'||!config[name])throw new Error(`Missing signing property: ${name}`);
const root=path.resolve(import.meta.dirname,'..');
const candidate=path.join(root,'artifacts/rustore');
const info=JSON.parse(await readFile(path.join(candidate,'release-info.json'),'utf8'));
if(info.applicationId!=='ru.nevedomskiy.lapki'||info.signed!==false||!/^\d+\.\d+\.\d+$/.test(info.versionName))throw new Error('Expected an unsigned production release candidate.');
const base=`lapki-i-kraski-${info.versionName}`;
const sdk=process.env.ANDROID_HOME,java=process.env.JAVA_HOME;
if(!sdk||!java)throw new Error('Set ANDROID_HOME and JAVA_HOME.');
const buildTools=path.join(sdk,'build-tools',process.env.LAPKI_BUILD_TOOLS||'36.0.0');
const executable=name=>process.platform==='win32'?`${name}.exe`:name;
const apksigner=path.join(buildTools,process.platform==='win32'?'apksigner.bat':'apksigner');
const env={...process.env,LAPKI_STORE_PASSWORD:config.storePassword,LAPKI_KEY_PASSWORD:config.keyPassword};
const run=(file,args)=>{
  try{return execFileSync(file,args,{env,encoding:'utf8',stdio:['ignore','pipe','pipe']});}
  catch{throw new Error(`${path.basename(file)} failed. Inspect the signing inputs locally; secret output was suppressed.`);}
};
const keyStore=path.resolve(path.dirname(configPath),config.keyStore);
const certificate=run(path.join(java,'bin',executable('keytool')),['-exportcert','-rfc','-keystore',keyStore,'-alias',config.keyAlias,'-storepass:env','LAPKI_STORE_PASSWORD']);
const certBytes=Buffer.from(certificate.replace(/-----[^\n]+-----|\s/g,''),'base64');
const certificateSha256=createHash('sha256').update(certBytes).digest('hex');
const out=path.join(root,'docs/store/android');
await mkdir(out,{recursive:true});
let previous;
try {previous=JSON.parse(await readFile(path.join(out,'release-info.json'),'utf8'));}
catch(error){if(error.code!=='ENOENT')throw error;}
if(previous?.certificateSha256&&previous.certificateSha256!==certificateSha256)throw new Error('Signing certificate differs from the prepared release. Preserve the original key for updates.');
const checksums=[];
for(const extension of ['apk','aab']){
  const unsigned=path.join(candidate,`${base}-unsigned.${extension}`);
  const bytes=await readFile(unsigned);
  const expected=(await readFile(path.join(candidate,'SHA256SUMS'),'utf8')).split('\n').find(line=>line.endsWith(`  ${path.basename(unsigned)}`))?.split('  ')[0];
  if(createHash('sha256').update(bytes).digest('hex')!==expected)throw new Error('Candidate checksum mismatch. Rebuild before signing.');
  const filename=`${base}.${extension}`,output=path.join(out,filename);
  if(extension==='apk'){
    run(apksigner,['sign','--ks',keyStore,'--ks-key-alias',config.keyAlias,'--ks-pass','env:LAPKI_STORE_PASSWORD','--key-pass','env:LAPKI_KEY_PASSWORD','--v1-signing-enabled','false','--v2-signing-enabled','true','--v3-signing-enabled','true','--v4-signing-enabled','false','--out',output,unsigned]);
    const verification=run(apksigner,['verify','--verbose','--print-certs',output]);
    if(!verification.includes('Verified using v2 scheme (APK Signature Scheme v2): true')||!verification.includes(`certificate SHA-256 digest: ${certificateSha256}`))throw new Error('APK signature verification mismatch.');
    const badging=run(path.join(buildTools,executable('aapt')),['dump','badging',output]);
    if(!badging.includes("name='ru.nevedomskiy.lapki'")||!badging.includes(`versionCode='${info.versionCode}'`)||!badging.includes(`versionName='${info.versionName}'`)||badging.includes('application-debuggable'))throw new Error('Unexpected production APK metadata.');
    if(run(path.join(buildTools,executable('aapt')),['dump','permissions',output]).includes('android.permission.INTERNET'))throw new Error('Unexpected INTERNET permission.');
  } else {
    run(path.join(java,'bin',executable('jarsigner')),['-keystore',keyStore,'-storepass:env','LAPKI_STORE_PASSWORD','-keypass:env','LAPKI_KEY_PASSWORD','-sigalg','SHA256withRSA','-digestalg','SHA-256','-signedjar',output,unsigned,config.keyAlias]);
    const verification=run(path.join(java,'bin',executable('jarsigner')),['-J-Duser.language=en','-verify',output]);
    if(!verification.includes('jar verified.'))throw new Error('AAB signature verification failed.');
    const bundleCertificate=run(path.join(java,'bin',executable('keytool')),['-printcert','-rfc','-jarfile',output]);
    const bundleCertBytes=Buffer.from(bundleCertificate.match(/-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/)?.[1]?.replace(/\s/g,'')||'','base64');
    if(createHash('sha256').update(bundleCertBytes).digest('hex')!==certificateSha256)throw new Error('AAB and APK use different signing certificates.');
  }
  const signed=await readFile(output);
  checksums.push(`${createHash('sha256').update(signed).digest('hex')}  ${filename}`);
  console.log(`${filename}: signed and verified, ${signed.length} bytes.`);
}
await writeFile(path.join(out,'RELEASE-SHA256SUMS'),checksums.join('\n')+'\n');
await writeFile(path.join(out,`${base}-certificate.pem`),certificate.replace(/\r\n/g,'\n'));
await writeFile(path.join(out,'release-info.json'),JSON.stringify({...info,signed:true,certificateSha256},null,2)+'\n');
console.log(`Public release certificate SHA-256: ${certificateSha256}`);
