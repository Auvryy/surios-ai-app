# Mobile implementation roadmap

## Phase 0 — initialized foundation

Home/About screens, Expo Router, TypeScript, orange light-only theme, first-run three-slide onboarding, local onboarding completion preference, account forms, citizen shell, report-composer preview, browser preview, public configuration and documentation. This foundation is retained by Phase 1.

## Phase 1 — authenticated access and feed

Implemented: citizen signup, shared-account sign-in, bearer sessions, native SecureStore/browser tab storage, protected routes, approval handling, logout, expired-session recovery, paginated saved posts and website resolution links. Local real-backend and browser edge-case tests verify these flows; Azure bearer API login/session/feed/logout also passed. Remaining environment acceptance: Azure's browser-origin allowlist and a physical-device check. See [AUTHENTICATION.md](AUTHENTICATION.md).

## Phase 2 — citizen field reporting

Add photo capture/gallery, GPS/manual location, street map and supported road selection. Connect existing assessment drafts and publishing. Acceptance: permission denial is recoverable; AI results come from the backend; publishing persists a real post visible on the website; draft ownership and media limits are enforced.

## Phase 3 — follow-up and interactions

Add official-update detail links, grouped-hazard status, reactions, comments, repost/share and profiles. Acceptance: linked posts show the same official resolution, unrelated hazards remain independent and interactions persist across devices.

## Phase 4 — dedicated builds and release validation

Replace template launcher artwork, configure Android package/iOS bundle identifiers, EAS project/build profiles and signing. Test a dedicated development APK on Android before a distributable build. Validate permissions, keyboard, safe areas, large text, offline errors, upload recovery and authentication expiry. iOS validation follows when hardware/distribution access is available.

Offline drafts, push notifications and app-store publishing are optional later projects. Do not claim these are included in the initialized starter.
