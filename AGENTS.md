# AGENTS.md

Guidance for AI coding agents working in this repository. Keep it accurate —
update it when conventions change.

## What this is

**Lore** is a genre-neutral React Native / Expo engine (TypeScript, strict
mode) for managing tabletop-RPG / LARP campaign data: characters, factions,
locations, events, plus Discord message ingestion and GitHub-backed data
sync. All data lives locally in AsyncStorage; there is no backend.

The rules and vocabulary of any particular game come from a **ruleset**, not
from the code — see "Ruleset layer" and "Engine vs consumer" below. Junktown
Intelligence (the Afterworlds setting) is one such ruleset and ships in this
tree under `src/rulesets/afterworlds/`; the app itself boots on a generic
example ruleset.

Stack: React Native 0.81 · Expo 54 · React Navigation 7 (drawer + stack) ·
AsyncStorage · Jest + @testing-library/react-native.

## Commands

```bash
npm install            # install deps
npm test               # Jest (tests live in tst/)
npm run type-check     # tsc --noEmit
npm run lint           # eslint (must have 0 errors; warnings are tolerated)
npm run format         # prettier --write
npm run check-all      # type-check + lint + format:check + test — run before every commit
npm run android        # run on device/emulator (web/ios also available)
```

**The gate is `npm run check-all`, and it must be green before you commit.**
`.github/workflows/pr-checks.yml` runs `type-check`, `lint` and `test` on every
PR into `main`, and `coverage.yml` posts an informational coverage comment
alongside it. `build-apk.yml` is `workflow_dispatch` only — EAS's free tier is a
monthly quota, so builds are triggered by hand (see `docs/github-actions.md`).
Do not rely on the pre-commit hook alone: it only checks staged files and is
bypassable.

## Layout

```
src/
  components/common/    reusable UI (Card, Section, Header*Button, ...)
  components/screens/   Base{List,Form,Detail}Screen — generic screen scaffolds
  screens/<feature>/    character/ faction/ location/ events/ discord/
  models/               types.ts — all domain types, and nothing else
  ruleset/              THE ENGINE: attribute primitive, ruleset schema,
                        provider, validator, terminology, derived stats
  rulesets/<flavor>/    A ruleset's content — consumer-owned. See below.
  navigation/           types.ts (navigator + param-list types) and
                        AppNavigator.tsx (the whole navigation tree)
  styles/               theme.ts (colors/spacing/typography), commonStyles.ts
  utils/                storage, export/import, discord, git, stats
  activeRuleset.ts      the registry a consumer configures (configureLore)
  branding.ts           app identity, resolved from env (see "Branding")
tst/                    Jest tests, mirroring src/
docs/                   user- and operator-facing documentation
.env.example            every environment variable, with its default
```

Note the singular/plural distinction, which is easy to misread: **`ruleset/`
is the engine, `rulesets/` is content.** Nothing under `rulesets/` may be
imported by engine code — only `src/activeRuleset.ts` names a flavor.

Path aliases (tsconfig + babel-plugin-module-resolver): `@/*` → `src/*`, plus
`@components/*`, `@screens/*`, `@models/*`, `@utils/*`. Use them. All five are
declared in **three** places that must stay in sync — `tsconfig.json`,
`babel.config.js`, and `jest.config.js`'s `moduleNameMapper`. `src/rulesets/`
deliberately gets no alias of its own: `@/rulesets/…` already resolves, and a
sixth alias would be a fourth thing to keep in sync. `@models/*` now points at
a directory holding one file and is a candidate for retirement.

## Engine vs consumer

**Lore is a package.** A flavor is a separate app that installs it, calls
`configureLore({ ruleset, assets })`, and renders `LoreApp` — see
`docs/consuming-lore.md`. That replaces the fork model #16 originally proposed:
engine work reaches a flavor through a version bump instead of a merge, and
there is one copy of the screens rather than two.

What a consumer owns:

```
package.json                the `lore` dependency, and every peer
.env / app.config.ts        its own app identity
index.ts                    configureLore(...) before registerRootComponent
its ruleset module          content, terminology, categories, bundled images
assets/*.png                icon, adaptive icon, splash, favicon
```

**The public API is `src/index.ts` and nothing else.** `package.json`'s
`exports` map publishes only `.`, so a deep import (`lore/lib/utils/…`) does
not resolve — deliberately. Anything re-exported from `src/index.ts` is a
supported surface whose shape is a breaking change; everything else is internal
and free to move. Adding an export is a decision, which is why that file uses
named re-exports rather than `export *`.

The build is `tsc -p tsconfig.build.json && tsc-alias -p tsconfig.build.json`,
run by `prepare` so a git dependency compiles on install. **`tsc-alias` is not
optional**: 78 of ~100 source files import through `@/…`, and inside a
consumer's `node_modules` those would resolve against _their_ `src`.
`src/rulesets/**` is excluded from the build and from `files` — the engine
package ships the engine, not somebody's campaign.

In-tree flavors still work and are what the dev app uses;
`docs/ruleset-authoring.md` covers writing one either way. Keep it in agreement
with this section.

`src/rulesets/afterworlds/` is laid out as `index.ts` (the
`RulesetDefinition`), `terminology.ts`, `categories.ts`, `assets.ts` +
`assets/`, and `content/` — the last holding `gameData.ts`, `speciesTypes.ts`
and their authoring types. **The content is still authored in the legacy
Afterworlds vocabulary** (`PerkTag`, `Species`, `Perk`, `StatModifiers`) and
transformed into ruleset shapes by `index.ts` at module load. Issue #13
sketched a fuller split (`archetypes.ts` / `traits.ts` / `qualities.ts` /
`recipes.ts` / `bonuses.ts`); that was deliberately not adopted, because
regenerating ~2200 lines of literals buys reviewability problems and no
behavior. Data-entry work (JunktownIntelligence#116) happens against
`content/gameData.ts`.

## Branding

`src/branding.ts` is the only place app identity lives — name, slug, version,
bundle identifier, EAS project id, Expo owner, splash color, and the paths of
the four branding PNGs in `assets/`. Every value **reads `process.env` and falls
back to Lore's own**, so a fork sets `.env` (see `.env.example`) and replaces
the images, and changes no tracked source at all.

- **`app.config.ts` is engine-owned** and holds no identity literals; it is the
  config _shape_ and reads every value from `src/branding.ts`. There is no
  `app.json` — leaving one in place would make it a base config merged under
  the dynamic one, i.e. two sources again.
- **`src/branding.ts` must stay dependency-free.** Expo loads `app.config.ts`
  outside Metro, so no `react-native` imports and no path aliases. For the same
  reason the import in `app.config.ts` is relative _and_ carries an explicit
  `.ts` extension — Expo transpiles that entry file with sucrase but resolves
  its requires with plain Node, which would look for `./src/branding.js`.
  `allowImportingTsExtensions` in `tsconfig.json` exists solely for this.
- **`APP_NAME` is not the same thing as `RulesetDefinition.branding.appName`.**
  The ruleset field is _runtime display_ identity, owned by whichever ruleset
  is active and correctly per-ruleset; `src/branding.ts` is _build_ identity,
  resolved before a ruleset is chosen. `APP_NAME` is the single source —
  rulesets import it, never the reverse.
- **Read `process.env` with static member access only.** Expo's babel transform
  inlines `process.env.EXPO_PUBLIC_*` by literal text substitution, so a lookup
  helper (`env('EXPO_PUBLIC_APP_NAME')`) resolves to `undefined` in a release
  bundle while working fine under Node and Jest — the worst possible failure
  mode. Write the accesses out.
- **`EXPO_PUBLIC_` only for values the app bundle reads.** `APP_NAME` is one
  (rulesets import it). Slug, bundle identifier, EAS project id and Expo owner
  are consumed solely by `app.config.ts` under Node, so they stay unprefixed
  and never ship. The same rule governs the `EXPO_PUBLIC_DATA_REPO_*` variables
  in `gitIntegration.ts`, which the app does read at runtime.
- **`EAS_PROJECT_ID` is empty by default** and `app.config.ts` omits
  `extra.eas` entirely while it is — EAS reads a blank id as a malformed
  project reference but an absent one as "not initialized yet", which is what a
  fresh clone is. Run `eas init` and put the id in `.env`.
- Changing the slug or bundle identifier affects EAS builds and orphans
  installed apps — an install does not upgrade across a package rename. The
  defaults here are Lore's minted identity (#15); do not change them.

## Data & storage architecture

- All persistence goes through `SafeAsyncStorageJSONParser`
  (`src/utils/safeAsyncStorageJSONParser.ts`) — a crash-safe wrapper around
  AsyncStorage. Never call AsyncStorage directly.
- `src/utils/characterStorage.ts` is the storage layer for characters, factions,
  locations, and events. Storage keys: `gameCharacterManager`,
  `gameCharacterManager_factions`, `gameCharacterManager_locations`,
  `gameCharacterManager_events`. Discord data has its own module
  (`discordStorage.ts`).
- **Concurrency rule (important):** storage mutators use a read-modify-write
  pattern (`load...()` → mutate → `save...()`). To prevent lost updates from
  concurrent writes, every mutator is wrapped in `runExclusive(KEY, fn)` from
  `src/utils/storageQueue.ts`, which serializes operations per storage key.
  **When you add or edit a storage mutator, wrap its read-modify-write in
  `runExclusive` under the relevant key.** If an operation touches two keys
  (e.g. deleting a faction also edits characters), wrap each key's section
  separately — never nest `runExclusive` calls for the _same_ key (it
  deadlocks). `characterStorage.applyMergedDataset` is the multi-key example:
  it sequences `runExclusive` across all five keys, one at a time.
- **Ruleset field migration:** `src/utils/rulesetFieldMigration.ts` holds
  pure, I/O-free normalizers that accept both the pre- and post-Phase-1
  field names (`species`→`archetypeId`, `perkIds`→`traitIds`,
  `distinctionIds`→`qualityIds`, `cyberware`→`modifications`,
  `junktownOffice`→`sponsor`).
  It also reshapes modification modifiers, which have now been through
  _three_ shapes: flat `statModifiers`, nested `resourceModifiers` (which
  shipped in #21, so real user data has it), and the current flat
  `modifier.attributeDeltas`. All three must stay readable. The non-obvious
  rule there: a cap keyed by a _resource_ id maps onto that resource's
  `capAttributeId` (`caps.health` → `attributeDeltas.healthCap`).
  One implementation serves the storage
  migration, file import, and GitHub sync, so they cannot disagree. Each
  normalizer returns the **same object reference** when nothing needed
  rewriting — callers use that to skip a write. `migrateRulesetFields()` in
  `characterStorage.ts` applies them to local storage, idempotently, locking
  the character and quest keys sequentially (never nested).
  **Sync normalizes all three sides** (base, local, remote) before
  `computeSyncPlan` diffs them; normalizing only the written side would
  report every character as conflicting on the first sync after upgrade.
- **Which repository sync talks to is env-driven**, not hardcoded:
  `DATA_REPO_OWNER` / `DATA_REPO_NAME` / `DATA_REPO_BRANCH` in
  `gitIntegration.ts` read `EXPO_PUBLIC_DATA_REPO_*` and default to the data
  library this code shipped against, so existing installs keep syncing where
  they always did. `DATA_REPO_SLUG` is the display form — screens must use it
  rather than naming a repository in a string.
- **GitHub sync conflict handling:** `src/utils/gitIntegration.ts` persists a
  three-way merge base (the dataset as it stood at the end of the last
  successful merge sync, plus the remote's commit SHA) alongside the existing
  `@github_config` file, so a later sync can tell "you changed this" apart
  from "they changed this" instead of only seeing current states. The actual
  merge decision logic is I/O-free and lives in `src/utils/syncMerge.ts`
  (`computeSyncPlan`/`applyResolutions`) — keep new merge/conflict logic
  there rather than growing it inside `gitIntegration.ts`. Network/offline
  failures are classified by `src/utils/syncErrors.ts`
  (`classifySyncError`) rather than surfaced as raw fetch error text.

## Ruleset layer

This is the seam a genre-neutral fork plugs into. The core model is now
ruleset-neutral: a character has an `archetypeId`, `traitIds`, `qualityIds`,
and `modifications`, and a quest has a `sponsor` — all plain strings and ids,
none of them a closed union. A ruleset supplies the actual archetypes,
traits, categories, qualities, and attributes — and since #22 a character may
also carry its own GM-defined attribute values.

`qualityIds` was the last of those to be stated as `string`. It used to read
`DistinctionId[]`, an alias derived from the Afterworlds distinction table —
which is what forced `models/types.ts` to import a content _value_ and made
`types.ts ↔ gameData.ts` circular. Note the alias already _denoted_ `string`
(the `AVAILABLE_DISTINCTIONS: Distinction[]` annotation defeats its
`as const`), so removing it changed no stored bytes and needed no migration.

Afterworlds data lives entirely under `src/rulesets/afterworlds/`, whose
`index.ts` derives a `RulesetDefinition` from the tables in `content/` via a
transform rather than a hand-written literal, so the two cannot drift.
**Treat everything under `content/` as content, not code.**

Ruleset _terminology overrides are also content_
(`rulesets/afterworlds/terminology.ts`). That ruleset maps
`modification.singular` to "Cyberware", `archetype.plural` to "Species", and
so on, which is the only reason the Junktown app still reads the way its
users expect after the Phase 1 renames. Renaming an engine field must never
drag those override _values_ along with it.

- `src/activeRuleset.ts` — **the registry that says which ruleset this build
  runs on.** `configureLore({ ruleset, assets })` writes it;
  `getActiveRuleset()` / `getActiveAssets()` read it. `RulesetProvider`'s
  defaults and every `ruleset: RulesetDefinition = getActiveRuleset()` default
  parameter resolve through it.
  It **used to export a constant**, which only worked while the engine and the
  flavor shared a tree. As a package the seam had to invert: a library cannot
  import its consumer's module, so the consumer pushes its ruleset in.
  **It is deliberately a module-level registry and not a provider prop.**
  Non-component code needs the active ruleset too —
  `characterStorage.migrateRulesetFields()` calls
  `normalizeCharactersRulesetFields(characters)` with no ruleset argument, and
  that default is what maps a legacy `caps.health` onto
  `attributeDeltas.healthCap`. A storage module can never read a React context,
  so folding this into `RulesetProvider` would silently degrade that migration
  for every ruleset but the built-in one.
  **Two consequences of it being mutable state.** Anything that captures the
  ruleset at _module load_ now captures the pre-configuration default —
  `context.tsx` therefore seeds its context with `undefined` and substitutes
  the registry inside `useRuleset()`, and `RulesetProvider` reads it in a
  default parameter (evaluated per render). And a migration that runs before
  `configureLore` normalizes real data against the example ruleset's attribute
  table, so `migrateRulesetFields` calls `warnIfUnconfigured()` to make that
  loud under `__DEV__`. Tests use `resetLoreConfig()` so one suite's ruleset
  cannot leak into the next.
  **Cycle rule:** this file, and anything under `src/rulesets/`, imports
  `@/ruleset/types` / `@/ruleset/attributes` / etc. **directly, never the
  `@/ruleset` barrel** — the barrel re-exports `context.tsx`, which imports
  the seam.
- `src/ruleset/exampleRuleset.ts` — what the engine ships as its default: a
  small, complete, generic ruleset. Two things about it are deliberate.
  It **overrides no terminology**, so every noun comes from
  `DEFAULT_TERMINOLOGY` and "the app boots with generic labels" is literally
  checkable — it is also the only place the `getLabel` fallback is exercised
  in a running app. And it declares **no map, with `features.map: false`**,
  because the map is the one feature needing a bundled binary and images
  belong to the ruleset that uses them; a placeholder PNG in the engine would
  be in every fork's way. Every other flag is on, so the engine's screens are
  reachable out of the box.
- `src/ruleset/attributes.ts` — the `AttributeValue` primitive (#22). A
  tagged union (`{ type, value }`) covering number/text/flag/ref/list/map,
  plus `AttributeDefinition`, typed accessors, and a generic bag validator.
  Deliberately **not** DynamoDB's wire encoding: DDB stringifies numbers for
  cross-SDK precision, which would only add a `parseFloat` at every
  arithmetic site. `ref` has no DDB counterpart and exists so the validator
  can check id integrity generically.
  **Roles (`resource` / `cap` / `capability` / `freeform`) are what keep this
  from becoming untyped soup** — the union is storage, roles are meaning, and
  `derived.ts` dispatches on role rather than on hardcoded ids. Which roles a
  modifier may touch is an _application_ rule in `derived.ts`, never a
  validity rule: the Afterworlds ruleset declares a trait cap delta the
  engine ignores, and flagging that as invalid would make `RulesetProvider`
  throw under `__DEV__` for any build running it.
- `src/ruleset/types.ts` — the `RulesetDefinition` schema (attributes,
  archetypes, traits, trait categories, qualities, category-bonus rules,
  feature flags, terminology). **Must stay JSON-serializable** — no functions, no
  `ImageSourcePropType`/`require()` results anywhere in the definition. That
  constraint is what keeps the backlogged in-app ruleset editor possible;
  `validate.ts` enforces it at runtime. Bundled images referenced by a
  ruleset (map, branding) go through the separate `RulesetAssets` map in
  `src/ruleset/assets.ts` instead, keyed by string.
- `src/ruleset/validate.ts` — `validateRuleset()` returns
  `{ valid, issues }` rather than throwing, so a future user-authored ruleset
  can surface errors in UI instead of crashing at startup. `RulesetProvider`
  throws on an invalid ruleset in `__DEV__` and logs-and-renders otherwise.
- `src/ruleset/context.tsx` — `RulesetProvider` / `useRuleset()`.
  **`useRuleset()` returns the _active_ ruleset outside a provider rather
  than throwing** — many screen tests render bare, and a throwing hook would
  require wrapping all of them. In this repo that is
  `src/ruleset/exampleRuleset.ts`, via `src/activeRuleset.ts`. Do not write a
  test that depends on which one it is: render through
  `tst/helpers/ruleset.tsx`'s `renderWithRuleset()`, whose own default is the
  neutral fixture.
- `src/ruleset/derived.ts` — `calculateDerivedStats(character, ruleset?)`
  returns `{ values, categoryScores, attributes }`. Order is load-bearing:
  archetype base attributes → **character attribute overrides (absolute, not
  deltas)** → trait deltas (`role: 'resource'` only) → category-bonus grants
  → modification deltas (`'resource'` and `'cap'`) → clamp each resource to
  its `capAttributeId`. Three behaviors are preserved deliberately and pinned
  by the parity suite: **traits cannot raise caps** (Afterworlds' `smarts_20`
  declares one and the engine has never honored it — now a consequence of the
  role rule rather than a special case), **modification `categoryDeltas` do
  not retroactively unlock category-bonus thresholds** since they land after
  grants, and **only resources with a `capAttributeId` clamp**. All three are
  arguably bugs; fixing any moves real users' numbers and is a rules change,
  not a refactor.
  Note the parity fixture cannot cover the character-attribute layer —
  Afterworlds declares none, so it is a no-op there. `tst/ruleset/
characterAttributes.test.ts` is the only proof that step 1b behaves.
- `src/ruleset/terminology.ts` — `useLabels()` (components) and `getLabel()`
  (non-component code — pure utils like `factionStats.ts`/`characterStats.ts`
  that take a `ruleset` parameter rather than importing one) look up a term
  key (`'trait.plural'`) against the ruleset's `terminology` overrides,
  falling back to a neutral default. Screens must not hardcode domain nouns
  (Species/Perk/Tag/Distinction/Cyberware/Junktown Office) — look them up so
  a different ruleset can say something else without a code change.
  The map's display name is `terminology['map.label']`; `RulesetDefinition.map`
  carries only `imageKey`, since two sources for one string only drift.
- `src/ruleset/features.ts` — `useFeature(key)` / `isFeatureEnabled(ruleset,
key)`, mirroring the `useLabels`/`getLabel` pair, plus `FEATURE_KEYS` as
  runtime data so `validate.ts` can iterate it (a `keyof` cannot). Flags gate
  **registration** in `src/navigation/AppNavigator.tsx`, not the param-list
  types in `navigation/types.ts`. Two traps: the drawer's `DrawerItem` list
  and its `Drawer.Screen` list are independent and both need gating, and a
  `navigate()` into an unregistered route throws at _runtime_ — so every
  caller into a gated route is gated at its call site too. Grep
  `navigation.navigate(` when adding a flag. Disabled features retain their
  data; turning a flag back on restores the screens intact.
- **`App.tsx` is the provider stack only.** The navigators live in
  `src/navigation/AppNavigator.tsx` because `App` renders `RulesetProvider`
  and therefore sits _outside_ it — nothing in `App.tsx` can call
  `useRuleset()`. Keep new navigator code in `AppNavigator.tsx`.
- `src/styles/chartPalette.ts` — the categorical palette for charts and
  legends. A ruleset may declare its own `TraitCategory.color`; this is the
  fallback, and it cycles so a ruleset with more categories than colors
  still gets a color for each rather than `undefined`.

## Conventions & gotchas

- **Style:** single quotes, semicolons, 2-space indent, 80-col, trailing
  commas, arrow parens omitted for a single param. Prettier is authoritative —
  run `npm run format`.
- **No `console.log`.** Debug logging was removed from the storage/discord
  utils; keep it out. `console.error` in a catch for genuine failures is fine
  (it lints as a warning, which is acceptable).
- **No `any`** — use precise types or `unknown` (lints as a warning).
- **Unused catch bindings:** use bare `catch {}` rather than `catch (error)`
  when the error is unused (eslint errors otherwise).
- **Dates:** event/date strings are `YYYY-MM-DD`. Parse and format them with the
  helpers in `src/utils/dateUtils.ts` (`parseDateString`, `formatEventDate*`).
  Never do `new Date('YYYY-MM-DD')` — it parses as UTC and shifts the day in
  local time zones (this caused a real off-by-one display bug).
- **Discord messages:** downloaded image URIs are on `DiscordMessage.imageUris`
  (there is no `images` field).
- **Bidirectional faction relationships:** creating/updating/deleting a faction
  relationship must keep the reciprocal relationship on the other faction in
  sync, and renaming a faction must update its references on characters and on
  other factions' relationships. See `updateFaction` / `createFaction` in
  `characterStorage.ts` for the pattern.
- **Quest ↔ event links:** `GameQuest.eventIds` and `GameEvent.questIds` are
  mirrored back-references, kept in sync by `addQuest`/`updateQuest`/
  `deleteQuest`/`addEvent`/`updateEvent`/`deleteEvent` in `characterStorage.ts`
  (see the "Quest <-> Event bidirectional link sync" section). Each side is a
  separate storage key, so a sync locks `EVENT_STORAGE_KEY` and
  `QUEST_STORAGE_KEY` **sequentially, never nested** — nesting a
  `runExclusive` call for a key inside a `runExclusive` call for the _other_
  key is fine (they're different keys), but never call `runExclusive` for the
  same key you're already inside, or it deadlocks. A partial update that omits
  `eventIds`/`questIds` must leave existing links alone, not clear them —
  mutators must gate the sync on `updates.eventIds !== undefined` /
  `updates.questIds !== undefined`. `reconcileQuestEventLinks()` backfills and
  prunes both sides for data written before the back-reference existed; call
  it (idempotently) from a list screen's load path, same as
  `migrateFactionDescriptions`.
- **Screens:** list/form/detail screens are built on the generics in
  `src/components/screens/`. Follow the existing feature folders rather than
  hand-rolling new layouts, and keep the dark theme from `styles/theme.ts`.
- **Relationship graph:** the node/edge model for the "Relationship Graph"
  screen lives in `src/utils/relationshipGraph.ts` (pure, no storage/theme
  deps). Node ids are namespaced (`character:<id>` / `faction:<name>` /
  `location:<id>`) because factions are name-keyed (`StoredFaction` has no
  `id`) while characters and locations are id-keyed. Faction nodes must be
  the union of `loadFactions()` and faction names embedded on characters —
  mirror `FactionListScreen`'s pattern — since `migrateFactionDescriptions()`
  only backfills factions that had a non-empty embedded description. This
  screen is the first direct `react-native-svg` consumer in `src/`; it
  renders under Jest without any mock (`Circle`/`G` support `onPress` and
  `accessibilityLabel` directly). Layout (`computeGraphLayout`) runs d3-force
  forces through a manual synchronous tick loop — deliberately NOT
  `forceSimulation()`, whose constructor auto-starts an async d3-timer
  stepper that leaks a frame callback into Jest teardown. Determinism is a
  documented, tested contract: circle-seeded positions in stable (type, id)
  order plus a seeded PRNG passed to each force's `initialize`. Edge rest
  distances are standing-aware (`standingDistanceFactor`: Ally/Friend
  shorter, Hostile/Enemy longer; the worse side of a disputed relationship
  wins). The layout is an infinite canvas: positions are never clamped —
  `computeGraphLayout` returns `{ nodes, size }` where `size` is the natural
  content extent, and `GraphCanvas` pans/zooms it (`contentSize` vs
  `containerSize` — content must stay centered for `clampTranslation`'s
  symmetric bounds to hold). Tapping a node navigates straight to its detail
  screen; long-press opens the info card (Focus / View details). Node taps
  are detected by canvas-level RNGH Tap/LongPress gestures that invert the
  pan/zoom transform (`containerPointToNormalized`) and hit-test node
  centers — SVG-element `onPress` does not fire reliably on-device inside a
  `GestureDetector`; the marker handlers remain only as a deduplicated
  fallback (and for tests/accessibility). User-tunable spacing plus the
  persisted Retired / Hide-isolated filter toggles live in
  `src/utils/graphPreferences.ts` (key `gameCharacterManager_graph_prefs`);
  sliders in `GraphSettingsPanel` (`@react-native-community/slider`). Note
  `getGraphPreferences` is deliberately **not** wrapped in `runExclusive` —
  it is a read, and wrapping it would queue behind a pending write it does
  not need to wait for; the two mutators are wrapped. The d3 packages and
  `@react-native-community` are allow-listed in `jest.config.js`'s
  `transformIgnorePatterns` (ESM-only, like `uuid`), and the gesture-handler
  mock in `jest.setup.js` needs `Gesture.Exclusive` — without it the screen
  throws during render and every test reports the unmount rather than the
  cause.

## Testing

- Jest with `jest-expo`; tests live in `tst/` mirroring `src/`.
- Storage tests mock `SafeAsyncStorageJSONParser`
  (`jest.mock('@/utils/safeAsyncStorageJSONParser')`) and `uuid`. Many tests
  assert on an ordered sequence of `getItem` calls via `mockResolvedValueOnce`,
  so if you change the order/number of storage reads in a function, update the
  corresponding mocks.
- Add tests for new storage behavior and bug fixes. For concurrency-sensitive
  code, see `tst/utils/storageQueue.test.ts` and
  `tst/utils/characterStorage.concurrency.test.ts` for the stateful-store
  pattern that proves serialization.
- **The rule: a test may not depend on which ruleset is the default. Pass one
  explicitly.** Asserting against whatever the build happens to ship proves
  the app works for exactly one ruleset. There are three to choose from, with
  different jobs:
  - **`tst/fixtures/genericRuleset.ts` — proves a _screen reads the
    provider_.** Different archetypes, three resources instead of two, three
    trait categories one of which has no color, and several `features` off,
    so a screen reaching past the provider fails visibly rather than passing
    by coincidence. This is `renderWithRuleset()`'s default
    (`tst/helpers/ruleset.tsx`), so "no argument" means "any ruleset".
  - **`tst/fixtures/mechanicsRuleset.ts` — proves the _engine computes_.**
    Carries what `derived.ts`'s pipeline needs and the generic fixture
    deliberately lacks: category bonuses at two thresholds, an
    `archetypeRules` carve-out whose group membership exactly matches a
    trait's `allowedArchetypeIds`, a trait declaring a cap delta the engine
    must ignore, and a resource with no cap.
  - **`@/rulesets/afterworlds` — the fork regression guard.** Asserted in
    exactly two files: `tst/rulesets/afterworlds.test.ts` (the ruleset itself,
    including the terminology overrides that keep the app reading
    "Species"/"Perks"/"Junktown Office") and
    `tst/utils/derivedStats.parity.test.ts` (the 27 pre-generalization
    numbers). Keep it out of the rest — the suite had drifted to thirteen
    files before Phase 4 pulled it back, and every one of those was a file
    that would have had to move when the flavor does.

  All four — the three above plus `src/ruleset/exampleRuleset.ts` — are proved
  pairwise id-disjoint in `tst/fixtures/genericRuleset.test.ts`; a shared id is
  exactly how a test passes while asserting on a value that came from somewhere
  else. That file's Afterworlds row is the only other place the flavor is
  named, and dropping it is a one-line edit — see `docs/ruleset-authoring.md` →
  "Extracting a flavor" for the full list of what moves.

- `Picker.Item` children collapse into an `items` prop on the host
  `RNCPicker` and render **no queryable text** — read option labels off
  `UNSAFE_getAllByType('RNCPicker')[…].props.items` rather than reaching for
  `getByText`.
- A screen that gates a spinner behind `useFocusEffect` needs
  `installFocusEffectOnce()` (`tst/helpers/navigation.ts`); the global mock
  re-fires every render and turns that gate into a render loop. Both stats
  screens need it.
- `tst/navigation/AppNavigator.test.tsx` mocks `createDrawerNavigator` /
  `createStackNavigator` into pass-throughs that surface each route's `name`
  as text, so route _registration_ is assertable without mounting twenty real
  screens. `MainDrawer` gets its own render there: it is registered as
  `component={MainDrawer}` on a stack screen, so the stack render never
  reaches it.

### Coverage reporting

- `npm run test:coverage` runs Jest with coverage; `.github/workflows/coverage.yml`
  runs it on every PR and posts a sticky comment scoped to changed files. It is
  **informational only** — no threshold is enforced yet, so it never blocks a PR.
- `jest.config.js`'s `collectCoverageFrom` covers all of `src/utils`,
  `src/components`, and `src/screens` (index files excluded) — nothing is
  hidden from the report. Two config details matter for this to actually
  work: `roots` must include `<rootDir>/src` (not just `<rootDir>/tst`), or
  Jest silently omits zero-coverage rows for any file no test imports; and
  `transformIgnorePatterns` must allow-list `expo-.*`, `@octokit`, and
  `gifted-charts-core` (not just bare `expo`, and not just the
  `react-native-gifted-charts` wrapper), since `expo-file-system`,
  `@octokit/rest`, and gifted-charts' own core package ship ESM and would
  otherwise fail to parse the moment anything imports them. Allow-listing a
  wrapper is not enough — its ESM dependency needs listing too.
- Real baseline as of this writing: **~69.6% statements / ~65.4% functions**
  — flat across the Phase 3 extraction, which is the point: `src/rulesets/**`
  joined `collectCoverageFrom` in the same change that moved a well-covered
  file into it, so the denominator moved and the ratio did not. (Was
  ~66%/~61% before the Phase 2 UI decoupling added screen tests, ~54%/~51%
  before the Phase 1 migration work; before that ~26%, and previously
  misreported as ~75% because most of `src/screens` and several `src/utils`
  modules were invisible to the report — see the config details above.)

### Test coverage gaps

Ranked by value if you're looking for where to add tests next (highest
blast-radius / lowest-effort first):

1. **`src/utils/exportImport.ts`** (~11% covered) — the plain-JSON path of
   `importCharacterData`/`mergeCharacterData` is now tested (see
   `tst/utils/exportImport.test.ts`; note `jest.setup.js` mocks
   `expo-file-system/legacy`, the specifier this file actually imports, not
   bare `expo-file-system`). Still untested: `exportCharacterData` and the
   `.zip` branches of import/merge — all need `react-native-zip-archive` +
   directory-walking (`makeDirectoryAsync`/`copyAsync`/`getInfoAsync`/
   `readDirectoryAsync`) + `expo-sharing` mocked.
2. **`src/utils/discordApi.ts`** and **`src/utils/discordCharacterExtraction.ts`**
   (untested) — parsing/ingesting external Discord data; boundary-parsing
   bugs are likely here.

Done since the list above was last written:

- ~~`src/screens/FactionStatsScreen.tsx`~~, ~~`CharacterStatsScreen.tsx`~~,
  ~~`CharacterSearchScreen.tsx`~~ and ~~navigation registration~~ — added in
  Phase 2, all rendered against `tst/fixtures/genericRuleset.ts` so they
  assert genre-neutrality rather than Afterworlds trivia. The stats screens
  need `installFocusEffectOnce()`; `CharacterStatsScreen` also mocks
  `react-native-gifted-charts` to surface slice data as text, since the real
  PieChart renders to SVG and swallows it.
- ~~`src/utils/gitIntegration.ts`~~ (GitHub-backed sync, was the highest
  blast-radius gap) — covered by `tst/utils/gitIntegration.test.ts`, using a
  hand-rolled Octokit test double (`tst/helpers/octokit.ts`) since the module
  has no dependency-injection seam (`new Octokit({ auth })` internally); any
  test touching it needs `jest.mock('@octokit/rest', () => ({ Octokit:
jest.fn() }))` rather than a bare automock, or Jest tries to load the real
  package and fails on its ESM `universal-user-agent` dependency. Conflict
  detection and merging now live in `src/utils/syncMerge.ts` (pure, no I/O —
  see `tst/utils/syncMerge.test.ts`) and error classification in
  `src/utils/syncErrors.ts` (`tst/utils/syncErrors.test.ts`).
- ~~`src/components/screens/BaseDetailScreen.tsx`/`BaseFormScreen.tsx`~~ and
  every templated character/faction/location/events/quest detail/form/list
  screen — contract-based tests via `tst/helpers/screenContracts.ts`
  (`describeListScreenContract`/`describeDetailScreenContract`/
  `describeFormScreenContract`).
- ~~`src/utils/discordStorage.ts`~~ — was untested and had the same
  unwrapped read-modify-write bug `characterStorage.ts` had (no
  `runExclusive`); both the bug and the test gap are fixed
  (`tst/utils/discordStorage.test.ts` +
  `tst/utils/discordStorage.concurrency.test.ts`).
- ~~`src/utils/influenceAnalysis.ts`~~ and ~~`src/utils/factionStats.ts`~~ —
  pure computation, now covered by `tst/utils/influenceAnalysis.test.ts` and
  `tst/utils/factionStats.test.ts`. The one async export,
  `analyzeFactionInfluence`, does a lazy `await import('@utils/characterStorage')`
  — Jest's CommonJS transform doesn't lower dynamic `import()` on its own, so
  `babel.config.js` adds `babel-plugin-dynamic-import-node` under the `test`
  env to make it work under test (Metro/production builds are unaffected).
- ~~`src/screens/discord/`~~ (all 6 screens) and ~~`LocationMapScreen.tsx`~~ —
  bespoke tests (these don't fit the generic list/detail/form contracts) in
  `tst/screens/discord/*.test.tsx` and
  `tst/screens/location/LocationMapScreen.test.tsx`. Two reusable additions
  came out of this: `installFocusEffectOnce()` (`tst/helpers/navigation.ts`)
  for screens that gate a loading spinner behind `useFocusEffect` (the global
  mock re-fires on every render, which bounces that gate into a real
  render-phase update loop), and local per-file mocks for
  `react-native-reanimated`/`react-native-gesture-handler` for the one screen
  using shared-value animations and gesture composition.

## Scope discipline

Prefer reusing existing utilities over adding new ones. Data-storage format
changes, navigation restructures, and new native dependencies are
higher-risk — call them out explicitly and keep them minimal.

**App identity values are not yours to change.** Lore's slug and bundle
identifier were minted by #15 and are now the defaults in `src/branding.ts`;
changing them affects EAS builds and orphans installed apps, since an install
does not upgrade across a package rename. A different identity is a `.env`
value, never an edit here.

**Documentation lives in two places, deliberately.** This file is for whoever
is changing the code; `docs/` is for whoever is using or deploying it. A fact
that belongs in both (the consumer-owned surface, the derived-stat pipeline order)
should be stated once and referenced from the other — `docs/ruleset-authoring.md`
is the user-facing counterpart to "Engine vs consumer" and "Ruleset layer";
`docs/consuming-lore.md` is the counterpart for depending on the package.

Always leave `npm run check-all` green.
