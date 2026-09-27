# IZAKHONO NAV Android

Native Android wrapper for the IZAKHONO NAV web client.

## Device capabilities

- Android GPS / network location bridge
- Android TextToSpeech bridge
- Android SpeechRecognizer destination input
- Android share sheet
- Screen-awake navigation bridge
- local embedded NAV UI
- owned NAV engine remains preferred when reachable
- no analytics, advertising IDs or behavioural tracking

## Build

Requires JDK 17+, Android SDK 36 / Build Tools 36.0.0, Gradle 9.4.1 and Android Gradle Plugin 9.2.0.

```bash
gradle :app:assembleDebug
```

The debug APK is intended for direct sideload testing. Production Play signing is a separate release process.
