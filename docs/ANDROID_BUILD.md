# Install SuriOS as an Android app

The `preview` profile in [eas.json](../eas.json) builds a signed, installable APK through Expo's EAS Build service. It bundles the app's JavaScript and assets, so the installed app opens without Expo Go or a running development PC. API requests and street-map tiles still require internet access.

## Prepared configuration

| Setting | Value and purpose |
| --- | --- |
| App name | **SuriOS**, shown by the Android launcher |
| Android package | `site.surios.app`, the app's installation identity |
| App/build version | `1.0.0` / `1` |
| Branding | Existing Orie launcher/adaptive icons and orange-on-light splash |
| Build profile | `preview`: internal distribution, release APK, no development client |
| API origin | `https://surios.site`, supplied as public build configuration |
| Signing | EAS-managed Android credentials, configured during the first build |

This checkout is linked to [@auvy/surios-ai-app](https://expo.dev/accounts/auvy/projects/surios-ai-app). The cloud build must finish before an APK exists. Store submission and iOS distribution are separate work. Keep the package identity and signing key consistent for subsequent updates.

## First cloud build

Run inside `surios-ai-app`. Create an account at [expo.dev/signup](https://expo.dev/signup) if needed, then sign in privately in the terminal:

```bash
npx eas-cli@25.3.0 login
npx eas-cli@25.3.0 whoami
```

The project is already linked in `app.json`. If setting up a new, unlinked checkout for another project, link it with:

```bash
npx eas-cli@25.3.0 init
```

Select your account and create or select the SuriOS project. This adds its public project ID to the Expo configuration; commit that identity with the build setup. Do not substitute a made-up project ID.

Start the build:

```bash
npx eas-cli@25.3.0 build --platform android --profile preview
```

For the first build, choose **Generate new keystore** if no SuriOS signing key already exists. EAS stores the signing credentials. Reuse that key for updates. Never commit downloaded signing files or `credentials.json`.

The service compiles Android remotely, so this workflow needs no local JDK, Android SDK, emulator or Android Studio. It requires Expo authentication and available build quota. Source can be built from this checkout without pushing a Git branch. The profile supplies the public Azure origin because ignored local `.env` files are not available to the cloud build.

## Install and open

When EAS reports a successful build, download the APK from its build page into ignored `artifacts/apk/SuriOS.apk`. With the authorized Android phone attached:

```bash
adb install -r artifacts/apk/SuriOS.apk
adb shell am start -n site.surios.app/.MainActivity
```

The launcher should show **SuriOS** and Orie. Sign in using the same website account; Expo Go's local session is separate and is not copied into this installation. No Azure reseed, migration or new server is needed for packaging the current client.

Finish any open Expo Go report before switching test sessions. Check the standalone icon/splash, login, evidence assessment and map dragging on the phone. Confirm that it can reopen with the PC development server stopped. An actual APK build and device checks remain required; `npm run export:android` alone only produces a JavaScript bundle.

For later source changes, build and install another APK using the same package and signing key. Over-the-air updates are not configured. Increase `android.versionCode` for a new distributed build; the profile uses the version committed in `app.json`.

## References

- [Expo: create your first build](https://docs.expo.dev/build/setup/)
- [Expo: build and install APKs](https://docs.expo.dev/build-reference/apk/)
- [Expo: app icons and splash screens](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/)
