# Shared account authentication

The app signs in to the existing SuriOS website backend. It uses the same accounts,
PostgreSQL database, account approvals and saved posts. It does not need another
Azure VM, IP, backend or database.

## Configure the server address

Copy `.env.example` to ignored `.env`. Set `EXPO_PUBLIC_API_BASE_URL` to the origin
you use to open the website, including its port when necessary. Do not append
`/api`, a page path, credentials or query parameters. Restart Expo after a change.

| Environment | Example public configuration | Requirement |
| --- | --- | --- |
| Browser and local backend | `http://127.0.0.1:5185` | Local SvelteKit API running on that port |
| Physical phone and local backend | `http://192.168.1.20:5185` | Replace with the PC's actual LAN IP; backend listens on `0.0.0.0` |
| Azure during development | `http://YOUR_AZURE_IP:YOUR_WEBSITE_PORT` | Use the same working website address and actual port |
| Released app | `https://YOUR_SURIOS_DOMAIN` | HTTPS and the merged mobile-compatible backend deployed |

HTTP is allowed in development; release builds enforce HTTPS. The IP documented
in the web architecture is `104.215.147.125`. After the user's Azure build finished,
`https://surios.site/api` returned SuriOS API version 1 and the guest session route
returned 401. The bare IP's port 80 returned 404 and port 3000 timed out; use the
working HTTPS domain instead of assuming the IP/port is the public app address.
Native-style API verification at that domain then passed: login 200, session 200,
saved feed 200 (17 items), logout 200 and the revoked token subsequently rejected
with 401. Only the verification session was created and revoked; no Azure account,
post, seed or schema was changed.

For a cross-origin **browser preview**, set the backend's `API_ALLOWED_ORIGINS` to
the exact frontend origins, for example:

```dotenv
API_ALLOWED_ORIGINS=http://localhost:8081,http://127.0.0.1:8081
```

Azure initially returned 403 for this browser preflight because the origin was not
allowlisted. After editing the VM's `.env`, recreate its web service from the web
repository directory; an image rebuild is unnecessary for this runtime setting:

```bash
docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate web
```

Native requests use a bearer credential and no fabricated `Origin` header. The
browser sends its real Origin automatically. Do not disable CSRF or use browser
cookies to work around configuration. When Azure builds, local backend development
can proceed independently. After deployment, verify `GET /api` returns JSON before
testing the same login on Azure. A missing/old endpoint produces a visible error.

For Expo Go against the verified Azure backend, set
`EXPO_PUBLIC_API_BASE_URL=https://surios.site` before starting Expo. The default
local browser preview remains on `http://127.0.0.1:5185` until the Azure browser
allowlist is configured. Neither an API key nor a database credential is needed.

## Implemented flow

1. The entry route reads the local onboarding preference and restores a saved
   credential through `GET /api/auth/session` before opening authenticated screens.
2. Sign-in sends JSON `{ email, password }` to `POST /api/auth/login`. Registration
   sends `{ name, email, password, confirmPassword }` to `POST /api/auth/register`.
   The mobile registration form creates citizen accounts; government registration
   and administration remain on the website.
3. The backend validates the account and returns an opaque `accessToken`,
   `tokenType: "Bearer"`, `expiresAt`, and safe own-account `user` details.
4. The app validates the response and saves the credential before considering
   sign-in successful. It never saves the password. Storage failure revokes the
   newly issued session and shows a retryable error. Signup may still have created
   the account; that case is explicitly explained to the user.
5. Active accounts open the saved community feed. Pending/rejected government
   accounts see their actual approval state and can retry or sign out; no feature
   requests are sent before approval.
6. API reads attach `Authorization: Bearer <accessToken>`. The feed replaces the
   collection on cumulative page loads, refreshes on request and renders server
   data only. Current shared hazard status and official resolution links come
   from the backend. Full posts/discussions currently open on the website.
7. Logout calls `POST /api/auth/logout` to revoke the current session, then clears
   device storage. A 401 also clears the session. During a network outage, logout
   clears this device and explicitly states that remote revocation could not be
   confirmed. A device-storage failure is shown rather than hidden.

## Session lifecycle and storage

| Platform | Storage | Lifetime and limits |
| --- | --- | --- |
| Android/iOS | Expo SecureStore, unlocked and device-only Keychain policy on iOS | Credential survives normal app restarts; server validation still required |
| Browser preview | `sessionStorage` | Current tab only; never `localStorage`; not the native security mechanism |
| All | In-memory validated account | Cleared when a session is rejected; private user details are not persisted |

Only an origin-bound token record is stored. Changing backend origins does not
forward another environment's saved credential. Onboarding alone uses AsyncStorage.
Tokens never enter URLs, Expo public environment variables, logs or analytics.
The transport omits cookies, restricts bearer requests to `/api`, rejects external
destinations, limits requests to 20 seconds and displays server errors safely.

The backend owns the 30-day session lifetime and rolling renewal. There is no
client refresh-token endpoint. The app rechecks when returning to the foreground
and on browser focus. A feature-request 401 invalidates that credential. An old
request cannot clear a newer account; cancelled logins cannot later sign the user
in or leave their credential saved. Network failures during cold restoration keep
the token and show retry; they do not invent a signed-in state.

## Verification

```bash
npm run check
npm run test:auth
npm run export:web
npm run export:android
npx expo-doctor
```

`test:auth` runs session/transport tests and browser tests with explicit mocked
responses for errors and edge cases. It starts an isolated Expo preview on port
8082 and requires Playwright Chromium (`npx playwright install chromium` once).
No real email, Gemini request or production account is used by those tests.

The two live tests are opt-in and require a **disposable local backend/database**
with the current web schema, CORS for `http://localhost:8082`, an account
`mobile-auth@example.test` with password `MobileAuthTest123!`, and a labeled
post titled `Demo · Mobile authentication verification`. They create additional
test accounts, so do not target production:

```bash
SURIOS_TEST_LIVE=1 SURIOS_TEST_API_ORIGIN=http://127.0.0.1:5185 npm run test:auth
```

On 2026-10-25, session/transport and browser checks passed, including real-backend
authentication. TypeScript/lint passed, Expo Doctor passed 20/20 checks, and
web/Android bundle exports succeeded. A follow-up review also verified the existing
local citizen account and its actual feed photos, including official attachments.
Implementation verification used such an isolated PostgreSQL database, exercised
real signup/login, feed reads, reload restoration and server-side logout
revocation, and removed that database afterward. It did not change Azure or reset
the normal local database. Browser tests also cover wrong passwords, expiry,
offline restoration, approval, blocked storage, rate limits, a missing backend
API, cumulative pagination and light layouts at small/landscape/enlarged sizes.

Android export is a JavaScript bundle, not an APK. SecureStore native execution,
permissions, operating-system background behavior and actual hardware still
require Expo Go or an installed development build on a phone.

Official references: [Expo SecureStore](https://docs.expo.dev/versions/v58.0.0/sdk/securestore/),
[Expo Router authentication](https://docs.expo.dev/router/advanced/authentication/),
[SuriOS backend API contract](https://github.com/Auvryy/surios-ai/blob/main/docs/MOBILE_API.md).
