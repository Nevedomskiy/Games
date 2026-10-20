import { copyFile } from 'node:fs/promises';
// Explicit publication step: normal installation/build never rewrites this tracked export.
await copyFile(new URL('../artifacts/lapki-i-kraski-demo.html', import.meta.url), new URL('../demo.html', import.meta.url));
console.log('Updated demo.html for downloading from GitHub. Review before committing.');
