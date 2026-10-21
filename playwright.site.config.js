import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',testMatch:'site.spec.js',workers:1,timeout:20000,
  use:{baseURL:'http://127.0.0.1:5179',headless:true,launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']}},
  webServer:{command:'PORT=5179 node scripts/serve.mjs dist-site',url:'http://127.0.0.1:5179/about/index.html',reuseExistingServer:false,timeout:15000},
});
