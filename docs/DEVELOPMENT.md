# Development guide

## Arch Linux and Hyprland

Keep your existing Node/npm installation if it satisfies the package engines. Node 24 LTS is recommended; `.nvmrc` is provided for users of nvm. No new system packages are required to begin if Node, npm, Git and a browser already work.

```bash
node --version
npm --version
git --version
npm ci
npm run web
```

Expo prints the development URL, normally localhost:8081. To choose a port explicitly:

```bash
npm run web -- --port 8082
```

The web backend can continue running at localhost:5173; these are separate processes and repositories. Browser responsive mode is useful for layout, navigation, zoom and light/dark checks. It does not emulate Android hardware or permissions.

## Physical Android device

Install compatible Expo Go on the phone, put phone and PC on the same LAN and run `npm start`. Scan the QR code. A firewall or isolated Wi-Fi network can prevent access. Expo SDK compatibility matters; check `package.json` and https://expo.dev/go.

For a desktop window displaying the actual phone, optionally install `scrcpy` and `android-tools` through pacman, enable USB debugging, authorize the PC and run `scrcpy`. This runs the app on the phone, not on Linux. Neither package is needed for the browser.

A dedicated Expo development build will be needed when adding native dependencies unavailable in Expo Go. EAS cloud builds can avoid local Android build tooling; account setup, build profiles and signing will be configured in that phase. Local Android builds need the Android SDK and JDK. Native iOS local builds require macOS/Xcode.

## Future backend origin

Copy `.env.example` to `.env` only when needed. Environment files stay ignored; the template is tracked. Restart Expo after changing configuration and rebuild distributed apps to change bundled configuration.

- Azure: use the real HTTPS backend origin.
- Phone accessing a local server: use your PC's reachable LAN IP and bind the server to the LAN interface.
- Browser accessing another origin: backend CORS and authentication rules must permit the development origin.
- Do not assume localhost:5173 works from a phone or that existing web form actions are mobile APIs.

No API requests are currently made, and an absent API URL does not prevent the starter from running.

## Checks and exports

- `npm run typecheck`: strict TypeScript.
- `npm run lint`: Expo ESLint configuration.
- `npm run check`: both checks.
- `npm run export:web`: static browser build into ignored `dist/`.
- `npm run export:android`: Android JavaScript bundle, not an APK.
- `npx expo-doctor`: Expo dependency/configuration diagnostics.

Use a physical Android device for camera, GPS, keyboard, permissions and accessibility checks before shipping those features. Browser checks should include narrow phone and tablet/desktop widths, both themes, enlarged text and keyboard navigation.

## Git workflow

Use a descriptive feature branch. Commit source and package-lock.json together; never commit `.env`, node_modules, dist, signing keys or local sessions. Run checks before submitting changes. Push only when requested.

## Official references

- https://docs.expo.dev/get-started/set-up-your-environment/
- https://docs.expo.dev/workflow/web/
- https://docs.expo.dev/develop/development-builds/introduction/
- https://docs.expo.dev/build/
- https://reactnative.dev/docs/environment-setup

## Initial dependency audit

The initial SDK 58 install reports five high-severity dependency audit entries involving Expo CLI/code-signing dependencies, `node-forge` and Zod. Some entries are propagation through the same dependency chain. The installed `node-forge` is the latest published version at initialization; npm's suggested automatic fix downgrades Expo to SDK 44 and is not a compatible remediation. Zod is on the version required by the current toolchain; do not force a major override without compatibility testing.

Track upstream fixes and rerun `npm audit` before release. These audit findings remain unresolved; passing Expo Doctor, type checks or bundle exports does not clear them. The current starter makes no authentication, assessment or live backend requests.
