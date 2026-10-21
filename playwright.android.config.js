import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',testMatch:'android.spec.js',workers:1,timeout:20000,
  use:{baseURL:'http://127.0.0.1:5177',headless:true,viewport:{width:390,height:844},launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']}},
  webServer:{command:'PORT=5177 node scripts/serve.mjs dist-android',url:'http://127.0.0.1:5177',reuseExistingServer:false,timeout:15000},
});
