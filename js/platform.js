import { Ads as NativeAds } from './ads.js';

const SAVE_KEY = 'shadows.v2';
let ysdk = null, player = null, inGameplay = false;

function starsSum(s) { return (s && Array.isArray(s.stars) ? s.stars : []).reduce((a, b) => a + (b || 0), 0); }

function readLocal() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || null; } catch (e) { return null; } }
function writeLocal(obj) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(obj)); } catch (e) {} }

export const Platform = {
  name: 'web',

  async init() {
    let lang = navigator.language || 'ru';
    if (typeof window.YaGames !== 'undefined') {
      try {
        ysdk = await window.YaGames.init();
        this.name = 'yandex';
        lang = (ysdk.environment && ysdk.environment.i18n && ysdk.environment.i18n.lang) || lang;
        try { player = await ysdk.getPlayer({ scopes: false }); } catch (e) { player = null; }
      } catch (e) { ysdk = null; }
    } else if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      this.name = 'android';
      NativeAds.init();
    }
    return lang;
  },

  ready() {
    try { if (ysdk && ysdk.features && ysdk.features.LoadingAPI) ysdk.features.LoadingAPI.ready(); } catch (e) {}
  },

  gameplay(on) {
    if (on === inGameplay) return;
    inGameplay = on;
    try {
      const g = ysdk && ysdk.features && ysdk.features.GameplayAPI;
      if (g) { if (on) g.start(); else g.stop(); }
    } catch (e) {}
  },

  async loadSave(defaults) {
    let best = readLocal();
    if (player) {
      try {
        const d = await player.getData(['save']);
        if (d && d.save && starsSum(d.save) >= starsSum(best)) best = d.save;
      } catch (e) {}
    }
    return Object.assign({}, defaults, best || {});
  },

  writeSave(obj) {
    writeLocal(obj);
    if (player) { try { player.setData({ save: obj }).catch(() => {}); } catch (e) {} }
  },

  showInterstitial() {
    if (!ysdk) return NativeAds.showInterstitial();
    return new Promise((resolve) => {
      try {
        ysdk.adv.showFullscreenAdv({ callbacks: {
          onClose: (shown) => resolve(!!shown),
          onError: () => resolve(false),
          onOffline: () => resolve(false),
        } });
      } catch (e) { resolve(false); }
    });
  },

  showRewarded() {
    if (!ysdk) return NativeAds.showRewarded();
    return new Promise((resolve) => {
      let rewarded = false;
      try {
        ysdk.adv.showRewardedVideo({ callbacks: {
          onRewarded: () => { rewarded = true; },
          onClose: () => resolve(rewarded),
          onError: () => resolve(false),
        } });
      } catch (e) { resolve(false); }
    });
  },
};
