# Build your own flavor

Lore is an engine. The rules and vocabulary of any particular game come from a
**ruleset**, not from the code — so making Lore run your game means writing a
`RulesetDefinition` and pointing the build at it, not forking the screens.

This guide covers what a ruleset declares, how the engine consumes it, the
rules that will bite you, and how to track upstream once you have your own
flavor.

---

## The shape of a flavor

Exactly four things belong to a flavor. Everything else is engine-owned and
merges cleanly from upstream:

```
.env                        app identity (see .env.example)
src/activeRuleset.ts        which ruleset this build runs on
src/rulesets/<flavor>/**    the ruleset: content, terminology, categories, images
assets/{icon,adaptive-icon,splash-icon,favicon}.png
```

If you find yourself adding something flavor-specific outside that list, it is
a bug — either the engine needs a new seam, or the thing belongs in your
ruleset.

The bundled `src/rulesets/afterworlds/` (Junktown Intelligence's setting) is a
worked example of all of this, and is laid out as `index.ts` (the definition),
`terminology.ts`, `categories.ts`, `assets.ts` + `assets/`, and `content/` —
the last holding the tables it was originally authored in.

### Two minutes to a running flavor

```ts
// src/rulesets/myflavor/index.ts
import { num, flag, type AttributeDefinition } from '@/ruleset/attributes';
import type { RulesetDefinition } from '@/ruleset/types';

const attributes: AttributeDefinition[] = [
  {
    id: 'vitality',
    label: 'Vitality',
    type: 'number',
    role: 'resource',
    capAttributeId: 'vitalityCap',
  },
  { id: 'vitalityCap', label: 'Vitality Cap', type: 'number', role: 'cap' },
];

export const myFlavorRuleset: RulesetDefinition = {
  id: 'myflavor',
  name: 'My Flavor',
  version: '1.0.0',
  terminology: { 'archetype.plural': 'Bloodlines' },
  attributes,
  groups: [{ id: 'mortal', label: 'Mortal' }],
  archetypes: [
    {
      id: 'knight',
      label: 'Knight',
      groups: ['mortal'],
      attributes: { vitality: num(4), vitalityCap: num(9) },
    },
  ],
  defaultArchetypeId: 'knight',
  traitCategories: [{ id: 'martial', label: 'Martial', color: '#8E44AD' }],
  traits: [
    {
      id: 'shield_wall',
      name: 'Shield Wall',
      description: 'Holds the line.',
      categoryId: 'martial',
      modifier: { attributeDeltas: { vitality: 1 } },
    },
  ],
  qualities: [],
  categoryBonuses: [],
  features: {
    quests: true,
    recipes: false,
    discord: false,
    map: false,
    gitSync: true,
    modifications: true,
    influenceReport: true,
    relationshipGraph: true,
  },
  branding: { appName: 'My Flavor' },
};
```

```ts
// index.ts — before registerRootComponent, and before any storage call
import { configureLore } from '@/activeRuleset';
import { myFlavorRuleset } from '@/rulesets/myflavor';

configureLore({ ruleset: myFlavorRuleset });
```

`npm run web` and the app is running your game.

(Consuming Lore as a package? The call is identical, imported from `lore`
rather than `@/activeRuleset` — see [consuming-lore.md](./consuming-lore.md).)

`src/ruleset/exampleRuleset.ts` is the same thing, slightly larger, and is what
the engine boots on out of the box. Read it — it is deliberately small enough
to hold in your head.

---

## The schema

`src/ruleset/types.ts` is the authority. Field by field:

| Field                   | Required | What it is                                                                                                 |
| ----------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| `id`, `name`, `version` | yes      | Identity. `id` must be unique against any other ruleset in the tree.                                       |
| `terminology`           | yes      | Overrides for the neutral nouns. Partial — anything you omit falls back.                                   |
| `attributes`            | yes      | Every attribute anything in this ruleset may carry. See below.                                             |
| `groups`                | yes      | Named groupings of archetypes (`organic`, `undead`, …).                                                    |
| `archetypes`            | yes      | What a character _is_, with its base attribute values.                                                     |
| `defaultArchetypeId`    | no       | What a new character starts as. Without it the form falls back to declaration order.                       |
| `traitCategories`       | yes      | Categories traits belong to, with an optional `color`.                                                     |
| `traits`                | yes      | Things a character _has_, each in one category, optionally with a `modifier` and an archetype restriction. |
| `qualities`             | yes      | Descriptive properties, optionally archetype-restricted. No mechanical effect.                             |
| `recipes`               | no       | Craftable things, gated by the `recipes` feature flag.                                                     |
| `categoryBonuses`       | yes      | "N traits in this category grants X." May be `[]`.                                                         |
| `archetypeRules`        | no       | Carve-outs — currently one kind, see below.                                                                |
| `features`              | yes      | Eight booleans gating whole subsystems.                                                                    |
| `limits`                | no       | Ruleset-level numbers, e.g. `maxQualities`.                                                                |
| `map`                   | no       | `{ imageKey }` — resolved through `RulesetAssets`, never a `require()`.                                    |
| `branding`              | yes      | `appName` plus optional `iconKey` / `splashKey`.                                                           |

### Attributes and roles

Attributes are a tagged union — `{ type, value }` over
number / text / flag / ref / list / map — declared once in
`RulesetDefinition.attributes` and referenced by id everywhere else. Use the
constructors `num()`, `text()`, `flag()`, `ref()` from
`src/ruleset/attributes.ts`.

**The `role` is what stops this becoming untyped soup.** The union is storage;
the role is meaning, and `derived.ts` dispatches on role rather than on
hardcoded ids:

| Role         | Meaning                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------- |
| `resource`   | A number that traits, bonuses and modifications add to, and that clamps to its `capAttributeId` if it declares one. |
| `cap`        | The ceiling for a resource. Only modifications and character values may raise it.                                   |
| `capability` | A flag — "can fly", "is synthetic". Never arithmetic.                                                               |
| `freeform`   | The default. Declared, stored, displayed; inert in computation.                                                     |

`perCharacter: true` lets a character carry its own value for an attribute —
that is how GM-defined per-character fields work, with no code change.

### How a number is computed

`calculateDerivedStats(character, ruleset)` (`src/ruleset/derived.ts`) returns
`{ values, categoryScores, attributes }`. **The order is load-bearing:**

1. archetype base attributes
2. character attribute overrides — **absolute assignments, not deltas**
3. trait deltas (`role: 'resource'` only)
4. category-bonus grants
5. modification deltas (`'resource'` and `'cap'`)
6. clamp each resource to its `capAttributeId`

Three consequences are deliberate, and the parity suite pins them:

- **Traits cannot raise caps.** A trait may _declare_ a cap delta; the engine
  ignores it. (Afterworlds' `smarts_20` does exactly this.) It is a consequence
  of the role rule, not a special case — and declaring one is not a validation
  error, because flagging it would make `RulesetProvider` throw for a ruleset
  that has always worked.
- **Modification `categoryDeltas` do not retroactively unlock category
  bonuses**, since they land after step 4.
- **Only resources with a `capAttributeId` clamp.** An uncapped resource grows
  without bound.

All three are arguably bugs. Fixing any of them moves real players' numbers and
is a rules change, not a refactor — so if you want different behavior, that is
a conversation, not a patch.

### Category bonuses and archetype rules

A `CategoryBonusRule` says "hold `requiredScore` traits in `categoryId` and
receive `grants`". Score is the count of traits a character holds in that
category.

`archetypeRules` currently has one kind,
`excludeCategoryScoreFromGroupRestrictedTraits`: the named archetype accrues no
category score from traits restricted to _exactly_ the membership of the named
group. It exists because Afterworlds' "Perfect Mutant" works that way; declare
it only if your rules need it.

### Terminology

`terminology` maps a `TermKey` (`'trait.plural'`, `'archetype.singular'`,
`'map.label'`, …) to what your game calls that thing. Anything you omit uses
the neutral default, so `terminology: {}` is a complete, valid choice — the
example ruleset does exactly that so the fallback path is exercised by a
running app.

Screens read these through `useLabels()`, and non-component code through
`getLabel(ruleset, key)`. **Never hardcode a domain noun in a screen** — a
different ruleset calls it something else.

Terminology overrides are _content_. Renaming an engine field must not drag the
override values along with it: Junktown's app still says "Species" and "Perks"
after the Phase 1 renames precisely because those values live in the ruleset.

### Feature flags

Eight booleans — `quests`, `recipes`, `discord`, `map`, `gitSync`,
`modifications`, `influenceReport`, `relationshipGraph` — gate **route
registration** in `src/navigation/AppNavigator.tsx`. Turning one off hides the
screens; the data stays, and turning it back on restores everything intact.

Two traps: the drawer's item list and its screen list are maintained
separately and **both** need gating, and `navigate()` into an unregistered
route throws at runtime — so every call site into a gated route must be gated
too. Grep `navigation.navigate(` when adding a flag.

### Images

`RulesetDefinition` must stay **JSON-serializable** — no functions, no
`require()` results, anywhere. That is what keeps a future in-app ruleset
editor possible, and `validate.ts` enforces it at runtime.

Bundled images therefore go through a separate string-keyed map:

```ts
// src/rulesets/myflavor/assets.ts
export const myFlavorAssets: RulesetAssets = {
  map: require('./assets/RealmMap.png'),
};
```

The ruleset references the key (`map: { imageKey: 'map' }`), and
`src/activeRuleset.ts` exports the asset map alongside the definition. The
map's _display name_ is `terminology['map.label']` — the `map` field carries
only the key, because two sources for one string only drift.

---

## Rules that bite

- **Import `@/ruleset/*` submodules directly, never the `@/ruleset` barrel**,
  from `src/activeRuleset.ts` or anything under `src/rulesets/`. The barrel
  re-exports `context.tsx`, which imports the seam — that is a cycle.
- **Engine code must not import from `src/rulesets/`.** The singular/plural
  distinction is the whole architecture: `src/ruleset/` is the engine,
  `src/rulesets/` is content. Only `src/activeRuleset.ts` names a flavor.
- **`activeRuleset` is a module, not a provider prop.** Non-component code
  needs it too — storage migrations cannot read a React context.
- **Content is content.** Authoring your ruleset as tables in a `content/`
  directory and transforming them into ruleset shapes at module load is a
  legitimate pattern (it is what Afterworlds does); a hand-written literal that
  duplicates your tables will drift from them.

---

## Validating and testing

`validateRuleset(ruleset)` (`src/ruleset/validate.ts`) returns
`{ valid, issues }` rather than throwing, so errors can be shown in UI rather
than crashing the app. `RulesetProvider` throws on an invalid ruleset under
`__DEV__` and logs-and-renders otherwise. It checks id integrity across every
cross-reference, attribute type/bounds agreement, and JSON-serializability.

For your own tests: **never assert against whatever ruleset the build ships**.
Pass one explicitly. See [testing.md](./testing.md) for the three fixtures and
what each is for, and use `renderWithRuleset()` for screens.

A good first test for a new flavor mirrors `tst/rulesets/afterworlds.test.ts`:
it validates, it round-trips through JSON, and the handful of numbers your
players would notice if they changed are pinned.

---

## Tracking upstream

**Depend on the engine rather than forking it.** A flavor is a small app that
installs `lore`, registers its ruleset, and renders `LoreApp`:

```bash
npm install github:mccarjac/lore#main
```

```tsx
configureLore({ ruleset: myRuleset, assets: myAssets });
```

Picking up engine work is then a version bump — no merge, no conflicts, no
second copy of the screens. [consuming-lore.md](./consuming-lore.md) covers the
peer dependencies, the entry-file wiring, and what the package exports.

Two things change if you take that route. Your ruleset lives in your own
repository rather than under `src/rulesets/`, and it reaches the engine through
`configureLore()` instead of `src/activeRuleset.ts` — a package cannot import
its consumer's module, so the seam pushes rather than pulls.

The in-tree layout this page describes still works, and is what the engine's own
dev app uses. It is the right choice while you are experimenting with a ruleset
inside a clone of Lore; move to the dependency once the flavor is real.

---

## Extracting a flavor

If a flavor should live in its own repository, this is what moves:

| Path                                    | Fate                                     |
| --------------------------------------- | ---------------------------------------- |
| `src/rulesets/<flavor>/**`              | moves to the fork                        |
| `tst/rulesets/<flavor>.test.ts`         | moves with it                            |
| `tst/utils/derivedStats.parity.test.ts` | moves — it asserts that flavor's numbers |
| `tst/fixtures/derivedStatsBaseline.ts`  | moves — the numbers themselves           |
| `src/activeRuleset.ts`                  | stays; the fork points it at its ruleset |
| `assets/*.png`, `.env`                  | stay; the fork supplies its own values   |

One more edit in the engine: drop the flavor's row from the id-disjointness
list in `tst/fixtures/genericRuleset.test.ts`. That is deliberately the only
place outside those files that names it — the rest of the suite runs on the
neutral fixtures, so extraction is a delete, not a refactor.

Then, on both sides:

```bash
npm run check-all
```

The fork additionally needs its `.env` (identity, and the data repository if it
uses GitHub sync), its `assets/`, and `src/activeRuleset.ts` pointing at its
own ruleset.
