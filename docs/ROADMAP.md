# Mobile implementation roadmap

## Phase 0 — initialized foundation

Home/About screens, Expo Router, TypeScript, orange theme, browser preview, public configuration template and documentation. This phase contains no connected user workflow.

## Phase 1 — authenticated access and feed

Audit web APIs, agree on mobile session/secure-storage contracts and browser-origin rules, then implement sign-in, logout, session expiry and paginated saved posts. Acceptance: a real Azure account sees the same authorized posts in web and mobile; failures are visible and no secrets enter the bundle.

## Phase 2 — citizen field reporting

Add photo capture/gallery, GPS/manual location, street map and supported road selection. Connect existing assessment drafts and publishing. Acceptance: permission denial is recoverable; AI results come from the backend; publishing persists a real post visible on the website; draft ownership and media limits are enforced.

## Phase 3 — follow-up and interactions

Add official-update detail links, grouped-hazard status, reactions, comments, repost/share and profiles. Acceptance: linked posts show the same official resolution, unrelated hazards remain independent and interactions persist across devices.

## Phase 4 — dedicated builds and release validation

Replace template launcher artwork, configure Android package/iOS bundle identifiers, EAS project/build profiles and signing. Test a dedicated development APK on Android before a distributable build. Validate permissions, keyboard, safe areas, large text, offline errors, upload recovery and authentication expiry. iOS validation follows when hardware/distribution access is available.

Offline drafts, push notifications and app-store publishing are optional later projects. Do not claim these are included in the initialized starter.
