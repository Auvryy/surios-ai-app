# App branding

SuriOS uses its Orie owl identity for the launcher, Android adaptive/themed icons, splash screen and browser favicon. The regular icon is white on SuriOS orange (`#C93D00`); the splash uses an orange owl on the app's light background (`#FAFAFA`). The app stays light-only even when the operating system uses dark appearance.

## Asset sources

The reference is the existing SuriOS website's `static/orie.png`, copied into [orie-reference.png](../assets/brand/orie-reference.png). [orie-mark.png](../assets/brand/orie-mark.png) is the transparent raster master generated from that reference with the built-in imagegen tool. It is the committed raster master; regenerating platform assets does not call an image-generation service.

The original imagegen output is retained at its native 1254 × 1254 resolution. The exporter uses its alpha silhouette, removes tiny disconnected generation specks, crops to the retained artwork, resizes with the existing Expo image utilities, and applies exact orange/white colors. The four substantial components (brows, body and pupils) are retained. All six platform exports are derived from this one source, including the identical alpha in the adaptive foreground and themed layer. The reference is kept for identity/provenance and is not bundled into the app.

| Asset | Format and purpose |
| --- | --- |
| [icon.png](../assets/images/icon.png) | Opaque 1024 × 1024 PNG; white owl on orange, shared launcher/iOS icon |
| [android-icon-foreground.png](../assets/images/android-icon-foreground.png) | Transparent 1024 × 1024 PNG; centered white owl inside the adaptive-icon safe area |
| [android-icon-background.png](../assets/images/android-icon-background.png) | Opaque 1024 × 1024 PNG; solid `#C93D00` |
| [android-icon-monochrome.png](../assets/images/android-icon-monochrome.png) | Transparent 1024 × 1024 PNG; same owl silhouette for Android's system-tinted themed icon |
| [splash-icon.png](../assets/images/splash-icon.png) | Transparent 1024 × 1024 PNG; orange owl |
| [favicon.png](../assets/images/favicon.png) | 48 × 48 PNG; white owl on orange for browser tabs |

Keep the adaptive foreground and monochrome artwork centered with transparent margins. Android launchers apply different masks and may tint themed icons; the full orange background covers the canvas. Do not add rounded corners to the shared icon itself. See the official [Expo icon guide](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/) and [Android adaptive-icon guidance](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive).

The adaptive owl's visible radius is 295.58 pixels inside a 312.89-pixel safe circle on the 1024-pixel canvas. The splash owl's radius is 497.49 pixels; at the configured width of 176, that is inside Android's 192dp splash mask (558.55-pixel source radius). The checker measures actual alpha pixels, including resampling fringes. See [Android splash guidance](https://developer.android.com/develop/ui/views/launch/splash-screen).

## Master generation prompt

The built-in imagegen tool edited the existing reference with transparency enabled. No separate API key or CLI fallback was used. The prompt was:

```text
Use case: logo-brand. Asset type: production SuriOS mobile application master logo, a flat faithful cleanup of the attached existing Orie owl brand mark. Input image: existing /home/andy/Projects/surios-ai/static/orie.png is the identity reference and edit target. Keep the distinctive exact owl construction: two large round open eyes with circular pupils and tiny round white eye glints, open sweeping curved brow horns, central pointed beak, tall rounded right body outline and the sweeping S-like double-curved left wing/body detail. Preserve its portrait aspect, original topology, open negative spaces, left/right silhouette, recognizable expression and proportions. Remove all gold gradients, shading, textures and photographic effects. Render every piece of ink in one perfectly uniform SuriOS burnt orange #C93D00. All gaps and exterior must be truly transparent alpha, not black or white. Center a large crisp high-resolution logo on a square transparent canvas with generous equal padding so no contour approaches an edge. No words, no letter labels, no separate badge/tile, no shadow, no glow, no extra decoration, no fake checkerboard. Output a clean sharp transparent PNG suitable as the master for small app icons; same existing owl, only flatten the color and clean its edges.
```

## Refresh the assets

Run from the repository root after installing the locked dependencies:

```bash
node scripts/generate-brand-assets.mjs
node scripts/check-brand-assets.mjs
```

The [generator](../scripts/generate-brand-assets.mjs) derives the platform PNGs from the committed master. The [checker](../scripts/check-brand-assets.mjs) validates the resulting assets and their app configuration. Commit the master and all regenerated platform images together. Review the owl at launcher and favicon sizes as well as full resolution, and inspect circular and rounded-square Android masks before accepting a changed master.

To change the artwork, retain the reference and replace the transparent raster master with a reviewed version first. Preserve the recognizable owl face, eyes and ear tufts. Avoid words, gradients, fine lines or background plates inside the master; the generator supplies the colors and background for each platform.

## Platform configuration and rebuilds

[app.json](../app.json) sets the shared icon and web favicon paths, Android adaptive layers and matching orange background. Its `primaryColor: "#C93D00"` also replaces the native template accent with SuriOS orange. The installed `expo-splash-screen` config plugin uses `splash-icon.png`, `imageWidth: 176`, `resizeMode: "contain"` and `backgroundColor: "#FAFAFA"`. These options are supported by the installed SDK 58 plugin in `node_modules/expo-splash-screen/plugin/src/types.ts` and its Android/iOS configuration resolvers. No separate dark splash or appearance option is configured.

Refresh the browser export to publish a changed favicon, and reload the browser if it has cached the old image. Native launcher and splash changes require a new app binary and reinstall; a JavaScript reload or over-the-air update does not update those native resources. See the official [splash-screen plugin documentation](https://docs.expo.dev/versions/latest/sdk/splash-screen/#configuration).

The Android package `site.surios.app`, linked Expo project and EAS `preview` APK profile have produced a signed standalone APK, now installed on Android 16. Android App info displays the expected SuriOS name and orange Orie icon, and cold launch reaches the light onboarding screen. See [ANDROID_BUILD.md](ANDROID_BUILD.md) for build provenance and installation. iOS identity/builds and store submission remain separate distribution work. A local Android release also needs the Android SDK/JDK and can be built with `npx expo run:android --variant release`; iOS native builds require macOS/Xcode. Use an isolated checkout for native generation and keep signing material out of Git.

## Verification and acceptance

After changing images or app configuration, run:

```bash
node scripts/check-brand-assets.mjs
npx expo config --type public
npm run check
npm run export:web
npm run export:android
npx expo-doctor
```

Asset validation and visual previews check the source files, dimensions, transparency, colors and safe margins. Expo config inspection and exports check configuration resolution and packaging. The Android export is a JavaScript bundle, not an APK; none of these checks proves native launcher or splash rendering.

This change also passed an Android prebuild in an ignored disposable project, using a fixture-only package identifier. All 30 generated icon/splash images across Android densities matched the expected resized/composited source pixels; adaptive XML, orange icon/primary colors, light splash and light-only/contain settings were inspected. Source app configuration and package files were unchanged by that prebuild. The installed Expo image fallback writes PNG bytes into generated icon files named `.webp`; the inspection records that toolchain behavior, and no Gradle compilation was performed. The exported web favicon's 16/32/48-pixel entries were decoded and checked for the orange/white artwork. Regenerating the six platform PNGs produced identical file hashes.

Initial standalone Android 16 icon/name and light onboarding checks passed. Full visual acceptance below remains, including the splash transition and other launcher masks. Expo Go and development-client splash screens can differ from the standalone app; use a preview/release build for these checks, as described in the [Expo guide](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/).

- Check the launcher on circular and rounded-square masks, including Android themed icons where supported. The entire owl should remain visible and centered.
- Cold-launch with both light and dark system appearance. Check the light background, orange owl, transition into the app and absence of the Expo placeholder.
- Check the iOS home-screen icon and launch screen when an iOS build is available.
- Check the exported browser favicon at normal tab size.

Branding work is isolated from the concurrent notifications work: it changes assets, asset utilities, `app.json` and this document. Shared README, engineering, architecture and roadmap documents are left to the notifications owner; this document records branding behavior and the outstanding native checks.
