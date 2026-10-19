export class Platform {
  sdk = null;
  playing = false;
  adOpen = false;
  available = false;
  failed = false;
  onPause = () => {};
  onResume = () => {};

  async init() {
    const isPlatform = /(^|\.)yandex\.(ru|com|net)$/.test(location.hostname) || /(^|\.)games\.s3\.yandex\.net$/.test(location.hostname);
    // Local games do not request a third-party SDK. Injected SDKs are supported for platform testing.
    if (!isPlatform && !window.YaGames) return null;
    try {
      if (!window.YaGames) {
        await Promise.race([
          new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = '/sdk.js'; script.onload = resolve; script.onerror = reject; document.head.append(script); }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('SDK loading timeout')), 5000)),
        ]);
      }
      this.sdk = await Promise.race([window.YaGames.init(), new Promise((_, reject) => setTimeout(() => reject(new Error('SDK init timeout')), 5000))]);
      this.available = true;
      this.sdk.on?.('game_api_pause', () => { this.stop(); this.onPause(); });
      this.sdk.on?.('game_api_resume', () => { this.onResume(); });
      return this.sdk.environment?.i18n?.lang;
    } catch { this.failed = true; return null; }
  }

  ready() { this.sdk?.features?.LoadingAPI?.ready(); }
  start() {
    if (this.playing || this.adOpen || document.hidden) return;
    this.playing = true;
    this.sdk?.features?.GameplayAPI?.start();
  }
  stop() {
    if (!this.playing) return;
    this.playing = false;
    this.sdk?.features?.GameplayAPI?.stop();
  }
  reward() {
    if (!this.available || !this.sdk?.adv?.showRewardedVideo || this.adOpen) return Promise.resolve('unavailable');
    this.stop();
    this.adOpen = true;
    this.onPause();
    return new Promise(resolve => {
      let rewarded = false;
      let finished = false;
      const finish = (result) => {
        if (finished) return;
        finished = true;
        this.adOpen = false;
        this.onResume();
        resolve(result);
      };
      try {
        this.sdk.adv.showRewardedVideo({ callbacks: {
          onOpen: () => { this.stop(); this.onPause(); },
          onRewarded: () => { rewarded = true; },
          onClose: () => finish(rewarded ? 'rewarded' : 'skipped'),
          onError: () => finish('unavailable'),
        }});
      } catch { finish('unavailable'); }
    });
  }
}
