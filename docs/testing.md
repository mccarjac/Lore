# Testing

Jest (`jest-expo` preset) with `@testing-library/react-native`. Tests live in
`tst/`, mirroring `src/`.

```bash
npm test                 # the suite
npm run test:watch       # re-run on change
npm run test:coverage    # + coverage report in coverage/
npm run check-all        # type-check + lint + format:check + test — the gate
```

`npm run check-all` must be green before you commit, and CI runs the same
checks on every PR.

> The conventions that will actually bite you — which ruleset a test may
> assume, the storage-mock ordering rule, `Picker.Item`, `useFocusEffect` —
> are in [AGENTS.md](../AGENTS.md) under **Testing**. This document covers
> layout and mechanics.

## Layout

```
tst/
  fixtures/     rulesets to test against (see below) + derived-stat baselines
  helpers/      renderWithRuleset, screen contracts, navigation, octokit double
  components/   common/ and screens/ (the Base*Screen generics)
  screens/      per-feature screen tests
  ruleset/      the engine: attributes, derived stats, validation, terminology
  navigation/   route registration
  utils/        storage, sync, stats, search, import/export
```

## Pick a ruleset deliberately

**No test may depend on which ruleset the build ships.** Pass one:

- `tst/fixtures/genericRuleset.ts` — proves a **screen reads the provider**.
  Different archetypes, three resources, a colorless trait category, several
  features off. It is `renderWithRuleset()`'s default.
- `tst/fixtures/mechanicsRuleset.ts` — proves the **engine computes**. Category
  bonuses at two thresholds, an archetype carve-out, a trait declaring a cap
  delta the engine must ignore, a resource with no cap.

There is no third fixture, and deliberately no bundled flavor: a test that
asserts on one only proves the app works for that one game. The engine's
former flavor now lives in its own repository, and takes its derived-stat
parity suite with it.

All are proved pairwise id-disjoint in `tst/fixtures/genericRuleset.test.ts` —
a shared id is exactly how a test passes while asserting on a value that came
from somewhere else.

## Helpers worth knowing

- `renderWithRuleset()` (`tst/helpers/ruleset.tsx`) — renders inside a
  `RulesetProvider`.
- `describeListScreenContract` / `describeDetailScreenContract` /
  `describeFormScreenContract` (`tst/helpers/screenContracts.ts`) — the
  list/detail/form screens are templated, so their tests are too.
- `installFocusEffectOnce()` (`tst/helpers/navigation.ts`) — required by any
  screen that gates a spinner behind `useFocusEffect`; the global mock re-fires
  every render and turns that gate into a render loop.
- `tst/helpers/octokit.ts` — a hand-rolled Octokit double, since
  `gitIntegration.ts` constructs its client internally.

## Writing tests

Mirror the source path: `src/utils/foo.ts` → `tst/utils/foo.test.ts`.

Storage tests mock the parser rather than AsyncStorage:

```typescript
jest.mock('@/utils/safeAsyncStorageJSONParser');
```

Many of them assert an ordered sequence of `getItem` calls via
`mockResolvedValueOnce`, so changing the order or number of reads in a storage
function means updating those mocks.

For concurrency-sensitive code, copy the stateful-store pattern in
`tst/utils/storageQueue.test.ts` and
`tst/utils/characterStorage.concurrency.test.ts` — it is what actually proves
`runExclusive` serializes.

Screen tests mock storage and navigation, render, then `waitFor` the load:

```typescript
jest.mock('@utils/characterStorage', () => ({ loadCharacters: jest.fn() }));

it('loads on mount', async () => {
  (characterStorage.loadCharacters as jest.Mock).mockResolvedValue([]);
  renderWithRuleset(<MyScreen />);
  await waitFor(() => expect(characterStorage.loadCharacters).toHaveBeenCalled());
});
```

## Coverage

`npm run test:coverage`; `.github/workflows/coverage.yml` runs it on every PR
and posts a sticky comment scoped to the changed files. **No threshold is
enforced**, so coverage never blocks a merge — the intent is to add one back
once the gaps listed in AGENTS.md are closed.

`collectCoverageFrom` covers `src/utils`, `src/components`, `src/screens` and
`src/ruleset` (index files excluded), and `roots` includes
`<rootDir>/src` so files no test imports still show up as real 0% rows instead
of vanishing from the report.

## Troubleshooting

**Failures only locally** — `npm ci`, then `npx jest --clearCache`. Node 20+.

**A module fails to parse** — it ships ESM and needs allow-listing in
`transformIgnorePatterns`. Allow-listing a wrapper is not enough; its ESM
dependency needs listing too (this is why `expo-.*`, `@octokit`,
`gifted-charts-core` and `uuid` are all named there).

**Import paths** — use the aliases (`@/`, `@components/`, `@screens/`,
`@models/`, `@utils/`). They are declared in three places that must stay in
sync: `tsconfig.json`, `babel.config.js`, and `jest.config.js`'s
`moduleNameMapper`.
