// Puts our Android pieces into the Capacitor project (run after `npx cap add/sync android`):
// Yandex ads plugin, launcher icons, splash, Yandex Mobile Ads dependency and release signing.
// Safe to run many times.
import { readFileSync, writeFileSync, existsSync, cpSync, mkdirSync } from 'node:fs';

const APP = 'android/app';
const PKG_DIR = `${APP}/src/main/java/ru/anons23/shadows`;
if (!existsSync(PKG_DIR)) throw new Error('No Android project: run `npx cap add android` first');
const YANDEX_ADS = 'com.yandex.android:mobileads:7.6.0';

// 1. plugin + registration
cpSync('android-src/GameAdsPlugin.java', `${PKG_DIR}/GameAdsPlugin.java`);
writeFileSync(`${PKG_DIR}/MainActivity.java`, `package ru.anons23.shadows;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GameAdsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`);

// 2. icons and splash
cpSync('android-src/res', `${APP}/src/main/res`, { recursive: true });
const styles = `${APP}/src/main/res/values/styles.xml`;
let st = readFileSync(styles, 'utf8');
st = st.replace(/@drawable\/splash(?!_)/g, '@drawable/splash_launch');
if (!st.includes('windowSplashScreenBackground')) {
  st = st.replace(/(<style name="AppTheme\.NoActionBarLaunch"[^>]*>)/, '$1\n        <item name="windowSplashScreenBackground">#0D0906</item>');
}
writeFileSync(styles, st);

// 3. gradle: Yandex Mobile Ads + release signing from ../keystore.properties
const gradle = `${APP}/build.gradle`;
let g = readFileSync(gradle, 'utf8');
if (!g.includes('com.yandex.android:mobileads')) g = g.replace(/dependencies\s*\{/, (m) => `${m}\n    implementation '${YANDEX_ADS}'`);
if (!g.includes('// game-signing')) {
  g = g.replace(/buildTypes\s*\{\s*release\s*\{/, (m) => `${m}\n            signingConfig signingConfigs.release`);
  g = g.replace(/(\n\s*)buildTypes\s*\{/, `$1// game-signing
    def ksFile = rootProject.file('../keystore.properties')
    signingConfigs {
        release {
            if (ksFile.exists()) {
                def ks = new Properties()
                ksFile.withInputStream { ks.load(it) }
                storeFile file(ks['storeFile'])
                storePassword ks['storePassword']
                keyAlias ks['keyAlias']
                keyPassword ks['keyPassword']
            }
        }
    }$1buildTypes {`);
}
writeFileSync(gradle, g);
console.log('android setup: GameAds plugin, icons, splash, ' + YANDEX_ADS + ', signing');
