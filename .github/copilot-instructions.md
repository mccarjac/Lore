# Copilot instructions

**Lore** is a genre-neutral React Native / Expo engine (TypeScript, strict mode)
for tabletop-RPG, LARP and worldbuilding campaign data: characters, factions,
locations, events and quests, plus Discord ingestion and GitHub-backed sync. All
data is local (AsyncStorage); there is no backend. The rules and vocabulary of
any particular game come from a **ruleset**, not from the code.

## Read this first

The conventions, architecture, storage-concurrency rule, ruleset layer and the
required pre-commit gate all live in **[AGENTS.md](../AGENTS.md)**. It is the
single source — read it before changing anything, and update it when a
convention changes. This file exists only so the assistants that look for
`.github/copilot-instructions.md` are pointed at it rather than inventing their
own conventions.

The short version:

- `npm run check-all` (type-check + lint + format:check + test) must pass before
  every commit. CI runs the same checks on every PR.
- Storage mutators wrap their read-modify-write in `runExclusive(KEY, …)` from
  `src/utils/storageQueue.ts`. Never nest two `runExclusive` calls for the same
  key.
- Dates are `YYYY-MM-DD` strings — use `src/utils/dateUtils.ts`, never
  `new Date('YYYY-MM-DD')`.
- No `console.log`, no `any`. Use the path aliases (`@/`, `@components`,
  `@screens`, `@models`, `@utils`).
- Domain nouns are looked up through `useLabels()` / `getLabel()`, never
  hardcoded in a screen — a different ruleset calls them something else.
- `src/ruleset/` is the engine; `src/rulesets/` is content. Engine code must not
  import from `src/rulesets/`.

## Where things are

- Architecture and conventions — [AGENTS.md](../AGENTS.md)
- Authoring a ruleset, and forking — [docs/ruleset-authoring.md](../docs/ruleset-authoring.md)
- Contributing, PR flow — [CONTRIBUTING.md](../CONTRIBUTING.md)
- Feature docs — [docs/](../docs/)

## When to ask for a human

Data-storage format changes, navigation restructures, new native dependencies,
and anything touching derived-stat computation (`src/ruleset/derived.ts` is
pinned by a parity suite of real pre-generalization numbers).
