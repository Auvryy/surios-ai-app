# SuriOS Mobile — engineering and AI agent constitution

Read this document before editing code or documentation. It applies to every assistant and contributor. [AGENTS.md](AGENTS.md) is the quick reference; this document explains the rules.

## Mission and reporting scope

SuriOS, from Tagalog *suri* (inspect and analyze), helps communities document public infrastructure defects and follow accountable public responses. The mobile client serves citizen field reporting, initially in Santa Cruz, Laguna, and supports UN SDG 9: resilient infrastructure and innovation. Telecom/fiber reporting also relates to target 9.c.

Supported assets include roads, bridges and footbridges, drainage and flood canals, streetlights and utility poles, water pipes and hydrants, and telecom/fiber cables. Avoid describing SuriOS solely as road safety or assuming every report concerns pavement.

The mobile repo currently contains a branded foundation, not connected reporting features. Read the README and inspect source before claiming a feature is implemented. Future work should use the same Azure backend, accounts, reports and official resolutions as the website.

## Mandatory stack and responsibility boundaries

| Layer | Technology | Rule |
| --- | --- | --- |
| Mobile UI | React Native + TypeScript | Functional components, strict types, native primitives and React hooks |
| App framework | Expo | Use SDK-compatible packages; avoid unnecessary native dependencies |
| Navigation | Expo Router | Routes in `src/app`; typed links, predictable back navigation and deliberate deep links |
| Styling | React Native StyleSheet + semantic tokens | Orange branding, shared tokens in `src/constants/theme.ts`, light/dark parity |
| Browser preview | React Native Web | Useful for layout and navigation; not proof of native behavior |
| Backend, separate repo | SvelteKit on Azure | Authentication, authorization, validation and business rules remain server-side |
| Persistence, server-side | PostgreSQL + Drizzle | No direct database access from the mobile client |
| AI, server-side | Existing Gemini integration | Never ship the Gemini SDK/key or duplicate server prompts in the mobile app |

Do not replace the stack or introduce Flutter, Svelte UI, a second backend, a second database, an authentication SaaS or a global state framework without task-specific authorization. Package manifests are the version authority. Prefer existing primitives and local state; introduce abstractions when actual feature requirements justify them.

## Code and UI conventions

- Keep route files focused on presentation and navigation. Extract reusable UI into `src/components`.
- Keep public configuration in `src/config`; separate future API transport, domain contracts and native adapters from screen rendering. Do not create empty framework layers just to match a diagram.
- Prefer `View`, `Text`, `Pressable`, list primitives and safe-area-aware layouts. Use platform-specific files only where capabilities genuinely differ.
- Clean up subscriptions and pending requests. Guard stale assessment results, repeated submissions and unmounted state updates.
- Use explicit loading, empty, error and retry states. Preserve valid user input on failures. Do not silently turn a failed request into fake success. The current login/register interface is deliberately unconnected: keep the notice clear and never claim credentials were accepted.
- Use virtualized lists for growing feeds. Avoid base64 media in application state or database records when file uploads/URIs are available.
- Orange is the primary brand color. Do not change it to blue. Keep the interface minimal, with readable text, restrained borders and no decorative gradients.
- Respect system theme, safe areas, large text and reduced-motion settings. Give controls accessible names, visible focus in the browser, pressed feedback and at least 48-unit touch targets.
- Keep maps and media usable on narrow phones. Critical actions must have tap controls rather than depend exclusively on dragging or hover.
- Use genuine media or explicitly labeled fixtures. Never describe demo records as verified reports.

## Authentication, API and security rules

- All live requests go to the configured backend origin through an authenticated API contract. Do not connect directly to PostgreSQL or Gemini.
- `EXPO_PUBLIC_API_BASE_URL` is public configuration, not a secret. All EXPO_PUBLIC values are bundled into the app.
- Never commit real environment files, passwords, session tokens, service keys, signing material or uploaded user evidence. A sanitized `.env.example` is the only environment-template exception.
- Native authentication is not implemented. Do not assume web cookies automatically authenticate native requests. Agree on session transport, revocation, expiry and platform-secure credential storage before implementing sign-in.
- Browser preview requires deliberate cross-origin/session handling. Do not weaken web CSRF, authorization or origin checks globally to make mobile requests work.
- Enforce roles, upload limits, draft ownership and validation on the backend. Hiding a button is not authorization.
- Production API access uses HTTPS. Ask for camera/location permission when needed, explain denial and provide manual recovery where possible.
- Resolve relative media and post URLs against the backend origin. A phone's localhost is not the developer PC.
- Do not log passwords, session headers or sensitive media contents.

## Evidence, severity and issue lifecycle

The backend owns the assessment policy. Mobile displays returned observations and limits without inflating them.

- Separate visible defects from reporter claims. Captions/headlines provide context; they do not prove hidden defects or danger.
- Do not infer ownership, energized wires, outages, water quality, hidden structural damage or completed repairs from an ambiguous photo.
- Apply ASTM D6433 terminology only to pavement, not bridges, utilities or telecom assets.
- Use proportional severity. Ordinary localized minor defects may score 4 or below; scores 8–10 require clear visible serious immediate danger and high confidence. Do not hardcode a low-score cap or inflate severity from user wording.
- Keep physical severity, community support and operational priority distinct.
- Point and road-section selection are location tools. Selecting a road does not reclassify the issue as pavement or establish that the entire section is damaged.
- Group posts only when backend evidence and location rules identify the same hazard. Nearby reports are not automatically one issue.
- A government resolution applies to the linked hazard and its linked posts. Each resolved status should open the official explanation/evidence. Unrelated reports must remain unchanged.
- Government-update reactions/comments belong to the update; they must not silently alter physical severity or confirmations on a quoted report.

## Git and workspace workflow

1. Inspect the working tree and current branch before editing. Never modify or commit directly on `main`.
2. For a genuinely new feature starting from `main`, fetch and verify `origin/main` is current before creating an agreed descriptive branch: `feat/<feature>`, `fix/<issue>`, `docs/<topic>` or `chore/<task>`. Follow explicit user instructions about when to create or change branches. Stay on the current feature branch for follow-up fixes. Completing a prompt is not a reason to create, switch, rename or delete branches. Do not switch to `main` automatically when finishing work.
3. **Strict project-folder boundary:** stay inside `/home/andy/Projects/surios-ai-app`. Do not inspect, search, read, create or modify files outside this repository unless the user explicitly instructs you to do so. Mobile work does not itself authorize accessing or changing the sibling SvelteKit repository or any other project. Backend work requires explicit instruction to enter that repo.
4. Preserve uncommitted work. Do not reset, delete or overwrite another contributor's changes. Treat a remote merge as unverified until fetched and inspected.
5. **Break work into commits:** make each commit small, complete and independently reviewable. Keep unrelated app code, documentation and dependency changes in separate commits when each can stand alone; avoid catch-all commits. Use plain `feat:`, `fix:`, `docs:` or `chore:` messages.
6. Check ignored patterns and staged paths before committing. Commit `package-lock.json` when dependency changes require it.
7. Never push, merge or deploy automatically. The user handles pushes and pull requests. Do not issue a push command unless the user explicitly asks. At prompt completion, leave the current feature branch checked out and do not switch branches until instructed.

## Validation and completion

For source changes, run `npm run check` and `npm run export:web`. When native dependencies, app configuration or shared platform code change, also run `npm run export:android` and `npx expo-doctor` as appropriate. Use meaningful behavioral checks for affected workflows.

For documentation-only changes, verify links, commands, source references and consistency with actual implementation; builds are unnecessary unless code/configuration changed.

A web export is a browser build. An Android export is a JavaScript bundle, not an installable APK. Only an installed device/emulator build verifies native execution, permissions and hardware behavior. Report exactly what was tested, outstanding integration and known audit findings. Never claim the app is ready for release based only on compilation.

## Documentation and architecture maintenance

Keep the README's feature status, architecture diagrams, roadmap and configuration guidance consistent with implementation. Label planned modules and contracts explicitly. Do not copy outdated web details such as legacy routes, automatic seeding or model fallbacks without verifying the source.

Read the web source only when authorized. The current mobile backend assessment policy is a server concern; server-model versions can change without a mobile UI rewrite. Do not hardcode them in the client.

Current source layout:

```text
src/app/                    Entry gate, first-run onboarding, login/register, Home/About, root layout
src/components/             Shared native UI
src/config/environment.ts   Public API-origin placeholder; no requests yet
src/constants/theme.ts      Orange light/dark tokens
src/constants/onboarding.ts Versioned local first-run preference key
src/components/auth/        Brand mark, onboarding illustrations and local-only account forms
assets/                     Template launcher assets
README.md                   Overview and quickstart
AGENTS.md / GEMINI.md        Contributor and AI-agent instructions
docs/ARCHITECTURE.md         Current and planned system design
docs/DEVELOPMENT.md          Local development and checks
docs/ROADMAP.md              Feature phases and acceptance criteria
```
