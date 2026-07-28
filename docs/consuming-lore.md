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
| `@react-native-async-storage/async-storage` | `^2.2.0`   |
| `@react-native-community/slider`            | `^5.2.0`   |
| `@react-native-picker/picker`               | `^2.11.4`  |
| `@react-navigation/drawer`                  | `^7.7.0`   |
| `@react-navigation/native`                  | `^7.1.18`  |
| `@react-navigation/stack`                   | `^7.4.10`  |
| `buffer`                                    | `^6.0.3`   |
| `d3-force`                                  | `^3.0.0`   |
| `expo`                                      | `~54.0.0`  |
| `expo-document-picker`                      | `~14.0.7`  |
| `expo-file-system`                          | `~19.0.17` |
| `expo-image-picker`                         | `~17.0.8`  |
| `expo-sharing`                              | `~14.0.7`  |
| `react`                                     | `19.1.0`   |
| `react-native`                              | `0.81.5`   |
| `react-native-gesture-handler`              | `~2.28.0`  |
| `react-native-get-random-values`            | `~1.11.0`  |
| `react-native-gifted-charts`                | `^1.4.64`  |
| `react-native-markdown-display`             | `^7.0.2`   |
| `react-native-reanimated`                   | `4.1.3`    |
| `react-native-safe-area-context`            | `~5.6.0`   |
| `react-native-screens`                      | `~4.16.0`  |
| `react-native-svg`                          | `15.12.1`  |
| `react-native-worklets`                     | `0.5.1`    |
| `react-native-worklets-core`                | `1.6.2`    |
| `react-native-zip-archive`                  | `^7.0.2`   |
| `uuid`                                      | `^13.0.0`  |

`@octokit/rest` and `react-native-zip-archive` are optional — omit them if you
disable the `gitSync` feature and never export a `.zip`.

**Some of these are pinned to an exact version, not a range.** Anything whose
JS half has to match a _native_ half compiled into the app binary is exact:
React Native itself, `react-native-svg`, and the reanimated/worklets trio. A
range there is not flexibility, it is a crash waiting for a patch release —
see [Worklets](#the-app-crashes-on-launch-with-installturbomodule) below.

**Install them with `npx expo install <pkg>`, not `npm install`.** Expo picks
the version its SDK actually ships. This matters more than it sounds: the
native-module ranges above are `~` rather than `^` precisely because a
`^` range lets npm choose a newer release whose _own_ React Native peer
excludes the SDK's version — `react-native-reanimated@4.5.3` requires React
Native 0.83–0.86, which Expo 54 does not use, and the install fails with an
`ERESOLVE` wall of text that names reanimated without explaining why.

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

`lore` exports one entry point, and that is the supported surface:

- `LoreApp`, `configureLore`, `getActiveRuleset`, `getActiveAssets`
- the ruleset layer — `RulesetDefinition` and its member types, the attribute
  primitive (`num`/`text`/`flag`/`ref`, `roleOf`, the typed getters),
  `RulesetProvider`, `useRuleset`, `useLabels`, `getLabel`, `useFeature`,
  `validateRuleset`, `calculateDerivedStats`, `exampleRuleset`
- the domain types — `GameCharacter`, `GameEvent`, `GameLocation`, `GameQuest`,
  and friends
- storage entry points and the pure utilities a flavor's own tests need
- the component library and the theme, if you want to compose your own screens

**Do not import deep paths** (`lore/lib/utils/…`). Only `.` is published in the
`exports` map, so they will not resolve — and that is deliberate: anything not
re-exported from the entry point is internal and moves without notice.

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

**`ERESOLVE` on install** — a native module resolved to a version whose React
Native peer excludes your SDK's. Use `npx expo install` for the package it
names.

**`Unable to resolve "lore"`** — Metro needs package-`exports` support, which is
on by default from React Native 0.79 / Expo 53. On anything older, enable
`unstable_enablePackageExports` in `metro.config.js`.

**The app shows "Archetype" and "Trait" instead of your own nouns** —
`configureLore` has not run, or ran after render. It belongs in the entry file,
above `registerRootComponent`.

**A screen you expect is missing** — feature flags gate route registration.
Check the `features` block of your ruleset.
