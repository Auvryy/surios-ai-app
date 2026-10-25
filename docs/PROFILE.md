# Mobile profiles

The Profile tab and protected `/profile` route use the existing SuriOS account and Azure backend. The screen follows the website's profile view: a 3:1 cover, overlapping round avatar, public name, Edit profile button, post count, personal Posts section and new-post action. Native controls use the app's orange, light-only tokens, white bordered cards, restrained typography and an accessible editing sheet. The implementation uses React Native primitives rather than browser/Svelte components.

## Available behavior

- Fetch the signed-in account's saved public profile and cumulative personal post/repost history. Pull to refresh, load more and retry retain existing records when a request fails. An empty profile offers the real report composer.
- Edit the public name, select a profile picture and cover, preview selected images, or remove existing photos. The cover/avatar camera buttons also support direct photo changes.
- Government accounts, including administrators, can edit municipality/barangay level, jurisdiction and office description. The profile displays the server's distinct reports handled, in progress and resolved counts. These are not derived from currently loaded posts.
- Retain editor input and selected files on a failed save. No success message appears until the API confirms the account's saved profile. While saving, repeat submission, editing and sheet dismissal are disabled.
- Refresh session identity and the community feed after a confirmed change. Reopening `/profile` preserves that route while a saved session is verified. Missing or revoked credentials return to sign-in.
- Keep the current account's email and sign-out control available. Private account email comes from its authenticated session, not from a public profile response.
- Reuse existing feed cards, media previews, hazard-map navigation and official-resolution links. Full discussions now open in-app, including reactions, comments/replies and social reposts; see [DISCUSSIONS.md](DISCUSSIONS.md).

## Visiting other contributors

Feed/discussion/comment author links open read-only `/citizen?profile=<uuid>` with Home active. Visitors see public cover/avatar, name, office details/statistics and cumulative post history, with refresh/retry and Back. Private email, Settings, sign-out and edit controls are absent. The Profile tab continues to load your own account; visiting your own public view offers a separate account-profile action. Public identity/ownership is validated. See [FEED_TOOLS.md](FEED_TOOLS.md).

Owned source/social-repost deletion menus refresh personal history/counts after the server confirms removal. Other people’s content and official updates cannot be deleted from this view.

## Shared Azure contract

The app's existing `EXPO_PUBLIC_API_BASE_URL` points to the same HTTPS backend as the website, normally `https://surios.site`. No new server, database, migration or endpoint is needed.

| Request | Use |
| --- | --- |
| `GET /api/profiles/:id?page=N` | Read-only public contributor identity, feed and office statistics. |
| `GET /api/profile?page=N` | Own public profile, ownership, cumulative feed, total posts, pagination and office statistics. |
| `POST /api/profile` | Multipart public-name, photo/removal and optional office changes; returns the saved profile identity. |
| `GET /api/auth/session` | Refresh the account's name/avatar after a confirmed save. |
| `GET /media/:name` | Public saved avatar/cover; resolve against the configured backend origin. |

Profile requests use the same opaque bearer credential as the other mobile APIs. Browser cookies are omitted. The multipart transport supplies its boundary; native uploads use file URIs and browser uploads use the selected `File`. Credentials are never passed to profile image components or persisted with image metadata.

The client validates a trimmed name of 2–80 characters. Photos must be JPEG, PNG or WebP, each at most 4 MiB; file bytes and type are still validated by the backend. Removal uses explicit `removeAvatar` and `removeCover` fields set to `"true"`. Government fields are `governmentLevel`, `jurisdiction` (2–120 characters) and `bio` (at most 500 characters); citizen requests omit them. Role, approval, password and account-email changes are not public-profile fields.

Only same-origin public `/media` image URLs are rendered. Invalid or failed avatar images fall back to initials. The API response must describe the signed-in account and confirm ownership before editing becomes available. A stale profile read cannot replace a subsequently saved identity.

Selected images and editor text stay in memory while the editor is open. Cancellation discards them without uploading. This is not an offline draft or background-upload feature. Temporary browser object URLs are released when replaced or closed.

## Verification

```bash
npm run check
npx playwright test profile-contracts.spec.ts profile.spec.ts
npm run export:web
npm run export:android
```

The contract and browser suites cover identity/ownership checks, trusted media URLs, name/photo limits, authenticated multipart requests, image previews/removal, saved-session restoration, name changes, office details/statistics, cumulative pagination, empty/error states, cancellation, repeat-save protection and narrow/landscape/enlarged-text layouts.

`tests/profile-live.spec.ts` is opt-in through `SURIOS_TEST_PROFILE_LIVE=1`. Set `SURIOS_TEST_API_ORIGIN` to an HTTPS loopback backend backed by a disposable database and isolated uploads; permit `http://localhost:8082` as a browser test origin. The suite explicitly rejects remote hosts before registering its test account. It verifies real saved name/photos, byte-for-byte retrieved media, restored profile navigation, photo removal and public-profile privacy. An approved office fixture with password `MobileProfileFixture123!` and email supplied through `SURIOS_PROFILE_OFFICE_EMAIL` additionally verifies real office updates. These accounts and uploads belong only in the disposable fixture.

Azure endpoint availability and public-profile shape can be checked without changing production accounts. Full save/removal tests use isolated local data. Browser checks and Android JavaScript export do not prove native photo-library permissions, SecureStore, keyboard or device behavior; verify those in Expo Go or an installed device build before release.
