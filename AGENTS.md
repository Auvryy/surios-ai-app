# AGENTS.md — SuriOS Mobile agent quick reference

Read [GEMINI.md](GEMINI.md) completely before modifying this repository. It contains the engineering rules for all assistants and contributors, regardless of which AI tool they use.

## Seven operating rules

1. **Use the agreed feature branch.** Never code or commit on `main`. When starting a new feature from `main`, fetch and verify the latest `origin/main` before creating a descriptive branch. Stay on that branch for follow-up fixes. Do not create or switch branches merely because a prompt is complete; follow the user's branch instructions. Check the working tree before switching and preserve others' changes.
2. **Strict project-folder boundary.** Work only inside `/home/andy/Projects/surios-ai-app`. Do not inspect, search, read, create or modify files outside this project folder unless the user explicitly instructs you to do so. A task to build mobile screens does not itself authorize changes to the web repo. Backend work requires explicit instruction to enter that repository.
3. **Protect secrets.** Never stage credentials, real `.env` files, signing keys, tokens or private certificates. Verify `.gitignore`. `.env.example` may contain public placeholders only. Every `EXPO_PUBLIC_` value is public.
4. **Preserve the mobile stack.** Use React Native, Expo, Expo Router and strict TypeScript. Use React hooks and native UI primitives. Do not transplant Svelte runes, browser-only components or server code into the app.
5. **Preserve SuriOS behavior.** Orange is the brand color and the app is always light-only, regardless of device appearance settings. Do not add dark mode or an appearance toggle. Respect safe areas, accessible touch targets, the multi-asset SDG 9 scope and backend-controlled assessment/grouping/resolution rules. Never fabricate live posts or AI results.
6. **Break work into commits.** Commit small, complete, independently reviewable changes. Keep unrelated app code, documentation, and dependency updates in separate commits when they can stand alone; do not create one large catch-all commit. Use a clear `feat:`, `fix:`, `docs:` or `chore:` message. Follow [GEMINI.md](GEMINI.md#validation-and-completion) for checks appropriate to each change. Browser export, Android bundle export and native-device testing prove different things; report the limits honestly.
7. **Never push automatically.** The user handles pushes and pull requests. Do not issue a push command unless the user explicitly asks. At prompt completion, leave the current feature branch checked out; do not switch branches until instructed.

## Read next

- [README.md](README.md): product, setup and current feature status.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): current implementation and target Azure integration.
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md): Arch Linux workflow and verification commands.
- [docs/ROADMAP.md](docs/ROADMAP.md): integration order and acceptance criteria.

Package versions come from `package.json` and `package-lock.json`. Source code and verified endpoint behavior take precedence over stale examples in documentation.
