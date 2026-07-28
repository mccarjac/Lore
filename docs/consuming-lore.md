# Using Lore as a dependency

Lore ships as a package. An app that wants the engine installs it, supplies a
ruleset, and renders one component — it does not fork the screens or vendor the
code.

This is the alternative to maintaining a fork. Picking up engine work becomes a
version bump rather than a merge.

## Install

```bash
npm install github:mccarjac/lore#main
```

A git dependency rather than a registry package: there is nothing to publish,
nothing to authenticate, and `npm ci` on a clean EAS build machine resolves it
like any other dependency. npm runs Lore's `prepare` script at install time,
which compiles the library — so you get built output without a build step of
your own.

Pin a tag or commit rather than a branch when you want reproducible builds:

```json
"lore": "github:mccarjac/lore#v1.2.0"
```

Bumping is then a deliberate edit plus `npm install`.

## Peer dependencies

Lore declares its runtime dependencies as **peers**, because React Native
native modules cannot be duplicated in a nested `node_modules` — they have to
be installed by the app. Your `package.json` needs all of these:

| Package                                     | Range      |
| ------------------------------------------- | ---------- |
| `@octokit/rest`                             | `^22.0.1`  |
| `@react-native-async-storage/async-storage` | `2.2.0`    |
| `@react-native-community/slider`            | `5.0.1`    |
| `@react-native-picker/picker`               | `2.11.1`   |
| `@react-navigation/drawer`                  | `^7.7.0`   |
| `@react-navigation/native`                  | `^7.1.18`  |
| `@react-navigation/stack`                   | `^7.4.10`  |
| `buffer`                                    | `^6.0.3`   |
| `d3-force`                                  | `^3.0.0`   |
| `expo`                                      | `~54.0.0`  |
| `expo-document-picker`                      | `~14.0.8`  |
| `expo-file-system`                          | `~19.0.23` |
| `expo-image-picker`                         | `~17.0.11` |
| `expo-linear-gradient`                      | `~15.0.8`  |
| `expo-sharing`                              | `~14.0.8`  |
| `process`                                   | `^0.11.10` |
| `react`                                     | `19.1.0`   |
| `react-dom`                                 | `19.1.0`   |
| `react-native`                              | `0.81.5`   |
| `react-native-gesture-handler`              | `~2.28.0`  |
| `react-native-get-random-values`            | `~1.11.0`  |
| `react-native-gifted-charts`                | `^1.4.64`  |
| `react-native-markdown-display`             | `^7.0.2`   |
| `react-native-reanimated`                   | `4.1.3`    |
| `react-native-safe-area-context`            | `~5.6.0`   |
| `react-native-screens`                      | `~4.16.0`  |
| `react-native-svg`                          | `15.12.1`  |
| `react-native-web`                          | `~0.21.0`  |
| `react-native-worklets`                     | `0.5.1`    |
| `react-native-worklets-core`                | `1.6.2`    |
| `react-native-zip-archive`                  | `^7.0.2`   |
| `readable-stream`                           | `^4.7.0`   |
| `uuid`                                      | `^13.0.0`  |

`@octokit/rest` and `react-native-zip-archive` are optional — omit them if you
disable the `gitSync` feature and never export a `.zip`. So are `react-dom` and
`react-native-web`, needed only if you build for web.

**Every range above that Expo manages is copied verbatim from the SDK**, not
chosen. `node_modules/expo/bundledNativeModules.json` lists the versions Expo's
prebuilt native side was compiled against, and for a package with a native half
that file is the only authority — the JS you bundle has to match the binary you
launch. `tst/packagePeers.test.ts` asserts the whole table against it, so a
drifting range fails Lore's own suite rather than your app's launch.

There is exactly one deliberate deviation, and it is instructive.
`react-native-reanimated` is pinned to `4.1.3` where the SDK says `~4.1.1`,
because `~4.1.1` admits 4.1.7 — and 4.1.7 _depends on_ `react-native-worklets`
0.8.x while SDK 54's native worklets is 0.5.1. See
[the crash below](#the-app-crashes-on-launch-with-installturbomodule).

**Install with `npx expo install <pkg>`, not `npm install`,** and run
`npx expo install --check` after any dependency change. Expo picks the version
its SDK actually ships; npm picks the newest thing your range allows, and for a
native module those are two different questions. A `^` range also lets npm
choose a release whose _own_ React Native peer excludes the SDK's —
`react-native-reanimated@4.5.3` requires React Native 0.83–0.86, which Expo 54
does not use, and the install fails with an `ERESOLVE` wall of text that names
reanimated without explaining why.

## Wire it up

Two calls. `configureLore` registers your ruleset; `LoreApp` is the whole app.

```tsx
// index.ts
import { registerRootComponent } from 'expo';
import { configureLore } from 'lore';
import { myRuleset } from './src/rulesets/myflavor';
import { myAssets } from './src/rulesets/myflavor/assets';
import App from './App';

// Before registerRootComponent, and before any storage call — see below.
configureLore({ ruleset: myRuleset, assets: myAssets });

registerRootComponent(App);
```

```tsx
// App.tsx
import React from 'react';
import { LoreApp } from 'lore';

export default function App() {
  return <LoreApp />;
}
```

That is the entire app. Everything else — screens, navigation, storage, sync —
comes from the package.

### Configure before anything reads storage

The engine holds the active ruleset in a module-level registry rather than a
React context, because non-component code needs it: `migrateRulesetFields()`
normalizes stored fields using the ruleset's **attribute table**. Run that
migration before `configureLore` and it will use the example ruleset — quietly
rewriting real data against the wrong table.

Lore warns about exactly this in development (`[lore] migrateRulesetFields ran
before configureLore()`). Treat that message as a bug in your entry file, not
as noise.

## What you can import

`lore` exports two entry points, and those are the supported surface. The main
one, `lore`, is the app:

- `LoreApp`, `configureLore`, `getActiveRuleset`, `getActiveAssets`
- the ruleset layer — `RulesetDefinition` and its member types, the attribute
  primitive (`num`/`text`/`flag`/`ref`, `roleOf`, the typed getters),
  `RulesetProvider`, `useRuleset`, `useLabels`, `getLabel`, `useFeature`,
  `validateRuleset`, `calculateDerivedStats`, `exampleRuleset`
- the domain types — `GameCharacter`, `GameEvent`, `GameLocation`, `GameQuest`,
  and friends
- storage entry points and the pure utilities a flavor's own tests need
- the component library and the theme, if you want to compose your own screens

The second, `lore/ruleset`, is the same ruleset layer with no React Native
behind it — the schema, the attribute primitive, the domain types and the pure
functions, and nothing that pulls in a native module. Import from it in your
ruleset's own unit tests: `lore` reaches gesture-handler on the way to
`LoreApp`, which a plain Node/jest environment cannot load.

```ts
import { validateRuleset, type RulesetDefinition } from 'lore/ruleset';
```

**Do not import deep paths** (`lore/lib/utils/…`). Only those two entries are
published in the `exports` map, so deep paths will not resolve — and that is
deliberate: anything not re-exported from an entry point is internal and moves
without notice.

## Writing the ruleset

See [ruleset-authoring.md](./ruleset-authoring.md). Everything there applies
unchanged; the only difference is that your ruleset lives in your repository
and reaches the engine through `configureLore` instead of `src/activeRuleset.ts`.

## Bumping

```bash
# edit the ref in package.json, then
npm install
npm run check-all
```

Read Lore's release notes for changes to `RulesetDefinition`, to derived-stat
computation, or to the peer set — those are the three that can require work on
your side. A peer-range change is treated as breaking.

## Troubleshooting

### The app crashes on launch with `installTurboModule`

```
[runtime not ready]: Error: Exception in HostFunction: TurboModule method
"installTurboModule" called with 1 arguments (expected argument count: 0).
stack: NativeWorklets@…
```

The JS `react-native-worklets` does not match the native worklets compiled
into the binary you are running (Expo Go, or a dev client). `installTurboModule`
gained a parameter between 0.5 and 0.8, so the JS side calls it with an
argument the native side does not accept.

Almost always this means reanimated floated up a patch version:
`react-native-reanimated@4.1.7` **depends on** `react-native-worklets@0.8.x`,
while SDK 54's native side is built against `0.5.1`. Reanimated 4.1.3 does not
declare worklets at all, which is why the app has to pin it.

Fix by pinning all three exactly, as in the table above:

```json
"react-native-reanimated": "4.1.3",
"react-native-worklets": "0.5.1",
"react-native-worklets-core": "1.6.2"
```

then `rm -rf node_modules package-lock.json && npm install`. Confirm with
`npm ls react-native-worklets` that exactly one copy at 0.5.1 is installed.

**`npx expo install --check` catches this class of problem** before you launch,
by validating every native package against what the SDK actually ships. Run it
after any dependency change.

### `Gradient package was not found`

```
[runtime not ready]: Error: Gradient package was not found. Make sure
"react-native-linear-gradient" or "expo-linear-gradient" is installed
```

Install `expo-linear-gradient`. Nothing in Lore imports it: the charts on the
stats screens come from `react-native-gifted-charts`, which picks a gradient
backend with a `require()` in a `try`/`catch` — bare-RN first, Expo second.
Metro treats a `require()` inside `try`/`catch` as optional, so the bundle
builds clean and the failure waits until the chart renders.

`react-native-linear-gradient` would also satisfy it, but it is not an SDK 54
package — on an Expo app `expo-linear-gradient` is the one to install.

This is the general shape of a peer Lore cannot discover by reading its own
imports, which is why `tst/packagePeers.test.ts` works from what Lore
_installs_ rather than from what `src/` imports.

**`ERESOLVE` on install** — a native module resolved to a version whose React
Native peer excludes your SDK's. Use `npx expo install` for the package it
names.

**`ERESOLVE` naming `react-test-renderer`** — `@testing-library/react-native`
leaves it unpinned, so npm takes the newest, which wants a React newer than the
SDK's. Add `"react-test-renderer": "19.1.0"` to your devDependencies to match
`react`.

**`Unable to resolve "lore"`** — Metro needs package-`exports` support, which is
on by default from React Native 0.79 / Expo 53. On anything older, enable
`unstable_enablePackageExports` in `metro.config.js`.

**The app shows "Archetype" and "Trait" instead of your own nouns** —
`configureLore` has not run, or ran after render. It belongs in the entry file,
above `registerRootComponent`.

**A screen you expect is missing** — feature flags gate route registration.
Check the `features` block of your ruleset.
