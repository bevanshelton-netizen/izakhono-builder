# IZAKHONO NAV Android

Native Android wrapper for the IZAKHONO NAV web client.

## Device capabilities

- Android GPS / network location bridge
- Android TextToSpeech bridge
- Android SpeechRecognizer destination input
- Android share sheet
- Screen-awake navigation bridge
- remote-first owned NAV HTTPS origin with a bundled local application-shell fallback
- owned NAV engine remains the only default routing/search/tile provider; external resilience is disabled by default
- native GPS, speech and share bridges are injected into the WebView
- no analytics, advertising IDs or behavioural tracking

## WebView security boundary

- Only HTTPS navigation to `nav.izakhono.africa` and the bundled `file:///android_asset/` shell remain inside the WebView; other destinations are handed to Android.
- JavaScript bridges remain available only in the trusted app shell. File-origin scripts cannot access other local files or cross-origin network resources.
- Safe Browsing is enabled, mixed content remains blocked, and automatic JavaScript window opening is disabled.
- Native geolocation permission is granted only to the exact `https://nav.izakhono.africa` origin. Other origins are denied even when Android location permission has already been granted.

## Build

Requires JDK 17+, Android SDK 36 / Build Tools 36.0.0, Gradle 9.4.1 and Android Gradle Plugin 9.2.0.

```bash
gradle :app:assembleDebug
```

The debug APK is intended for direct sideload testing. Production Play signing is a separate release process.
