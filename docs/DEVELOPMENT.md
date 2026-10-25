# Development guide

## Arch Linux and Hyprland

Keep your existing Node/npm installation if it satisfies the package engines. Node 24 LTS is recommended; `.nvmrc` is provided for users of nvm. No new system packages are required to begin if Node, npm, Git and a browser already work.

```bash
node --version
npm --version
git --version
npm ci
cp .env.example .env
npm run web
```

Expo prints the development URL, normally localhost:8081. Configure the existing SuriOS backend origin first, then sign in to open `/citizen`. Direct signed-out access is protected. To choose a port explicitly:

```bash
npm run web -- --port 8082
```

Changing the preview port also requires an exact backend CORS allowlist entry. Azure currently allows localhost and 127.0.0.1 on port 8081. If Expo says the app is already running there, reuse that preview instead of starting a duplicate.

The web backend can continue running at localhost:5173; these are separate processes and repositories. Browser responsive mode is useful for layout, navigation and zoom. To verify light-only behavior, set the operating system to dark appearance and confirm that SuriOS remains light. This does not emulate Android hardware or permissions.

## Physical Android device

Install compatible Expo Go on the phone, put phone and PC on the same LAN and run `npm start`. Scan the QR code. A firewall or isolated Wi-Fi network can prevent access. Expo SDK compatibility matters; check `package.json` and https://expo.dev/go.

For a desktop window displaying the actual phone, optionally install `scrcpy` and `android-tools` through pacman, enable USB debugging, authorize the PC and run `scrcpy`. This runs the app on the phone, not on Linux. Neither package is needed for the browser.

USB can also carry the Expo connection when Wi-Fi access is unreliable. With the authorized phone attached, reserve a separate port from the browser preview:

```bash
adb reverse tcp:8083 tcp:8083
npm start -- --localhost --port 8083
```

In another terminal, open the development session on the phone:

```bash
adb shell am start -a android.intent.action.VIEW -d 'exp://127.0.0.1:8083'
scrcpy --no-control
```

`--no-control` mirrors the phone without injecting input, useful on devices that require an additional security setting for remote control. This USB mapping connects to Expo on the PC; API requests still use the configured Azure HTTPS origin. Reload after code updates, but finish or explicitly discard an open report first because composer contents are held in memory.

Expo Go is the development host and keeps its own launcher icon. The configured SuriOS icon, Orie assets and splash screen appear in a separately built SuriOS app. Installing Expo Go or exporting Android JavaScript does not create that APK. The Android package, linked Expo project and `preview` APK profile are configured; signing and the actual build still need to finish. See [Android APK setup](ANDROID_BUILD.md).

A dedicated Expo development build will be needed when adding native dependencies unavailable in Expo Go. The prepared `preview` profile produces a standalone release APK for phone testing; it does not require `expo-dev-client`. EAS cloud builds avoid local Android compilation tools. Local Android builds need the Android SDK and JDK. Native iOS local builds require macOS/Xcode.

## Backend origin

Copy `.env.example` to `.env` to use the existing Azure backend at `https://surios.site`. A local backend on port 5185 is optional. Environment files stay ignored; the template is tracked. An ignored `.env.local` overrides `.env` for local development. Restart Expo after changing configuration and rebuild distributed apps to change bundled configuration. See [authentication setup](AUTHENTICATION.md).

- Azure: use the existing website address and port; HTTP IP addresses work during development, while releases require HTTPS. No additional Azure VM/IP/database is needed.
- Phone accessing a local server: use your PC's reachable LAN IP and bind the server to the LAN interface.
- Browser accessing another origin: backend CORS and authentication rules must permit the development origin.
- Do not assume localhost:5173 works from a phone or that existing web form actions are mobile APIs.

Sign-in, registration, sessions, saved feed/map reads, road lookup, assessment and publication call the configured backend. Missing configuration or unavailable endpoints display an error and preserve retryable input.

## Checks and exports

- `npm run typecheck`: strict TypeScript.
- `npm run lint`: Expo ESLint configuration.
- `npm run check`: both checks.
- `npm run export:web`: static browser build into ignored `dist/`.
- `npm run export:android`: Android JavaScript bundle, not an APK.
- `npx expo-doctor`: Expo dependency/configuration diagnostics.
- `npm test`: complete session, authentication, map and reporting regression suite.
- `npm run test:reporting`: map, draft/upload, geometry and reporting tests; real-backend tests are opt-in (see [REPORTING.md](REPORTING.md)).
- `npm run test:auth`: session/transport and browser authentication tests. See [live test prerequisites](AUTHENTICATION.md#verification) before opting into real-backend tests.

Use a physical Android device for camera, GPS, keyboard, permissions and accessibility checks before shipping those features. Browser checks should include narrow phone and tablet/desktop widths, light-only behavior under both system appearance settings, enlarged text and keyboard navigation. The report composer is connected; browser checks do not replace native permission, hardware or WebView validation.

## Git workflow

Start a new feature from verified current main on the agreed descriptive branch. Keep follow-up fixes on that branch and do not create or switch branches just because a prompt is complete. Follow the user's branch instructions. Commit source and package-lock.json together; never commit `.env`, node_modules, dist, signing keys or local sessions. Run checks before submitting changes. Push only when requested.

## Official references

- https://docs.expo.dev/get-started/set-up-your-environment/
- https://docs.expo.dev/workflow/web/
- https://docs.expo.dev/develop/development-builds/introduction/
- https://docs.expo.dev/build/
- https://reactnative.dev/docs/environment-setup

## Initial dependency audit

The initial SDK 58 install reports five high-severity dependency audit entries involving Expo CLI/code-signing dependencies, `node-forge` and Zod. Some entries are propagation through the same dependency chain. The installed `node-forge` is the latest published version at initialization; npm's suggested automatic fix downgrades Expo to SDK 44 and is not a compatible remediation. Zod is on the version required by the current toolchain; do not force a major override without compatibility testing.

Track upstream fixes and rerun `npm audit` before release. These audit findings remain unresolved; passing Expo Doctor, type checks or bundle exports does not clear them. Current account/feed requests use the existing backend; assessment and publishing use the same backend. See [REPORTING.md](REPORTING.md) for verification limits.
