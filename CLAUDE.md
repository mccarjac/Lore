# CLAUDE.md

This project's guidance for AI coding agents lives in **[AGENTS.md](./AGENTS.md)**.
Read it before making changes — it covers the architecture, the storage
concurrency rule, conventions, gotchas, and the required `npm run check-all`
gate.

Quick reference:

- **Before committing:** `npm run check-all` must pass (type-check + lint +
  format + tests). CI also enforces type-check, lint, and tests.
- **Storage mutators** must wrap their read-modify-write in `runExclusive(KEY, …)`
  from `src/utils/storageQueue.ts` (see AGENTS.md → "Data & storage architecture").
- **Dates:** use `src/utils/dateUtils.ts`; never `new Date('YYYY-MM-DD')`.
- **No `console.log`; no `any`.** Use path aliases (`@/`, `@components`,
  `@screens`, `@models`, `@utils`).
- **Domain nouns** come from `useLabels()` / `getLabel()`, never hardcoded —
  `src/ruleset/` is the engine, `src/rulesets/` is content, and engine code
  never imports the latter.

See AGENTS.md for the full details, `docs/` for the user-facing documentation,
and `docs/ruleset-authoring.md` for how a flavor plugs in.
