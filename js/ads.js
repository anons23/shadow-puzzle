import { AD_UNITS } from './config.js';

// Android: native plugin GameAds (android-src/GameAdsPlugin.java, Yandex Mobile Ads SDK).
// Browser: a 2-second stub so the game flow can be tested without real ads.
function overlay(text, seconds) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'ad-overlay';
    el.innerHTML = '<div class="ad-box"><p class="ad-label">Реклама (заглушка)</p><p class="ad-text"></p></div>';
    const t = el.querySelector('.ad-text');
    document.body.appendChild(el);
    let left = seconds;
    t.textContent = text + ' ' + left;
    const timer = setInterval(() => {
      left--;
      if (left <= 0) { clearInterval(timer); el.remove(); resolve(true); }
      else t.textContent = text + ' ' + left;
    }, 1000);
  });
}

let native = null, configured = false;
function plugin() {
  const c = window.Capacitor;
  if (!c || !c.isNativePlatform || !c.isNativePlatform()) return null;
  if (!native) native = (c.Plugins && c.Plugins.GameAds) || (c.registerPlugin ? c.registerPlugin('GameAds') : null);
  if (native && !configured) { configured = true; native.configure(AD_UNITS).catch(() => { configured = false; }); }
  return native;
}

export const Ads = {
  init() { plugin(); },
  async showRewarded() {
    const p = plugin();
    if (p) { try { return !!(await p.showRewarded()).rewarded; } catch (e) { return false; } }
    return overlay('Награда через', 2);
  },
  async showInterstitial() {
    const p = plugin();
    if (p) { try { return !!(await p.showInterstitial()).shown; } catch (e) { return false; } }
    return overlay('Продолжим через', 2);
  },
};
