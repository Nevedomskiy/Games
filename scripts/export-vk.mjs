import { copyFile } from 'node:fs/promises';
await copyFile(new URL('../artifacts/lapki-i-kraski-vk.zip',import.meta.url),new URL('../vk-games.zip',import.meta.url));
console.log('Updated vk-games.zip for review and downloading. This does not publish or deploy the game.');
