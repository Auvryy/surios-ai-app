# SuriOS — Mobile Infrastructure Reporting

**UN SDG 9: Industry, Innovation and Infrastructure**
*A dedicated React Native companion to the SuriOS community infrastructure platform.*

---

## 1. Overview

**SuriOS** takes its name from the Tagalog word *suri*: to inspect and analyze. The platform helps communities document public infrastructure defects and follow accountable government responses, starting in Santa Cruz, Laguna.

This repository contains the **mobile client**, built with **React Native, Expo, Expo Router and TypeScript**. The [SuriOS web repository](https://github.com/Auvryy/surios-ai) remains responsible for the SvelteKit website, Azure backend, PostgreSQL database and server-side Gemini assessment.

### Current status

The mobile client now connects **account authentication and a read-only community feed** to the existing SuriOS backend. Field reporting remains a later phase.

- Three first-run introduction slides, persistent completion, and registration/sign-in interface with SuriOS orange branding.
- Citizen feed (`/home` and `/citizen`) and About (`/about`) screens are available.
- Orange light-only appearance regardless of the device theme, safe-area layout and responsive browser preview.
- Citizen feed shell with bottom navigation, an elevated center camera/post button, map and updates previews, and a clearly labeled report-composer preview.
- File-based navigation and a missing-page screen.
- Strict TypeScript, linting, reproducible npm lockfile and web/Android bundle commands.
- Optional public API-origin configuration, ready for the integration phase.
- Real citizen registration and sign-in with the same accounts as the website; government/admin accounts can sign in, with pending/rejected applications held at their approval screen.
- Native session tokens in Expo SecureStore, browser-preview tokens in tab-scoped sessionStorage, server-validated restoration, expiry handling and logout.
- Saved citizen posts and official updates, photo previews, cumulative pagination, refresh/retry and links to the website's original posts and resolution evidence.

**First run:** intro completion is stored locally on the device. New users see three introduction slides; the last step and Skip open registration. A valid restored session opens the citizen feed. Otherwise returning users see sign-in. Successful citizen registration creates an active account without requiring email delivery.

**Not implemented yet:** native uploads, camera/GPS, live hazard map, report assessment/publication, in-app thread discussions, reactions, reposting and profile editing. Full posts, discussions and official resolution evidence currently open on the website. The report composer remains a labeled preview and does not publish. Launcher icons remain Expo placeholders. Azure bearer API login/session/feed/logout were verified at `https://surios.site`; browser-preview access requires its allowlist configuration. Real-device authentication/storage execution still requires device validation; browser tests and bundle exports do not prove it.

### Planned reporting scope

Road pavement; bridges and footbridges; drainage and flood canals; streetlights and utility poles; water pipes and hydrants; telecom and fiber cables. Reporting is broader than roads. AI should distinguish visible evidence from reporter claims and support qualified human inspection rather than replace it.

## 2. Documentation index

| Document | Purpose |
| :--- | :--- |
| [Development guide](docs/DEVELOPMENT.md) | Arch Linux setup, browser and phone testing, environment variables and checks |
| [Architecture](docs/ARCHITECTURE.md) | Mobile/web/backend responsibilities, data flow and security boundaries |
| [Roadmap](docs/ROADMAP.md) | Ordered implementation phases and acceptance criteria |
| [Authentication](docs/AUTHENTICATION.md) | Shared account flow, session storage, Azure/local setup, failures and tests |
| [Agent quick reference](AGENTS.md) | Seven operating rules, workspace isolation and user-managed branch workflow |
| [Engineering constitution](GEMINI.md) | Full mobile stack, code, security, UI, assessment and Git instructions |

## 3. Quickstart — lightweight browser development

Use **Node.js LTS** (Node 24 recommended; see `.nvmrc`), npm, Git and your existing browser. Android Studio, an emulator, a JDK and global Expo CLI installation are **not required for browser preview**.

```bash
npm ci
cp .env.example .env
npm run web
```

Open the URL printed by Expo, normally **http://localhost:8081**. Use browser responsive mode for a phone-sized viewport. This previews React Native Web; native camera, GPS and permission behavior still needs a phone or emulator.

The template targets a local SuriOS backend at **http://127.0.0.1:5185**. Start that backend separately or edit the public origin to your existing Azure website address before starting Expo. The browser origin must be allowed by the backend. Sign in to open **http://localhost:8081/citizen**; direct signed-out visits are protected. See the [authentication setup](docs/AUTHENTICATION.md).

For the first clone:

```bash
git clone git@github.com:Auvryy/surios-ai-app.git
cd surios-ai-app
```

### Android phone preview

Install Expo Go on your phone, connect it to the same network as your PC, then:

```bash
npm start
```

Scan the QR code. Your installed Expo Go must support this project's Expo SDK (see `package.json`). If versions differ, use a compatible Expo Go version or a development build. Native dependencies outside Expo Go require a development build.

Optional phone mirroring on Arch Linux:

```bash
sudo pacman -S --needed scrcpy android-tools
```

Enable USB debugging, connect and authorize your phone, then run `scrcpy`. These packages can be installed later; they are unnecessary for browser work.

## 4. Technology stack

| Technology | Purpose | Why it fits |
| :--- | :--- | :--- |
| React Native | Dedicated Android/iOS interface | Native interface components with shared mobile code |
| Expo | Development server, device tooling and future builds | Lightweight browser/phone workflow; cloud builds available later |
| Expo Router | File-based navigation and deep-link foundation | Keeps routes explicit across mobile and web preview |
| TypeScript | Static type checking | Makes screen and future API contracts easier to maintain |
| React Native Web | Browser development preview | Enables layout iteration without an Android emulator |
| React Native StyleSheet | Layout and semantic theme tokens | Minimal styling dependencies and consistent orange branding |
| Expo SecureStore | Persistent native session credential storage | Uses the platform's encrypted storage; tokens are not stored in AsyncStorage |
| Existing SvelteKit backend on Azure | Authenticated JSON API access | Reuses business rules and the existing deployment |
| Existing PostgreSQL + Drizzle | Shared persistence through the backend | One authoritative dataset for web and mobile |
| Existing server-side Gemini integration | Future evidence-grounded assessment | AI credentials and assessment rules stay on the server |

The app now calls the existing account and feed APIs. PostgreSQL and Gemini remain behind that backend; assessment integration is still planned. Mobile navigation components are separate from the website's Svelte components.

## 5. Configuration and security

Copy `.env.example` to ignored `.env` and set the public origin of the **same website server**, without `/api`:

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://your-surios-domain.example
```

This is a placeholder, not a deployed endpoint. An existing Azure IP plus its actual website port also works during development; no new server/IP/database is required. `EXPO_PUBLIC_` values are public and bundled into the client. Never include Gemini keys, database URLs, passwords or session secrets. Release builds require HTTPS. Restart Expo after changing the origin.

A phone's `localhost` points to the phone, not your development PC. See the development guide before connecting to a local backend. Browser previews require the backend's exact `API_ALLOWED_ORIGINS` allowlist; native bearer requests need no synthetic Origin or browser cookie. The backend contract is [MOBILE_API.md in the web repository](https://github.com/Auvryy/surios-ai/blob/main/docs/MOBILE_API.md).

## 6. Validation

```bash
npm run check
npm run export:web
npm run export:android
npx expo-doctor
npm run test:auth
```

Android export verifies the JavaScript bundle; it does **not** produce an APK or prove native-device behavior. Native builds, signing, store submission and EAS project setup are not configured yet.

## 7. Repository layout

```text
src/
  app/                 Entry gate, onboarding, auth, citizen feed/Home, About routes
  components/          Shared React Native UI, citizen navigation and report-composer preview
  config/              Public environment configuration
  auth/                Account contracts, session controller/provider and platform-specific token storage
  lib/                 JSON transport and feed contracts
  constants/           Orange theme and onboarding preference key
assets/                Template launcher assets; branding replacement pending
docs/                  Development, architecture and roadmap
```

## 8. SDG 9 connection

The intended mobile workflow makes it easier to document defects in the field, locate affected assets and follow repair evidence. This supports resilient infrastructure under SDG 9. Telecom/fiber reporting also relates to target 9.c. The platform does not claim that reporting alone proves improved infrastructure outcomes; deployment should measure response times, verified repairs and report quality.

## 9. Architecture at a glance

The mobile app is a separate client of the existing system. Authentication and feed reads share backend records and rules with the website; it does not run SvelteKit, PostgreSQL or Gemini inside the phone.

```mermaid
flowchart LR
    Mobile[React Native mobile app] -->|Account and feed HTTPS API| Azure[SvelteKit backend on Azure]
    Web[SuriOS website] --> Azure
    Azure --> DB[(PostgreSQL)]
    Azure --> Media[Server-managed media]
    Azure --> AI[Gemini assessment]
```

Read the [architecture guide](docs/ARCHITECTURE.md) for implemented account/feed responsibilities and the planned reporting sequence. Azure readiness depends on deploying the merged backend and configuring the app's public origin.

## 10. Contributor workflow

Read [AGENTS.md](AGENTS.md) and [GEMINI.md](GEMINI.md) before editing. Start genuinely new features on a descriptive branch from verified current main, and stay on the agreed branch for follow-up fixes. Do not switch branches at the end of a prompt. Preserve orange branding and keep secrets on the backend. Do not push or deploy without explicit instructions. Mobile uses React hooks/native components; the website's Svelte-specific syntax rules do not apply here.

## 11. Next steps

Validate account access on your physical device and Azure, then add photo capture, location selection and server-side assessment. In-app discussions and other interactions follow. Government administration stays on the website initially. See the [roadmap](docs/ROADMAP.md).

The initial Expo toolchain has unresolved npm audit findings; see the [dependency audit note](docs/DEVELOPMENT.md#initial-dependency-audit). This foundation is for development and is not a release-ready APK.
