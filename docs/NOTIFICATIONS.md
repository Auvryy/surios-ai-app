# In-app notifications

The Updates tab and feed bell now open a saved notification inbox. It uses the existing SuriOS backend and PostgreSQL database, with the same account as the website. Notifications do not require SMTP or a second service.

## What appears

| Event | Recipient | Opens |
| --- | --- | --- |
| Government progress or resolution | Each distinct author of an active post linked to that hazard, excluding the official author | The actual government update, including one published on another linked post |
| Comment on a report | Report author, excluding the commenter | The source report's native discussion |
| Comment on a social or government update | Update author, excluding the commenter | That update's separate native discussion |
| Reply | Parent-comment author, plus the post/update author if different; excluding the commenter | The relevant report/update discussion |

Multiple observations by the same author produce one notification per government update. Nearby unrelated hazards do not receive it. A reply to the post author's own comment produces one reply notification for that author. Reading a post does not mark every notification about it as read.

This feature records new events after backend deployment; it does not create a historical inbox from seeded posts. Reactions and reposts do not currently generate inbox events. Email preferences remain separate and unchanged. Phone push delivery is a later feature.

## Mobile behavior

- All/Unread filters, cursor pagination, pull-to-refresh and an explicit Refresh control.
- Unread badges on the feed bell and Updates tab; counts above 99 display `99+`, with the full count in the accessibility hint.
- A contextual unread-count label and explicit unread text/dot on each new event. Resolution events use the existing success color and check icon.
- Opening an event navigates to `/post/:id`, retaining `repost` for a government/social update. Read receipts are sent separately so their failure cannot block the discussion.
- Individual and mark-all reads update the count only after a validated server response. Failed writes retain unread state. Mark-all is protected against repeat taps.
- The badge refreshes every 30 seconds while foregrounded and on foreground/focus. The inbox reloads on entry/return, pull-to-refresh or Refresh. This is foreground API refresh, not push delivery.
- Logout/session changes clear account-specific badge state. Cancellation guards stop stale pages or badge responses from replacing newer filter/read state. A feature 401 invalidates the shared session.
- Network/server errors offer retry. Unavailable data is not displayed as a successfully empty inbox or a confirmed zero count.

The interface uses native React Native controls, a virtualized list, existing orange/light tokens and accessible touch targets. It requests no extra permissions or device-notification packages.

## API and architecture

| Request | Contract |
| --- | --- |
| `GET /api/notifications` | Signed-in active account's items, global `unreadCount`, `hasMore`, `nextCursor` |
| `?filter=all` or `?filter=unread` | Filter entries without changing the global unread count |
| `?limit=1..50&cursor=...` | Default 20, opaque cursor for stable `(createdAt,id)` pagination |
| `PATCH /api/notifications` with `{ "action": "read", "id": "<uuid>" }` | Read one owned entry; idempotent; someone else's ID returns 404 |
| `PATCH /api/notifications` with `{ "action": "read-all" }` | Read this account's current unread entries |

Successful mutations return `success: true`, `readAt` and the server's unread count. Native bearer authentication and browser origin checks use the existing transport. Cookie-authenticated mutations retain CSRF protection. Private responses are `no-store`; request bodies cannot choose a recipient/account.

Server event creation runs inside the transaction that saves a comment or official update. The unique event/recipient key prevents duplicate events on official-update retries. Foreign keys remove receipts with physically deleted source records; source soft deletion retains the public tombstone and official history. No notification changes severity, support, matching or hazard status.

```mermaid
sequenceDiagram
    actor Actor as Citizen or government office
    participant API as Existing SvelteKit backend
    participant DB as Shared PostgreSQL
    participant App as Citizen mobile app
    Actor->>API: Save comment or official response
    API->>DB: Transaction: save event and recipient notifications
    DB-->>API: Commit together
    App->>API: Authenticated GET notifications
    API-->>App: Owned entries and unread count
    App->>API: PATCH owned read receipt
    API-->>App: Confirmed read time and unread count
    App->>App: Open source discussion or exact government update
```

## Deployment

Both repositories have a `feat/notifications` branch. The mobile branch requires the matching backend feature; the current deployed server may not expose the endpoint until the backend branch is merged and deployed.

On Azure, pull the reviewed backend main and run the existing `./surios.sh build` workflow. It applies additive migration `0014_notifications.sql`. Existing accounts, reports, evidence and statuses are retained. No reseed or new environment variables are required; SMTP remains optional. Keep the mobile API origin pointed at the same HTTPS website backend.

Backend implementation details: `docs/NOTIFICATIONS.md` in the web repository. Do not deploy the mobile client alone and assume its inbox endpoint already exists.

## Verification and limits

```bash
npm run check
npm test -- notifications-contracts.spec.ts notifications.spec.ts
npm run export:web
npm run export:android
```

Opt-in `notifications-live.spec.ts` additionally verifies actual government fan-out, evidence navigation, comment/reply persistence and account-scoped mark-all against a disposable loopback backend. It requires `SURIOS_TEST_NOTIFICATIONS_LIVE=1`, `SURIOS_TEST_API_ORIGIN` and the isolated `artifacts/notifications-seed.json` fixture. It refuses remote-host writes. Backend `tests/notifications.spec.ts` independently covers ownership, account/origin/CSRF guards, recipient rules, retries, invalid mutations and tied-timestamp pagination.

Browser and loopback integration prove client/API behavior; Android JS export is not an APK. Physical-phone touch, screen reader, native foreground/Back behavior and session storage remain device acceptance checks. No Azure notification writes or outgoing email are required for these tests.
