import { Ads as NativeAds } from './ads.js';

const SAVE_KEY = 'shadows.v2';
let ysdk = null, player = null, inGameplay = false;
let cg = null, cgLive = false; // CrazyGames SDK; cgLive = real ads available

function starsSum(s) { return (s && Array.isArray(s.stars) ? s.stars : []).reduce((a, b) => a + (b || 0), 0); }

// On CrazyGames progress goes through SDK.data: it is tied to the player's CrazyGames account.
function store() { return cg && cg.data ? cg.data : localStorage; }
function readLocal() { try { return JSON.parse(store().getItem(SAVE_KEY)) || null; } catch (e) { return null; } }
function writeLocal(obj) { try { store().setItem(SAVE_KEY, JSON.stringify(obj)); } catch (e) {} }

export const Platform = {
  name: 'web',

  async init() {
    let lang = navigator.language || 'ru';
    if (window.CrazyGames && window.CrazyGames.SDK) {
      try {
        await window.CrazyGames.SDK.init();
        cg = window.CrazyGames.SDK;
        this.name = 'crazygames';
        cgLive = cg.environment === 'crazygames';
        try { cg.game.loadingStart(); } catch (e) {}
      } catch (e) { cg = null; }
    } else if (typeof window.YaGames !== 'undefined') {
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
    try { if (cg) cg.game.loadingStop(); } catch (e) {}
    try { if (ysdk && ysdk.features && ysdk.features.LoadingAPI) ysdk.features.LoadingAPI.ready(); } catch (e) {}
  },

  gameplay(on) {
    if (on === inGameplay) return;
    inGameplay = on;
    try { if (cg) { if (on) cg.game.gameplayStart(); else cg.game.gameplayStop(); } } catch (e) {}
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

  // True on CrazyGames for players with no progress yet: skip the menu and land in level 1.
  get directStart() { return !!cg || !!window.__CG_BUILD; },

  cgAd(type) {
    // Outside crazygames.com (local / disabled, e.g. Basic Launch without ads) rewards are given
    // for free and interstitials are skipped, so no button is left without effect.
    if (!cgLive) return Promise.resolve(type === 'rewarded');
    return new Promise((resolve) => {
      try {
        cg.ad.requestAd(type, {
          adStarted: () => {},
          adFinished: () => resolve(true),
          adError: () => resolve(false),
        });
      } catch (e) { resolve(false); }
    });
  },

  showInterstitial() {
    if (cg || window.__CG_BUILD) return this.cgAd('midgame');
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
    if (cg || window.__CG_BUILD) return this.cgAd('rewarded');
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
