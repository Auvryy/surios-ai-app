# Mobile settings

Open Settings using the gear on the Profile screen, or visit the protected `/settings` route. The screen follows the website's two-card layout: Email notifications and Password & security, with the same preference labels, password disclosure and email-recovery action. Native controls use the shared orange, light-only theme, white bordered cards, accessible checkboxes, safe areas and scrollable keyboard-aware forms.

## Email notifications

The app loads the signed-in user's saved preferences and email from `GET /api/settings`. No editable default values are invented when loading fails; the screen offers retry. The two choices are comments/replies and post likes. `PATCH /api/settings` submits only `emailComments` and `emailConfirmations` as booleans, and updates the interface from the validated saved response. A failed save retains the user's choices.

These are email preferences, separate from future in-app or push notifications. When `mailAvailable` is false, the interface explains that delivery is unavailable, permits preference saves and disables the reset-email button. The mobile app stays light-only and does not send or overwrite the website's stored `theme` setting.

## Password and recovery

`POST /api/auth/password` sends `currentPassword`, `newPassword` and `confirmPassword` as JSON through the existing authenticated HTTPS client. Current passwords support the endpoint's legacy 256-character limit; new passwords must be 8–128 characters, match the confirmation and differ from the current password. Passwords are not trimmed. The backend verifies the current password and enforces the change.

After a confirmed change, sensitive fields are cleared. The current device's opaque bearer session remains valid; the backend revokes other sessions and invalidates existing recovery links. Failed validation or server requests retain the form for correction. Fields include password-manager hints, independent visibility controls and next-field keyboard navigation. Passwords are kept only in component memory, never URLs, local/session storage or logs.

`POST /api/settings/reset-link` is a bodyless authenticated request for the current account. The app displays the server's neutral inbox message after a valid response. Delivery failures, unavailable email and rate limits remain visible; the interface does not invent a sent-email success. The existing email link opens the website's secure reset page. Completing that reset revokes saved sessions, which the app detects during restoration or the next authenticated request. A native reset-link deep-link flow is outside this settings page.

Mutations are serialized while pending to prevent repeated or competing submissions. Pending operations disable editing, form disclosure and the app's Back control. Unmounted screens ignore late state updates, and expired credentials use the shared session invalidation flow. Pending/rejected government accounts remain at their approval screen and cannot load active settings.

## Verification

```bash
npm run check
npx playwright test settings-contracts.spec.ts settings.spec.ts
npm run export:web
npm run export:android
```

The suites cover strict responses, stored preference booleans, website-theme preservation, notification/recovery behavior without SMTP, failed-save retention, password lengths and matching, incorrect passwords, confirmed-field clearing, no password persistence, duplicate-submit guards, delivery/rate-limit failures, session expiry, protected navigation and phone/landscape/enlarged-text layouts.

`tests/settings-live.spec.ts` is opt-in with `SURIOS_TEST_SETTINGS_LIVE=1` and an HTTPS loopback `SURIOS_TEST_API_ORIGIN`. It requires a disposable database and a local trusted TLS mailbox; the browser fixture origin `http://localhost:8082` must be allowed. It rejects remote hosts before creating fixture accounts. The owned test proxy supplies `/__fixture/mail` and `/__fixture/reject-mail` only for inspecting test-mail delivery and simulating rejection. These are fixture controls, not application endpoints.

Real-backend checks verify saved preferences with a pre-existing website theme, password authentication/revocation across devices, recovery mail receipt and reset-session invalidation, and rejected SMTP delivery. Mail stays within the local mailbox and test data is removed with the disposable backend. Production Azure checks are read-only; no production passwords, preferences or outbound email are changed by the test suite.

Browser tests and Android bundle export do not verify an installed app's keyboard, password manager, accessibility service or hardware Back behavior. Test those on a physical device before release. Android JavaScript export does not produce an APK.
