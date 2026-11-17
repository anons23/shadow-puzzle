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

function plugin() {
  const c = window.Capacitor;
  return c && c.Plugins && c.Plugins.OneTouchAds ? c.Plugins.OneTouchAds : null;
}

export const Ads = {
  async showRewarded() {
    const p = plugin();
    if (p) { try { return !!(await p.showRewarded()).rewarded; } catch (e) { return false; } }
    return overlay('Награда через', 2);
  },
  async showInterstitial() {
    const p = plugin();
    if (p) { try { await p.showInterstitial(); } catch (e) {} return true; }
    return overlay('Продолжим через', 2);
  },
};
