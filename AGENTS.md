# AGENTS.md — SuriOS Mobile agent quick reference

Read [GEMINI.md](GEMINI.md) completely before modifying this repository. It contains the engineering rules for all assistants and contributors, regardless of which AI tool they use.

## Seven operating rules

1. **Branch before editing.** Never code or commit on `main`. Use a dedicated, literal branch such as `feat/mobile-login`, `fix/location-picker` or `docs/mobile-guidelines`. Check the working tree before switching; preserve others' changes.
2. **Keep work isolated.** Work inside `/home/andy/Projects/surios-ai-app`. Read or modify sibling projects only when the user authorizes it. Backend changes belong in the separate web repository and must be tracked explicitly.
3. **Protect secrets.** Never stage credentials, real `.env` files, signing keys, tokens or private certificates. Verify `.gitignore`. `.env.example` may contain public placeholders only. Every `EXPO_PUBLIC_` value is public.
4. **Preserve the mobile stack.** Use React Native, Expo, Expo Router and strict TypeScript. Use React hooks and native UI primitives. Do not transplant Svelte runes, browser-only components or server code into the app.
5. **Preserve SuriOS behavior.** Orange is the brand color. Respect light/dark themes, safe areas, accessible touch targets, the multi-asset SDG 9 scope and backend-controlled assessment/grouping/resolution rules. Never fabricate live posts or AI results.
6. **Verify and commit clearly.** Keep commits focused. Follow [GEMINI.md](GEMINI.md#validation-and-completion) for checks appropriate to the change. Browser export, Android bundle export and native-device testing prove different things; report the limits honestly.
7. **Do not push automatically.** The user reviews and pushes unless they explicitly ask you to push. End a completed Git task with the actual branch's command: `git push -u origin <branch-name>`.

## Read next

- [README.md](README.md): product, setup and current feature status.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): current implementation and target Azure integration.
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md): Arch Linux workflow and verification commands.
- [docs/ROADMAP.md](docs/ROADMAP.md): integration order and acceptance criteria.

Package versions come from `package.json` and `package-lock.json`. Source code and verified endpoint behavior take precedence over stale examples in documentation.
