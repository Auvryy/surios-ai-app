# Search, liked posts, contributor profiles and deletion

The citizen feed uses the website's existing saved records, search rules and permissions. This batch adds no backend, database, migration, credentials or email dependency. Notification-inbox deployment requirements are separate; see [NOTIFICATIONS.md](NOTIFICATIONS.md).

## Home composer and evidence previews

Home begins with the signed-in user's avatar and a compact post prompt, followed by **Photos**, **Video** and **Location** actions. Photos/video open their corresponding system picker and carry the selected files into the same report composer; cancellation keeps the feed. Location opens the composer with both location-selection modes available. Search and Liked posts hide this entry card as before. The bottom bar keeps Map and Updates close to the center camera while retaining accessible tap areas.

Feed/profile cards display the saved cover with an overlaid vertical strip of other photo/video previews and a Map tile. Tapping a thumbnail changes the cover; tapping the cover opens the selected full-size evidence. Previous/Next reaches every attachment, and a `+N` overlay indicates additional items beyond the visible previews. The Map tile uses the post's saved coordinates and validated road section, loading the local street-map renderer only when selected. The map counter opens the canonical hazard. Missing coordinates do not generate a guessed preview; the existing hazard-map action remains available.

## Finding posts

Use **Search community** to search people, places and post text. Submit with the keyboard Search action or arrow button. Queries are normalized and limited to 100 characters. Search runs on the server's full dataset rather than only downloaded cards.

- All updates/Critical select the server feed. Critical uses the canonical hazard assessment, not a client inference.
- Filters opens a native sheet with All media/Photos/Videos and Newest first/Oldest first/Highest severity/Most liked. Most relevant is available during search; new searches start with relevance ordering.
- Changing search/filter resets cumulative pagination to page 1. Load more replaces the cumulative result without appending duplicate cards. Refresh and Retry preserve the query.
- The composer is hidden during search, Liked posts and contributor visits. The center Post action remains available.
- Older reads are aborted and cannot replace newer results. Filtered failures never substitute an unfiltered feed. Loading, empty, error and retry states are explicit.

## Liked posts

Choose **Liked posts** for the signed-in account's saved source-post and official/social-update likes. Search stays within those records. Competing All/Critical tabs and unsupported media/sort controls are hidden. The backend orders liked results by newest, or relevance during search. Back to community feed returns to the normal view. Returning from a discussion refreshes saved likes; liking does not change physical severity.

## Contributor profiles

Author links on feed cards, post/update headers and comments open `/citizen?profile=<uuid>` with Home/feed active. Visitors see the saved cover/avatar, public name and posts. Offices also show public jurisdiction/description and server-provided distinct-report statistics. Refresh, cumulative pagination, retry, empty/not-found states and Back navigation are supported.

The visitor view has no profile editor, sign-out/settings actions or private email. Even your own public contributor view stays read-only, with a separate Open your account profile action. The Profile tab always shows your own account and editor. IDs, response identity/ownership and office counts are validated; unexpected profiles are rejected. Only same-origin public media are rendered. Office statistics are operational attribution, not independent certification of repair quality or expenditure.

## Owned deletion

Your source posts and social reposts have a three-dot More options menu on feed/profile cards and in discussions. Delete opens an explicit confirmation; Cancel sends no request.

- Ownership is checked locally and by the backend. Other people's records, already deleted source posts and official updates have no menu. Even an official author cannot delete their government update.
- Duplicate submissions and dismissal during a pending deletion are blocked. Incomplete receipts and failures do not claim success or remove the card.
- Confirmed deletion refreshes saved history/counts. Source discussions immediately clear removed title/body/media even if the following read fails. Removing a social repost returns to the original source.
- Source deletion retains the canonical hazard, sibling observations, discussions and official history. Other people's evidence and office documents stay available. Official corrections use a new official update on the website.

## Existing API contracts

| Request | Purpose |
| --- | --- |
| `GET /api/community/posts?q=&tab=&media=&sort=&page=` | Server search/order, canonical filters, own likes, total and cumulative pages |
| `GET /api/profiles/:id?page=N` | Public contributor identity, saved feed and office counts |
| `GET /api/profile?page=N` | Existing own-account profile and edit ownership |
| `DELETE /api/community/posts/:id` | Owned source; requires `{ deleted: true, retainedHazard: true }` |
| `DELETE /api/community/reposts?id=:id` | Owned social repost; requires `{ removed: true }` |

Requests use the existing origin-bound bearer client, cancellation/timeouts and 401 session invalidation. Cookies, direct SQL and AI credentials are not added to the client.

## Verification

```bash
npm run check
npx playwright test feed-tools-contracts.spec.ts feed-tools.spec.ts
npm test
npm run export:web
npm run export:android
```

Contract/browser checks cover encoding, server query rules, paging/counts, stale results, retry, liked-only controls, public/private identity, own-profile refresh, confirmation/cancellation, duplicate prevention, official-history protection, incomplete receipts and confirmed deletion followed by a failed read. Layout checks include 375px, landscape, enlarged text, reduced motion and a dark system preference while the app stays light.

`feed-tools-live.spec.ts` is opt-in with `SURIOS_TEST_FEED_TOOLS_LIVE=1` and an HTTPS loopback `SURIOS_TEST_API_ORIGIN`. It requires this feature's disposable fixture manifest (`artifacts/feed-tools-fixture-state.json`) and labeled seed (`artifacts/feed-tools-seed.json`). The guard refuses remote origins, unrelated fixture identities and non-demo accounts. Fixtures include separate citizen/office accounts, 23 pagination records, linked observations, a canonical resolution/PDF, a social repost and independent likes. Tests verify real saved search/likes/profiles, ownership refusals and retained sibling evidence/official history. Never run these mutation tests against Azure or a personal database.

Browser tests and Android JavaScript exports do not prove installed native execution. Physical-device acceptance remains: keyboard Search, sheets/hardware Back, screen reader labels/focus, large system text and profile/discussion navigation. APK signing/distribution and phone push are separate work.
