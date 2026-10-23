import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',testMatch:['vk.spec.js','ok.spec.js'],workers:1,timeout:20000,
  use:{baseURL:'http://127.0.0.1:5175',headless:true,launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']}},
  webServer:{command:'node scripts/serve.mjs dist-vk',env:{PORT:'5175'},url:'http://127.0.0.1:5175',reuseExistingServer:false,timeout:15000},
});
