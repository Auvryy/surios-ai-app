# SuriOS Mobile — contributor instructions

- Work in this repository on a dedicated feature/fix branch; keep the web repository separate.
- Use React Native, Expo Router and strict TypeScript. Use native primitives for shared screens.
- Preserve orange branding, accessible touch targets, system light/dark themes and safe areas.
- Keep live data on the existing Azure backend. Do not invent connected accounts, reports or AI results.
- Gemini keys, database credentials and privileged operations belong on the server. EXPO_PUBLIC values are public.
- Never stage local environment files, credentials, node_modules, build output or signing keys.
- Verify changes with npm run check and npm run export:web; validate native bundles when dependencies change.
- Native-device behavior must be tested on a device or emulator before claiming Android/iOS support is verified.
- Do not push unless the user explicitly requests it.
