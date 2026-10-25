# Mobile implementation roadmap

## Phase 0 — initialized foundation

Home/About screens, Expo Router, TypeScript, orange light-only theme, first-run three-slide onboarding, local onboarding completion preference, account forms, citizen shell, report-composer preview, browser preview, public configuration and documentation. This foundation is retained by Phase 1.

## Phase 1 — authenticated access and feed

Implemented: citizen signup, shared-account sign-in, bearer sessions, native SecureStore/browser tab storage, protected routes, approval handling, logout, expired-session recovery, paginated saved posts and website resolution links. Local real-backend and browser edge-case tests verify these flows; Azure bearer API and browser login/session/feed/logout also passed after configuring the localhost allowlist. Remaining environment acceptance: a physical-device check. See [AUTHENTICATION.md](AUTHENTICATION.md).

## Phase 2 — citizen field reporting

Implemented: camera/library photo/video selection, cover selection, foreground GPS/manual pins, OpenStreetMap hazard map, actual road sections and endpoints, source/evidence/resolution links, server assessment drafts and publishing. Browser tests cover denial recovery, stale/cancelled drafts, file limits, covers, duplicate submission and map interaction. A disposable real backend verifies saved posts/media and mapped-section publication. Remaining environment acceptance: native camera/GPS/WebView/playback and upload recovery on a physical device. See [REPORTING.md](REPORTING.md).

## Phase 3 — follow-up and interactions

Official-update links and canonical grouped-hazard status are available through feed/map data. Add in-app reactions, comments, repost/share and profile editing. Acceptance: linked posts show the same official resolution, unrelated hazards remain independent and interactions persist across devices.

## Phase 4 — dedicated builds and release validation

Replace template launcher artwork, configure Android package/iOS bundle identifiers, EAS project/build profiles and signing. Test a dedicated development APK on Android before a distributable build. Validate permissions, keyboard, safe areas, large text, offline errors, upload recovery and authentication expiry. iOS validation follows when hardware/distribution access is available.

Offline drafts, push notifications and app-store publishing are optional later projects. Do not claim these are included in the initialized starter.
