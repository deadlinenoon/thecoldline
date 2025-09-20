# Repository Guidelines

## Project Structure & Module Organization
- Source lives under `src/` (TypeScript). UI in `src/components`, domain logic in `src/lib`, styles in `src/styles`. Public assets in `public/`.
- Next.js uses both `app/` and `pages/` routers; API routes under `pages/api/`.
- Additional code: top-level `components/`, `lib/`, and `libs/` folders exist for legacy and shared modules; prefer `src/*` for new code. Tests in `tests/`. Scripts in `scripts/`.
- Path alias: `@/*` resolves to `src/*` (see `tsconfig.json`).

## Build, Test, and Development Commands
- `npm run dev` — Start Next.js dev server.
- `npm run build` — Production build.
- `npm start` — Run built app.
- `npm run lint` — ESLint (Next.js + TypeScript rules).
- `npm run type-check` — TypeScript `tsc --noEmit`.
- `npm test` — Runs TypeScript test scripts via ts-node.
  - Example (single file): `node -r ts-node/register/transpile-only -r tsconfig-paths/register tests/modelSimulation.test.ts`.
- Deployment (Vercel): `npm run deploy:prebuilt` for prebuilt prod deploys.

## Coding Style & Naming Conventions
- Language: TypeScript (strict). Indentation: 2 spaces. Avoid `any` when feasible.
- Components: PascalCase `.tsx` in `src/components` (e.g., `GameCard.tsx`).
- Utilities and modules: camelCase `.ts` in `src/lib` (e.g., `poissonSim.ts`).
- Use path alias `@/…` for imports from `src/`.
- Linting: ESLint with `next/core-web-vitals` and TypeScript plugin; fix warnings before PR.

## Testing Guidelines
- Tests reside in `tests/` as `*.test.ts` and use Node `assert` with ts-node. Keep tests deterministic and fast.
- Add unit tests for new logic in `src/lib` and snapshot/markup checks for components if relevant.
- Run `npm test` and `npm run type-check` locally before opening a PR.

## Commit & Pull Request Guidelines
- Use Conventional Commits when possible: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`. Keep subject ≤ 72 chars.
- PRs should include: concise description, rationale, screenshots for UI changes, and linked issues.
- Ensure PRs pass `lint`, `type-check`, and `test`. Avoid unrelated refactors.

## Security & Configuration
- Secrets go in `.env.local`; never commit secrets. See `fix-envs.sh` for local/Vercel env setup. Keep `.env*` out of VCS.
- Validate external API usage and handle failures gracefully in `pages/api/*` and `src/lib/*`.
