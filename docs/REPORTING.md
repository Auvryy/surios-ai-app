# Hazard map and field reporting

The mobile client uses the same SuriOS reports, assessment drafts, road selections and publication endpoints as the website. The backend remains responsible for validation, AI, issue matching, permissions and official resolutions. No migration, reseed or additional Azure service is needed for this mobile feature when the documented web API is already deployed.

## Map controls

Open **Map** in the bottom navigation. The map starts around Santa Cruz and fits loaded hazards. It uses OpenStreetMap street tiles only.

- **Reports** opens a list, also usable when tiles fail. A pin's corner count opens a list of separate overlapping hazards; visual clustering never merges records.
- **Filters** searches streets/assets/tickets and filters status, issue type, critical severity or high public exposure. Sort by priority, severity, date or support.
- **Layers** toggles the same reference-road geometry as the website. Dashed reference lines show context, not measured condition.
- Numbered pins show canonical severity. Solid colored lines and end circles show reported road sections. Severity, support and operational priority have separate labels.
- **Legend**, fit, zoom, refresh and foreground GPS controls have tap alternatives. Reports refresh every 30 seconds while active and on return to the app.
- Select a hazard to view evidence, assessment, source posts and their matching explanations. A resolved hazard can open its linked official resolution; the link is fetched from the source post, not guessed.
- **Directions** uses the existing backend route service. A returned direct connection is labeled approximate; it is not presented as a road route.
- The camera beside **Legend** opens the same composer as the center **Post** action. **Share an update** in hazard details starts a new report at that location.
- **View on hazard map** in a feed post opens its canonical hazard. Older hazards outside the latest snapshot are loaded individually.

## Create a post

On Home, **Photos** or **Video** opens the corresponding picker and starts a post with that evidence already attached. The compact prompt, **Location**, center **Post** action and map camera all open the same composer. The introductory feed text has been replaced by these actions.

1. Add a headline and caption describing what is visible.
2. Choose photos/videos from the system library, or open the camera for a photo. Choose the cover using the thumbnails. The large photo preview uses cover sizing; evidence can be opened separately.
3. Press **Assess evidence**. The app uploads multipart files and reporter context to `/api/community/assess`. Only the server invokes Gemini. Review its returned asset type, severity, summary, visible evidence, reporter claims, confidence and limitations.
4. Add a location/landmark and select a point or mapped road section.
5. Press **Publish report**. A successful server response closes the composer, refreshes saved feed data and offers the saved hazard on the map. A grouped result explicitly says it joined an existing hazard.

Limits match the existing API: 1–6 files, JPEG/PNG/WebP photos up to 5 MiB each, MP4/WebM/MOV videos up to 25 MiB each, and 50 MiB total. Unsupported formats, unreadable files and oversized selections keep the current valid form. Native uploads append an `expo-file-system` `File` to `FormData`; they do not create base64 copies in application state. Expo SDK 58's fetch encoder rejects the older React Native `{ uri, name, type }` multipart format before sending a request. The shared upload helper also covers avatar, cover and repost images. An unreadable or removed cached file asks the user to select it again.

Library and camera permissions are requested only when used. Permission denial explains the alternative. Native playback/capture formats and device permissions still require hardware validation.

## Location selection

**Point pin:** tap the map, drag the pin, drop it at map center, use foreground GPS, or enter coordinates and press **Place pin at coordinates**. A report needs an explicitly selected pin. The landing shadow marks where a dragged pin will drop; the initial pin gently hops unless reduced motion is enabled.

**Road section:** tap or drag the initial pin near a mapped road, or press **Select road at map center**. Authenticated `/api/roads` returns actual OpenStreetMap ways. The app selects the nearest way within 40 metres and starts with up to 80 metres. Adjust A/B by dragging, tapping the mapped road, or using ±5-metre buttons. Sections remain within 5–500 metres. The server revalidates the way and offsets when publishing. Lookup is guarded against repeated taps and stale responses; provider failure offers point selection.

The pin and A/B handles have touch targets at least 48 pixels wide. Hold a handle near a map edge to keep panning without releasing it. The composer pauses its own scrolling during map touches and restores scrolling on release or cancellation. The landing shadow follows the point pin during a drag; the marker stays attached while the map or composer resizes. Tap, coordinate and ±5-metre controls remain available when dragging is inconvenient.

Road selection is available for all supported assets as a location tool. It does not reclassify drainage, bridges or utility reports as pavement or establish that the whole line is damaged. The app does not invent roads when lookup fails.

## Assessment and draft lifecycle

- Visible evidence and reporter claims remain distinct. The app displays the returned assessment without changing severity or applying a local low/high score cap.
- Editing the headline, caption or media invalidates the assessment and discards its owned server draft. Cover and location changes do not alter assessed evidence.
- The client supplies a UUID assessment ID, allowing cancellation while the provider is still running. Late cancelled results cannot restore a stale assessment.
- Closing a nonempty composer asks whether to keep editing or discard. Discarding removes the owned unpublished draft. Published evidence is never discarded by cleanup.
- Upload/assessment has a longer timeout than normal reads. Provider failures and rejected evidence retain text/media and display the server's reason near the relevant controls.
- Publishing locks editing and repeated submissions. An uncertain failure retains the same draft for an idempotent retry. Missing, stale or expired drafts require reassessment.
- Drafts expire after 24 hours and assessment quotas are enforced by the server. Form contents remain in memory while open; offline persistence and background upload are not implemented.

## Rendering and native boundaries

The controls, sheets, form, gallery and navigation use React Native primitives with the existing orange, light-only tokens and shadcn-like borders/radii. Website Svelte components are not embedded in the form.

Only the map canvas uses a local Leaflet document. Android/iOS render it through `react-native-webview`; browser preview uses a sandboxed iframe. Both use the same local document and typed message protocol. The bridge receives map geometry/commands only: never session tokens, credentials, API URLs or uploaded file contents. Incoming events are validated, and browser events must originate from the owned iframe. External top-level navigation and local file access are disabled on native.

Leaflet JS/CSS and its license are bundled under `assets/map`; executable code is not downloaded from a CDN. `npm run map:bundle` regenerates them from the pinned dependency. Reference roads contain website geometry/names only; illustrative legacy PCI/condition data was deliberately excluded. Tiles require an internet connection and visible OpenStreetMap attribution. No map API key, paid minimal-map style, bulk tile download or offline tile cache is added.

## Verification

```bash
npm run check
npm test
npm run export:web
npm run export:android
npx expo-doctor
```

The default suite serves an isolated production web export on localhost:8082 with an HTTPS fixture API origin. It does not load local environment files or contact Azure for fixture requests. This also exercises release HTTPS validation. Test output and exports live in ignored `artifacts/` and `test-results/`.

`tests/report-controller.spec.ts` covers multipart transport, evidence/context lifecycle, file limits, cancellation, idempotency, road geometry and map-interaction event validation. `tests/native-uploads.spec.ts` runs the installed Expo multipart encoder against native-style files and checks the legacy format failure, file bytes, MIME types, browser files and missing-file recovery. `tests/reporting.spec.ts` exercises the actual map renderer, filters/source/resolution links, pin shadow, continuous edge panning for the point pin and both road handles, touch cancellation, composer scroll locking, uploads/covers, publication, recovery, layout and reduced motion. Existing authentication/session/feed tests remain part of the suite.

The opt-in `tests/reporting-live.spec.ts` additionally requires a **disposable local backend database**, the web repository's loopback fake Gemini transport, and a loopback HTTPS proxy. It creates labeled demo records, tests real persistence/media downloads and real OpenStreetMap section verification, then removes its own posts and sessions. It refuses a non-loopback origin. Never target a production database. With that environment prepared:

```bash
SURIOS_TEST_REPORTING_LIVE=1 SURIOS_TEST_API_ORIGIN=https://127.0.0.1:5188 npm run test:reporting
```

A connected Android 16 phone reproduced the legacy multipart error. A real native `File` upload then passed a byte-for-byte transport check, and the selected report evidence completed assessment against the deployed Azure backend while preserving the open form and road selection. No report was published by that check.

A browser run proves browser behavior. An Android export proves JavaScript bundling, not an APK. The edge-pan tests include Chromium touch events but still need acceptance on the native WebView. Before a release, complete device checks for camera/library return, foreground GPS and denied permissions, native map gestures, video playback, keyboard/safe areas, large text, session expiry and upload recovery. Expo Go hosts development sessions; a separate signed build is needed for an installed SuriOS launcher icon and splash screen.
