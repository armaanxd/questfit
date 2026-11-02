# QuestFit

Local-first prototype of the QuestFit core loop, packaged as a mobile app with Capacitor.
The campaign is stored on the device (localStorage mirrored to Capacitor Preferences). There is no backend, account, health platform, or payment service.

## Run in the browser

```bash
npm install
npm run dev
```

## Run on an Android phone (USB debugging on, cable connected)

```bash
npm run android   # builds, syncs, installs on the phone
```

Needs Java 21 (`brew install openjdk@21`); Android Studio's bundled Java 25 is too new for Gradle 8.14.

## Run on a phone from the IDE

Requires Xcode (iOS) or Android Studio (Android).

```bash
npm run build && npx cap sync
npx cap open ios       # or: npx cap open android
```

Then press Run in Xcode / Android Studio with your phone connected.

## Tests

```bash
npm test
```
