package ru.anons23.shadows;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.yandex.mobile.ads.common.AdError;
import com.yandex.mobile.ads.common.AdRequestConfiguration;
import com.yandex.mobile.ads.common.AdRequestError;
import com.yandex.mobile.ads.common.ImpressionData;
import com.yandex.mobile.ads.common.MobileAds;
import com.yandex.mobile.ads.interstitial.InterstitialAd;
import com.yandex.mobile.ads.interstitial.InterstitialAdEventListener;
import com.yandex.mobile.ads.interstitial.InterstitialAdLoadListener;
import com.yandex.mobile.ads.interstitial.InterstitialAdLoader;
import com.yandex.mobile.ads.rewarded.Reward;
import com.yandex.mobile.ads.rewarded.RewardedAd;
import com.yandex.mobile.ads.rewarded.RewardedAdEventListener;
import com.yandex.mobile.ads.rewarded.RewardedAdLoadListener;
import com.yandex.mobile.ads.rewarded.RewardedAdLoader;

/** Yandex Mobile Ads for the game: configure(ids), showInterstitial(), showRewarded(). */
@CapacitorPlugin(name = "GameAds")
public class GameAdsPlugin extends Plugin {
    private InterstitialAdLoader interstitialLoader;
    private RewardedAdLoader rewardedLoader;
    private InterstitialAd interstitialAd;
    private RewardedAd rewardedAd;
    private String interstitialId;
    private String rewardedId;

    @Override
    public void load() {
        getActivity().runOnUiThread(() -> {
            MobileAds.initialize(getContext(), () -> { });
            interstitialLoader = new InterstitialAdLoader(getContext());
            interstitialLoader.setAdLoadListener(new InterstitialAdLoadListener() {
                @Override public void onAdLoaded(InterstitialAd ad) { interstitialAd = ad; }
                @Override public void onAdFailedToLoad(AdRequestError error) { interstitialAd = null; }
            });
            rewardedLoader = new RewardedAdLoader(getContext());
            rewardedLoader.setAdLoadListener(new RewardedAdLoadListener() {
                @Override public void onAdLoaded(RewardedAd ad) { rewardedAd = ad; }
                @Override public void onAdFailedToLoad(AdRequestError error) { rewardedAd = null; }
            });
        });
    }

    private void loadInterstitial() {
        if (interstitialId == null || interstitialLoader == null) return;
        interstitialLoader.loadAd(new AdRequestConfiguration.Builder(interstitialId).build());
    }

    private void loadRewarded() {
        if (rewardedId == null || rewardedLoader == null) return;
        rewardedLoader.loadAd(new AdRequestConfiguration.Builder(rewardedId).build());
    }

    @PluginMethod
    public void configure(PluginCall call) {
        interstitialId = call.getString("interstitial");
        rewardedId = call.getString("rewarded");
        getActivity().runOnUiThread(() -> { loadInterstitial(); loadRewarded(); });
        call.resolve();
    }

    @PluginMethod
    public void showInterstitial(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            InterstitialAd ad = interstitialAd;
            if (ad == null) { loadInterstitial(); JSObject r = new JSObject(); r.put("shown", false); call.resolve(r); return; }
            interstitialAd = null;
            ad.setAdEventListener(new InterstitialAdEventListener() {
                @Override public void onAdShown() { }
                @Override public void onAdFailedToShow(AdError adError) { finish(false); }
                @Override public void onAdDismissed() { finish(true); }
                @Override public void onAdClicked() { }
                @Override public void onAdImpression(ImpressionData data) { }
                private void finish(boolean shown) { JSObject r = new JSObject(); r.put("shown", shown); call.resolve(r); loadInterstitial(); }
            });
            ad.show(getActivity());
        });
    }

    @PluginMethod
    public void showRewarded(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            RewardedAd ad = rewardedAd;
            if (ad == null) { loadRewarded(); JSObject r = new JSObject(); r.put("rewarded", false); call.resolve(r); return; }
            rewardedAd = null;
            final boolean[] got = { false };
            ad.setAdEventListener(new RewardedAdEventListener() {
                @Override public void onAdShown() { }
                @Override public void onAdFailedToShow(AdError adError) { finish(); }
                @Override public void onAdDismissed() { finish(); }
                @Override public void onAdClicked() { }
                @Override public void onAdImpression(ImpressionData data) { }
                @Override public void onRewarded(Reward reward) { got[0] = true; }
                private void finish() { JSObject r = new JSObject(); r.put("rewarded", got[0]); call.resolve(r); loadRewarded(); }
            });
            ad.show(getActivity());
        });
    }
}
