# Contributing to Lore

Thanks for taking the time. This page covers the workflow; **[AGENTS.md](AGENTS.md)
is the architectural authority** — read it before changing code, and update it
when a convention changes.

## Before you start

Two questions decide where a change belongs:

1. **Is it specific to one game's setting?** Archetypes, traits, qualities,
   what things are called, which subsystems exist — all of that is a
   **ruleset**, not engine code. See
   [docs/ruleset-authoring.md](docs/ruleset-authoring.md).
2. **Is it a data-format, navigation, or native-dependency change?** Those are
   higher-risk. Open an issue and agree on the approach before writing much.

Otherwise: go ahead.

## Setup

```bash
npm install
npm run check-all
```

`npm run check-all` runs type-check, lint, format check and the full Jest suite.
**It must be green before every commit** — CI runs the same checks on every
pull request, and the pre-commit hook only sees staged files, so don't rely on
it alone.

## Making a change

1. Branch off `main`.
2. Write the change, and the tests for it. Bug fixes get a test that fails
   before the fix.
3. `npm run check-all`.
4. Open a pull request describing what changed and how you verified it.

Commits: a short imperative subject, and a body that says _why_ when the reason
is not obvious from the diff. Conventional prefixes (`feat:`, `fix:`,
`refactor:`, `docs:`, `test:`, `chore:`) are used throughout the history.

## The rules that actually matter

These cause real bugs, and reviewers will ask about them:

- **Storage mutators wrap their read-modify-write in `runExclusive(KEY, …)`**
  (`src/utils/storageQueue.ts`). Concurrent writes otherwise lose updates. If
  an operation touches two keys, wrap each section separately and sequentially
  — never nest `runExclusive` for the _same_ key, which deadlocks.
- **Never call AsyncStorage directly.** Everything goes through
  `SafeAsyncStorageJSONParser`.
- **Dates are `YYYY-MM-DD` strings.** Use `src/utils/dateUtils.ts`; never
  `new Date('YYYY-MM-DD')`, which parses as UTC and shifts the day.
- **Never hardcode a domain noun in a screen.** Look it up with `useLabels()`
  (components) or `getLabel()` (pure utils) so another ruleset can call it
  something else.
- **Engine code must not import from `src/rulesets/`.** `src/ruleset/` is the
  engine; `src/rulesets/` is content. Only `src/activeRuleset.ts` names a
  flavor.
- **Bidirectional links stay in sync** — faction relationships mirror onto the
  other faction, quest↔event links mirror onto the other side.
- **No `console.log`, no `any`.** `console.error` in a catch for a genuine
  failure is fine.

## Style

Prettier is authoritative — run `npm run format`. Single quotes, semicolons,
2-space indent, 80 columns, trailing commas, arrow parens omitted for a single
parameter. ESLint must report **0 errors**; warnings are tolerated.

Use the path aliases (`@/`, `@components/`, `@screens/`, `@models/`,
`@utils/`). They are declared in three files that must stay in sync:
`tsconfig.json`, `babel.config.js`, and `jest.config.js`.

Unused catch bindings: write `catch {}`, not `catch (error)`.

## Tests

Tests live in `tst/`, mirroring `src/`. See [docs/testing.md](docs/testing.md)
for layout, helpers and coverage.

The one rule worth repeating here: **a test may not depend on which ruleset the
build ships.** Pass a fixture explicitly — `genericRuleset` to prove a screen
reads the provider, `mechanicsRuleset` to prove the engine computes. Asserting
against the bundled flavor proves the app works for exactly one game.

## Reporting bugs and requesting features

Use the issue templates. For a bug, the useful things are: what you did, what
happened, what you expected, which platform, and — if the data looks wrong —
which ruleset you are running.

Issues about a specific campaign's content or setting belong on that flavor's
repository, not here.

## License

By contributing you agree that your contributions are licensed under the
project's [GPLv3 license](LICENSE).
