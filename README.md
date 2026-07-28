<div align="center">

# Lore

**A genre-neutral React Native engine for tabletop RPG, LARP and worldbuilding
campaign data**

[![React Native](https://img.shields.io/badge/React%20Native-0.81.5-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-54.0.23-000020.svg)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

</div>

---

Lore tracks the things a campaign accumulates — characters, factions,
locations, events, quests — with the relationships between them, statistics
over them, Discord ingestion, and GitHub-backed sharing. Everything lives
locally on the device; there is no backend and no account.

**The rules and vocabulary come from a ruleset, not from the code.** Archetypes,
traits, qualities, attributes, what they are all called, and which subsystems
exist at all are data. Point the app at a different ruleset and it is a
different game — no forking the screens.

[Junktown Intelligence](https://github.com/mccarjac/JunktownIntelligence) is one
such flavor: post-apocalyptic Afterworlds, where an archetype is a "Species", a
trait is a "Perk" and a quality is a "Distinction". Lore itself boots on a small
generic example ruleset.

## Contents

- [What it does](#what-it-does)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Make it yours](#make-it-yours)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Documentation](#documentation)
- [Contributing](#contributing)

## What it does

Nouns below are the engine's defaults; a ruleset renames them.

**Characters** — archetype, traits, qualities, modifications, per-character
attributes a GM defines, derived stats computed from all of it, images,
relationships, faction standings, occupations, search across everything.

**Factions** — membership synced from characters, bidirectional relationships
(ally through enemy), per-faction statistics, combined-force analysis across
allies, and an influence report.

**Locations** — a library of places, optional coordinates, character
assignments, and an interactive map when the active ruleset supplies one.

**Events and quests** — a dated timeline with participants, and quests with
sponsors, objectives and bidirectional links to the events that resolved them.

**Discord** — pull messages from any number of servers and channels, link them
to characters, and read them in context. See [docs/discord.md](docs/discord.md).

**GitHub sync** — share a campaign through a repository. Exports open a pull
request; imports do a real three-way merge with conflict resolution rather than
an overwrite. See [docs/github-sync.md](docs/github-sync.md).

**Analytics** — character and faction statistics, charts, and a relationship
graph.

## Getting started

Prerequisites: Node 20+, npm, and either an Android device/emulator or a
browser. Xcode for iOS.

```bash
git clone https://github.com/mccarjac/lore.git
cd lore
npm install
npm run check-all     # type-check + lint + format + tests
npm run web           # or: npm run android / npm run ios
```

`npm run web` is the fastest way to see it; some native features are limited
there. For device builds see [docs/android-build.md](docs/android-build.md).

## Configuration

App identity is read from the environment, with Lore's own values as defaults —
copy `.env.example` to `.env` and edit. Nothing is required to run:

| Variable                                            | Default                  | Used for                                               |
| --------------------------------------------------- | ------------------------ | ------------------------------------------------------ |
| `EXPO_PUBLIC_APP_NAME`                              | `Lore`                   | Display name                                           |
| `EXPO_PUBLIC_APP_SLUG`                              | `lore`                   | Expo slug                                              |
| `EXPO_PUBLIC_APP_VERSION`                           | `1.0.0`                  | Version                                                |
| `EXPO_PUBLIC_BUNDLE_IDENTIFIER`                     | `com.mccarjac.lore`      | iOS bundle id and Android package                      |
| `EXPO_PUBLIC_SPLASH_BACKGROUND_COLOR`               | `#ffffff`                | Splash background                                      |
| `EAS_PROJECT_ID`                                    | _(empty)_                | EAS builds — run `eas init` and paste the id it prints |
| `EXPO_OWNER`                                        | `mccarjac`               | Expo account that owns the project                     |
| `EXPO_PUBLIC_DATA_REPO_OWNER` / `_NAME` / `_BRANCH` | the shipped data library | Where GitHub sync reads and writes                     |

`src/branding.ts` resolves them and is the single source; `app.config.ts` holds
no identity literals of its own. Check what Expo resolved with
`npx expo config --type public`.

## Make it yours

Writing a ruleset is the point of the whole engine:
**[docs/ruleset-authoring.md](docs/ruleset-authoring.md)** walks through the
schema, the attribute/role model, how derived stats are computed, the rules
that bite, and how to track upstream once you have a flavor of your own.

Lore ships as a package, so a flavor is a small app of its own rather than a
fork:

```bash
npm install github:mccarjac/lore#main
```

```tsx
configureLore({ ruleset: myRuleset, assets: myAssets });

export default () => <LoreApp />;
```

That is the whole app — screens, navigation, storage and sync all come from the
package, and engine work arrives as a version bump.
**[docs/consuming-lore.md](docs/consuming-lore.md)** covers the peer
dependencies and the entry-file wiring.

## Scripts

```bash
npm start              # Expo dev server
npm run android        # device or emulator
npm run ios            # simulator (macOS)
npm run web            # browser

npm test               # Jest
npm run test:watch
npm run test:coverage

npm run lint           # eslint (0 errors required)
npm run lint:fix
npm run format         # prettier --write
npm run type-check     # tsc --noEmit
npm run check-all      # all of the above — the gate before every commit
```

## Project structure

```
src/
  components/common/    reusable UI
  components/screens/   Base{List,Form,Detail}Screen — generic scaffolds
  screens/<feature>/    character/ faction/ location/ events/ quest/ discord/
  models/               types.ts — the domain types
  ruleset/              THE ENGINE: attribute primitive, schema, provider,
                        validator, terminology, features, derived stats
  rulesets/<flavor>/    a ruleset's content — consumer-owned
  navigation/           navigator types and the whole navigation tree
  styles/               theme and shared styles
  utils/                storage, export/import, discord, git sync, stats
  activeRuleset.ts      the ruleset registry (configureLore)
  branding.ts           app identity (env-driven)
tst/                    Jest tests, mirroring src/
docs/                   the documentation below
```

Note the singular/plural distinction: **`ruleset/` is the engine, `rulesets/` is
content.** Engine code never imports from `rulesets/`.

## Documentation

- **[AGENTS.md](AGENTS.md)** — architecture, conventions, and the rules that
  matter when changing the code. Start here.
- **[docs/ruleset-authoring.md](docs/ruleset-authoring.md)** — build your own
  flavor: the schema, attributes and roles, derived stats
- **[docs/consuming-lore.md](docs/consuming-lore.md)** — depend on Lore as a
  package: install, peers, `configureLore`
- **[docs/testing.md](docs/testing.md)** — test layout, fixtures, coverage
- **[docs/android-build.md](docs/android-build.md)** — EAS and local builds
- **[docs/github-actions.md](docs/github-actions.md)** — CI workflows and APK builds
- **[docs/github-sync.md](docs/github-sync.md)** — GitHub-backed data sync
- **[docs/discord.md](docs/discord.md)** — Discord integration
- **[docs/faction-statistics.md](docs/faction-statistics.md)** — faction stats and relationships
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — how to propose a change

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). In short:
branch, make the change, keep `npm run check-all` green, open a PR. Anything
specific to one game's setting belongs in a ruleset (or a fork), not in the
engine.

## Acknowledgments

Built with [React Native](https://reactnative.dev/) and
[Expo](https://expo.dev/), navigation by
[React Navigation](https://reactnavigation.org/), charts by
[React Native Gifted Charts](https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts).

Thanks to [Jim Scanlan (calmninjas)](https://github.com/calmninjas) for testing,
bug reports and feature ideas on the app Lore was generalized out of.

<div align="center">

_Developed by Jacob McCarthy ([mccarjac](https://github.com/mccarjac))_ ·
[Report a bug](https://github.com/mccarjac/lore/issues) ·
[Request a feature](https://github.com/mccarjac/lore/issues)

</div>
