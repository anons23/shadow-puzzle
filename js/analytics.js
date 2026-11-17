import { METRIKA_ID } from './config.js';

// Events (create goals with these identifiers in Metrika as "JavaScript-событие"):
// game_open, level_start, level_win, level_quit, hint, daily_start, daily_win, ad_rewarded, ad_interstitial
const LOCAL_KEY = 'shadows.stats';
let ready = false;

function loadMetrika() {
  if (!METRIKA_ID || ready) return;
  ready = true;
  try {
    window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
    window.ym.l = Date.now();
    const s = document.createElement('script');
    s.async = true; s.src = 'https://mc.yandex.ru/metrika/tag.js';
    document.head.appendChild(s);
    window.ym(METRIKA_ID, 'init', { clickmap: false, trackLinks: false, accurateTrackBounce: true, webvisor: false });
  } catch (e) {}
}

function local(name, params) {
  try {
    const s = JSON.parse(localStorage.getItem(LOCAL_KEY)) || { events: {}, levels: {} };
    s.events[name] = (s.events[name] || 0) + 1;
    if (params && params.level) {
      const l = (s.levels[params.level] = s.levels[params.level] || {});
      l[name] = (l[name] || 0) + 1;
    }
    localStorage.setItem(LOCAL_KEY, JSON.stringify(s));
  } catch (e) {}
}

export const Analytics = {
  init(platform) {
    loadMetrika();
    this.event('game_open', { platform });
  },
  event(name, params) {
    local(name, params);
    if (!METRIKA_ID || typeof window.ym !== 'function') return;
    try { window.ym(METRIKA_ID, 'reachGoal', name, params || {}); } catch (e) {}
  },
  progress(maxLevel, streak) {
    if (!METRIKA_ID || typeof window.ym !== 'function') return;
    try { window.ym(METRIKA_ID, 'userParams', { max_level: maxLevel, daily_streak: streak }); } catch (e) {}
  },
  localStats() { try { return JSON.parse(localStorage.getItem(LOCAL_KEY)); } catch (e) { return null; } },
};
