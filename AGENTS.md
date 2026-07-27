# AGENTS.md

Guidance for AI coding agents working in this repository. Keep it accurate —
update it when conventions change.

## What this is

**Junktown Intelligence** is a React Native / Expo mobile app (TypeScript,
strict mode) for managing tabletop-RPG / LARP campaign data: characters,
factions, locations, events, plus Discord message ingestion and GitHub-backed
data sync. All data lives locally in AsyncStorage; there is no backend.

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
CI (`.github/workflows/build-apk.yml`, on push to `master`) runs `type-check`,
`lint`, and `test` before building the APK, so a red gate fails the build — do
not rely on the pre-commit hook alone (it only checks staged files and is
bypassable).

## Layout

```
src/
  components/common/    reusable UI (Card, Section, Header*Button, ...)
  components/screens/   Base{List,Form,Detail}Screen — generic screen scaffolds
  screens/<feature>/    character/ faction/ location/ events/ discord/
  models/               types.ts (all domain types); gameData.ts +
                        speciesTypes.ts are Afterworlds *content* (see #13)
  ruleset/              attribute primitive, pluggable ruleset schema,
                        provider, validator, terminology, derived stats
  navigation/           types.ts (navigator + param-list types) and
                        AppNavigator.tsx (the whole navigation tree)
  styles/               theme.ts (colors/spacing/typography), commonStyles.ts
  utils/                storage, export/import, discord, git, stats
tst/                    Jest tests, mirroring src/
```

Path aliases (tsconfig + babel-plugin-module-resolver): `@/*` → `src/*`, plus
`@components/*`, `@screens/*`, `@models/*`, `@utils/*`. Use them.

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

Afterworlds data still lives in `gameData.ts` and `speciesTypes.ts`, and
`src/ruleset/defaultRuleset.ts` derives a `RulesetDefinition` from it via a
transform rather than a hand-written literal, so the two cannot drift.
**Treat those two files as content, not code** — they are moved wholesale to
`src/rulesets/afterworlds/` and deleted in #13. `speciesTypes.ts` could not
be folded into the ruleset during Phase 1 because `gameData.ts` imports its
`Species` type and group arrays, and inverting that would make
`gameData → defaultRuleset → gameData` circular.

Ruleset _terminology overrides are also content_. The Afterworlds ruleset
maps `modification.singular` to "Cyberware", `archetype.plural` to "Species",
and so on, which is the only reason the Junktown app still reads the way its
users expect after the Phase 1 renames. Renaming an engine field must never
drag those override _values_ along with it.

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
  validity rule: the shipped Afterworlds ruleset declares a trait cap delta
  the engine ignores, and flagging that as invalid would make
  `RulesetProvider` throw under `__DEV__`.
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
  **`useRuleset()` returns the default Afterworlds ruleset outside a
  provider rather than throwing** — every screen test in `tst/` renders
  bare, and a throwing hook would require wrapping all of them. Use
  `tst/helpers/ruleset.tsx`'s `renderWithRuleset()` for a test that needs a
  non-default ruleset.
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
  `accessibilityLabel` directly).

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
- **`tst/fixtures/genericRuleset.ts` is how a screen proves it reads the
  provider.** It shares no ids with Afterworlds — different archetypes,
  three resources instead of two, three trait categories one of which has no
  color, and several `features` off — so a screen still reaching for
  `AVAILABLE_PERKS` or `SPECIES_BASE_STATS` fails visibly instead of passing
  by coincidence. Render through `renderWithRuleset()`
  (`tst/helpers/ruleset.tsx`). Asserting only against Afterworlds proves the
  app works for exactly one ruleset.
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
- Real baseline as of this writing: **~69% statements / ~65% functions**
  (was ~66%/~61% before the Phase 2 UI decoupling added screen tests,
  ~54%/~51% before the Phase 1 migration work; before that ~26%, and
  previously misreported as ~75% because most of `src/screens` and several
  `src/utils` modules were invisible to the report — see the config details
  above).

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
higher-risk — call them out explicitly and keep them minimal. Always leave
`npm run check-all` green.
