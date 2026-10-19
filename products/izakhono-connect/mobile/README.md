# IZAKHONO CONNECT — Native Mobile Shell

This directory is the native packaging layer for the shared IZAKHONO CONNECT web application.

## Targets

- Android phones and tablets
- iPhone and iPad
- Shared CONNECT backend and web application
- Native push-notification bridge
- Native camera/microphone permissions for calling
- Deep-link capable application shell

## Architecture

The application UI remains in `../`. Capacitor packages the same application for Android and iOS so messaging, calling, media, authentication and security policy are not forked into separate products.

## Build prerequisites

Install Node.js and the Capacitor CLI, then from this directory:

```bash
npm install
npx cap add android
npx cap add ios
npx cap sync
```

Open the generated projects with Android Studio or Xcode for device testing and signing.

## Activation gates

This scaffold does **not** claim store publication, signed binaries, or active native push delivery. Those require the respective Android/iOS developer accounts, signing credentials, push credentials and real-device testing.

Do not place Supabase service-role keys, TURN secrets, VAPID private keys, APNs credentials or FCM server credentials in the mobile/web client.

## Owned-first rule

CONNECT remains tied to the IZAKHONO-controlled backend and service-plane contracts. External services are fallbacks and must remain replaceable.
