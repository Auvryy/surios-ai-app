# Mobile post details and discussions

Feed/profile **Open post** controls and valid map source/resolution links open protected `/post/[id]`. Add `?repost=<uuid>` to open a specific repost or official update. Resolved feed badges and official-update buttons follow the backend's canonical link, including an update on another observation of the same hazard.

The screen uses React Native primitives, orange/light-only tokens, safe areas, 48-unit actions and a virtualized list for comments and related updates. Cards, author rows, quoted reports, discussions and official evidence follow the website's thread design.

## Available behavior

- Full report text, author/date, photo/video evidence, location name and expandable original assessment.
- Current shared hazard status/severity/risk; original assessment and historical update status remain separately labeled.
- Official explanation, estimated/actual budget breakdown, evidence photos and external PDF opening.
- Saved source-post likes, comments/replies and comment likes. Reposts and official updates have their own discussion and reactions.
- Social reposts with optional text up to 1,000 characters and one JPEG/PNG/WebP image up to 5 MiB. Reposting an update includes its quote ID and actual source observation. Social reposts never submit an official status.
- Native device sharing; browser share/copy when available and a selectable public link as fallback. Shared links use public website URLs; universal/app-link registration is not included.
- Loading, empty, retry, deleted source, unavailable repost, expired-session and pending-account states. Returning to feed/profile refreshes saved data.

Government update creation, work orders, administration, post deletion, push notifications and offline drafts are outside this feature. Existing government updates can be read, discussed, liked and socially reposted.

## Backend contracts

All requests use `EXPO_PUBLIC_API_BASE_URL` through the existing bearer client, with cookies omitted. There is no new backend, database or client-side assessment.

| Action | Existing API |
| --- | --- |
| Read source and linked updates | `GET /api/community/posts/:id` → `{ post, reposts }` |
| Like source | `POST /api/community/posts/:id`, `{ action: "like", liked }` → `{ confirmations, userConfirmed }` |
| Comment/reply on source | Same endpoint, `{ action: "comment", body, parentId }` → `{ comment: { id, ... } }` |
| Like source comment | `POST /api/community/comments/:commentId`, `{ liked }` |
| Like update/repost | `POST /api/community/reposts/:id`, `{ action: "like", liked }` → `{ likes, userLiked }` |
| Comment/reply on update | Same endpoint, `{ action: "comment", body, parentId }` → `{ id }` |
| Like update comment | `POST /api/community/reposts/:id/comments/:commentId`, `{ liked }` |
| Social repost | `POST /api/community/reposts`, multipart `id`, `postId`, `body`, optional `quotedRepostId` and `image` → `{ id, postId }` |

Thread parsing validates IDs, timestamps, counters, booleans, evidence and same-origin media. Linked updates must refer to the same hazard. A missing selected repost shows an error instead of another discussion. The server enforces roles, approval, reply ownership, upload limits and hazard lifecycle rules.

## Requests and recovery

Writes are serialized and double taps guarded before a request starts. Reads are aborted before writes; stale reads and unmounted callbacks cannot replace the thread. Read failures retain the last known thread and offer retry. A confirmed write followed by a failed refresh stays acknowledged with a separate read error.

Comment text and reply target survive failures. A network, server-error or otherwise ambiguous response requires checking the discussion before another send because comment creation has no idempotency key. Confirmed comments clear the input and refresh the discussion.

Each repost composer holds one UUID across retries. An ambiguous response freezes the draft so the same request can be retried without changed contents. The server deduplicates that UUID. Draft images remain in memory; browser object URLs are released on replacement, removal or close. Closing discards the local draft; drafts do not survive app restart.

## Preview and verification

Sign in to the existing Expo preview and open a feed/profile post. Direct routes are `/post/<post-uuid>` and `/post/<post-uuid>?repost=<repost-uuid>`.

Expo's static web export emits `post/[id].html`. A static host must map `/post/<id>` to that template while preserving the requested URL. `scripts/serve-test-web.mjs` handles this for browser tests. Expo development and native routing handle dynamic routes normally.

```bash
npm run check
npx playwright test discussion-contracts.spec.ts discussion.spec.ts
npm run export:web
npm run export:android
npx expo-doctor
```

Opt-in `discussion-live.spec.ts` requires a disposable loopback backend and seed IDs in ignored `artifacts/discussion-seed.json`; it refuses remote hosts. It verifies real UI writes, separate sessions and website reads, uploaded image bytes, repost idempotency, quoted-update discussions, grouped resolutions and an unrelated unchanged hazard. It does not write to Azure, call Gemini or send real email.

Browser tests do not prove native execution. Physical-device acceptance remains: Android/iOS sharing and cancellation, photo-library access/uploads, video playback, document handoff, keyboard, hardware Back, screen reader/large text and SecureStore/session behavior. Android export is a JavaScript bundle, not an APK.
