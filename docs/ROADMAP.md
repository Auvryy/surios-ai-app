# Mobile implementation roadmap

## Phase 0 — initialized foundation

Home/About screens, Expo Router, TypeScript, orange light-only theme, first-run three-slide onboarding, local onboarding completion preference, account forms, citizen shell, report-composer preview, browser preview, public configuration and documentation. This foundation is retained by Phase 1.

## Phase 1 — authenticated access and feed

Implemented: citizen signup, shared-account sign-in, bearer sessions, native SecureStore/browser tab storage, protected routes, approval handling, logout, expired-session recovery, paginated saved posts and website resolution links. Local real-backend and browser edge-case tests verify these flows; Azure bearer API and browser login/session/feed/logout also passed after configuring the localhost allowlist. Remaining environment acceptance: a physical-device check. See [AUTHENTICATION.md](AUTHENTICATION.md).

## Phase 2 — citizen field reporting

Implemented: camera/library photo/video selection, cover selection, foreground GPS/manual pins, OpenStreetMap hazard map, actual road sections and endpoints, source/evidence/resolution links, server assessment drafts and publishing. Browser tests cover denial recovery, stale/cancelled drafts, file limits, covers, duplicate submission and map interaction. A disposable real backend verifies saved posts/media and mapped-section publication. Remaining environment acceptance: native camera/GPS/WebView/playback and upload recovery on a physical device. See [REPORTING.md](REPORTING.md).

## Phase 3 — follow-up and interactions

Official-update links and canonical grouped-hazard status are available through feed/map data. Own profiles now include saved personal post history, name/avatar/cover editing, and office details/statistics, using the same Azure API as the website. See [PROFILE.md](PROFILE.md).

Settings now support saved comments/replies and post-like email preferences, password changes, and recovery-link requests through the same backend. The interface mirrors the website's notification/security cards and handles unavailable email delivery. See [SETTINGS.md](SETTINGS.md).

Implemented: in-app post/update details, source and update reactions, comments/replies, comment likes, social reposts with optional images and device sharing/browser link fallback. Disposable-backend integration verifies that linked posts show the same official resolution, unrelated hazards remain independent and interactions persist across sessions and website reads. See [DISCUSSIONS.md](DISCUSSIONS.md). Remaining environment acceptance: native sharing, keyboard, media and document handoff on a physical device.

Implemented: saved in-app notifications for official progress/resolution across linked reports and comments/replies, with unread badges, All/Unread filters, owned read receipts and links to native discussions. Backend migration `0014_notifications.sql` must be deployed before using the inbox against Azure. SMTP and phone push are independent. See [NOTIFICATIONS.md](NOTIFICATIONS.md).

Implemented: server-backed search, Critical/media/sort filters, Liked posts, feed-context public citizen/office profiles and confirmed owner-only source/social-repost deletion. Existing backend APIs enforce ownership and preserve canonical hazards/official history. See [FEED_TOOLS.md](FEED_TOOLS.md).

## Phase 4 — dedicated builds and release validation

Implemented: Orie launcher icon, Android adaptive/themed layers, splash artwork and browser favicon, with validated colors, dimensions and safe margins. See [APP_BRANDING.md](APP_BRANDING.md). Installed launcher/splash acceptance still requires a rebuilt native binary.

Configured: Android package `site.surios.app`, linked Expo project and an EAS `preview` profile for a standalone APK using the Azure API. Configure signing, build and install the APK, then validate launcher/splash, permissions, keyboard, safe areas, large text, offline errors, upload recovery, map gestures and authentication expiry. See [ANDROID_BUILD.md](ANDROID_BUILD.md). iOS identifiers and validation follow when hardware/distribution access is available.

Offline drafts, push notifications and app-store publishing are optional later projects. Do not claim these are included in the initialized starter.
