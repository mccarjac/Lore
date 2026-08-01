# Build your own flavor

Lore is an engine. The rules and vocabulary of any particular game come from a
**ruleset**, not from the code — so making Lore run your game means writing a
`RulesetDefinition` and pointing the build at it, not forking the screens.

This guide covers what a ruleset declares, how the engine consumes it, the
rules that will bite you, and how to track upstream once you have your own
flavor.

---

## The shape of a flavor

A flavor is its own small app that depends on `lore`. What belongs to it:

```
package.json                the `lore` dependency, and every peer
app.config.ts / .env        app identity
index.ts                    configureLore(...) before registerRootComponent
src/rulesets/<flavor>/**    the ruleset: content, terminology, categories, images
assets/*.png                icon, adaptive icon, splash, favicon
```

Everything else comes from the package. If you find yourself wanting to add a
screen, a storage module or a navigator, stop — that is engine work, and it
belongs upstream where every flavor gets it.

[consuming-lore.md](./consuming-lore.md) covers the install and the wiring;
this page covers what goes _in_ the ruleset.

[Junktown Intelligence](https://github.com/mccarjac/JunktownIntelligence) is a
worked example of all of this — a real flavor, laid out as `index.ts` (the
definition), `terminology.ts`, `categories.ts`, `assets.ts` + `assets/`, and
`content/`, the last holding the tables it is authored in. Read it alongside
this page.

### Two minutes to a running flavor

```ts
// src/rulesets/myflavor/index.ts — in your app, not in Lore
import {
  num,
  type AttributeDefinition,
  type FacetCollection,
  type RulesetDefinition,
} from 'lore/ruleset';

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

// A ruleset declares however many facet collections its game needs — this
// one axis (the old hardcoded "archetype") plus one scored, multi-select axis
// (the old hardcoded "trait"). Neither name is special to the engine.
const bloodlines: FacetCollection = {
  id: 'bloodlines',
  singular: 'Bloodline',
  plural: 'Bloodlines',
  selection: 'single',
  defaultEntryId: 'knight',
  contributes: { stage: 'base' },
  entries: [
    {
      id: 'knight',
      label: 'Knight',
      attributes: { vitality: num(4), vitalityCap: num(9) },
    },
  ],
};

const disciplines: FacetCollection = {
  id: 'disciplines',
  singular: 'Discipline',
  plural: 'Disciplines',
  selection: 'multi',
  categories: [{ id: 'martial', label: 'Martial', color: '#8E44AD' }],
  contributes: { deltaRoles: ['resource'], categoryScore: true },
  entries: [
    {
      id: 'shield_wall',
      label: 'Shield Wall',
      description: 'Holds the line.',
      categoryId: 'martial',
      modifier: { attributeDeltas: { vitality: 1 } },
    },
  ],
};

export const myFlavorRuleset: RulesetDefinition = {
  id: 'myflavor',
  name: 'My Flavor',
  version: '1.0.0',
  terminology: {},
  attributes,
  facets: [bloodlines, disciplines],
  // Every relationship-type collection this ruleset declares — see
  // "Relationship types" below. May be `[]` for a ruleset with none.
  relationshipTypes: [],
  features: {
    quests: true,
    discord: false,
    map: false,
    modifications: true,
    influenceReport: false,
    relationshipGraph: false,
    characterStats: false,
    factionStats: false,
  },
  branding: { appName: 'My Flavor' },
};
```

```ts
// index.ts — before registerRootComponent, and before any storage call
import { registerRootComponent } from 'expo';
import { configureLore } from 'lore';
import { myFlavorRuleset } from './src/rulesets/myflavor';
import App from './App';

configureLore({ ruleset: myFlavorRuleset });
registerRootComponent(App);
```

`npm run web` and the app is running your game.

**Note the two import paths.** The ruleset module imports `lore/ruleset` — the
engine without React Native — so it and its tests stay cheap to load. Only the
entry file and `App.tsx` import `lore` itself, which brings `LoreApp` and the
whole screen tree with it.

Lore's own `src/ruleset/exampleRuleset.ts` is the same thing, slightly larger,
and is what the engine boots on with nothing configured. Read it — it is
deliberately small enough to hold in your head.

---

## The schema

`src/ruleset/types.ts` is the authority. Field by field:

| Field                   | Required | What it is                                                                                                                                                                                     |
| ----------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `name`, `version` | yes      | Identity. `id` must be unique against any other ruleset in the tree.                                                                                                                           |
| `terminology`           | yes      | Overrides for the engine's own core nouns. Partial — anything you omit falls back.                                                                                                             |
| `attributes`            | yes      | Every attribute anything in this ruleset may carry. See below.                                                                                                                                 |
| `facets`                | yes      | Every facet collection this ruleset declares — archetypes, traits, qualities, modifications, recipes and anything else you invent. See below. May be `[]` for a ruleset with no facets at all. |
| `relationshipTypes`     | yes      | Every relationship-type collection this ruleset declares — the generalized form of the old `RelationshipStanding` enum. See below. May be `[]` for a ruleset with no typed relationships.      |
| `features`              | yes      | Five booleans gating whole subsystems.                                                                                                                                                         |
| `map`                   | no       | `{ imageKey }` — resolved through `RulesetAssets`, never a `require()`.                                                                                                                        |
| `branding`              | yes      | `appName` plus optional `iconKey` / `splashKey` / `colors`. See "Theming".                                                                                                                     |

There is no `groups`, `archetypes`, `traitCategories`, `traits`, `qualities`,
`recipes`, `categoryBonuses`, `archetypeRules`, `defaultArchetypeId` or
`limits` field any more — the engine used to name each of those outright.
They are now all expressed as `FacetCollection`s, below. Likewise, there is
no `RelationshipStanding` enum any more — every character-character,
character-faction, and faction-faction relationship is now expressed as a
`RelationshipTypeCollection`, further below.

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

### Facet collections

A `FacetCollection` (`src/ruleset/facets.ts`) is the one concept that
replaces the engine's old six named collections — `archetypes`, `traits`,
`traitCategories`, `qualities`, `modifications`, `recipes`. A ruleset
declares as many as its game needs, in `RulesetDefinition.facets`:

```ts
interface FacetCollection {
  id: string;
  singular: string; // display noun — replaces the old per-collection TermKeys
  plural: string;
  selection: 'single' | 'multi' | 'catalog';
  maxSelections?: number; // the old `limits.maxQualities`
  defaultEntryId?: string; // the old `defaultArchetypeId`
  authored?: boolean; // entries are written per character, not picked from a catalog
  groups?: FacetGroup[];
  categories?: FacetCategory[];
  categorySingular?: string;
  categoryPlural?: string;
  categoryBonuses?: FacetBonusRule[];
  entries: FacetEntry[];
  contributes?: {
    stage?: 'base' | 'preBonus' | 'postBonus'; // default 'preBonus'
    deltaRoles?: AttributeRole[]; // default [] — no arithmetic
    categoryScore?: boolean; // default false
  };
  scoreExclusions?: FacetScoreExclusion[];
  matchWeight?: number; // quest-preference weight; default 5 for 'single', 3 otherwise
  categoryMatchWeight?: number; // default 1
}
```

`selection` is the whole shape of the collection:

- **`'single'`** — a character holds at most one (the old archetype). Set
  `contributes.stage: 'base'` and give each entry an `attributes` bag to make
  it seed a character's base numbers.
- **`'multi'`** — a character holds any number (the old traits and
  qualities). Add `categories` + `categoryBonuses` and
  `contributes: { deltaRoles: ['resource'], categoryScore: true }` to make it
  score like the old traits; omit `contributes` entirely for a purely
  descriptive collection like the old qualities.
- **`'catalog'`** — never held directly, only reachable through another
  entry's `links` (the old recipes).

Set `authored: true` for a collection whose entries are written per
character rather than picked from `entries` (the old modifications) — give
it `contributes: { stage: 'postBonus', deltaRoles: ['resource', 'cap'] }` to
reproduce the old modification behavior exactly.

A `FacetEntry`'s `requires` (collectionId → entry ids) replaces the old
`allowedArchetypeIds` — an entry is only offered to a character already
holding one of the named entries in that other collection. `links`
(collectionId → entry ids) replaces the old `Trait.recipeIds` — a pointer
into a `'catalog'` collection. `FacetScoreExclusion` replaces the old
`ArchetypeRule`'s one kind: it suppresses category score when the character
holds a named entry in another collection and this entry is restricted (via
`requires`) to exactly one group's membership.

If your ruleset tracks whether a character is present at a session, declare
a `'single'` collection for it — the engine no longer has a builtin notion of
presence (issue #56). If you're upgrading from an app version that still
shipped the builtin `present` boolean, give the two entries that replace it a
`legacyValue` (`true`/`false`) and set the collection's `legacyField` to
`'present'` — `rulesetFieldMigration.ts` uses this to fold the old field into
`facets` on load, the same `legacyField`/`legacyValue` pattern relationship
types use below. The bundled example ruleset's `attendance` collection is the
reference implementation.

### Reports

The engine ships four analytics/reporting screens — character statistics,
faction statistics, an influence report, and a relationship graph. Which of
them exist for your ruleset, in what order, and under what title is declared
data (`src/ruleset/reports.ts`), the same pattern `facets` and
`relationshipTypes` use: the engine owns the screens and their computation,
the ruleset owns which are turned on.

```ts
type ReportKind =
  | 'characterStats'
  | 'factionStats'
  | 'influenceReport'
  | 'relationshipGraph';

interface ReportDefinition {
  kind: ReportKind;
  title?: string; // overrides the engine's default title/drawer label
}
```

`RulesetDefinition.reports: ReportDefinition[]` — array order is drawer
order. An empty array (the default) declares no reports at all. Enabled
reports are grouped under a single collapsible "Statistics" section in the
drawer, collapsed by default; the section itself doesn't render when
`reports` is empty. Omitting `title` falls back to the engine's default for
that kind (`` `${label('character.singular')} Statistics` `` and similarly
for faction stats; static "Influence Report"/"Relationship Graph" for the
other two). `validateRuleset` rejects an unknown `kind` and a duplicate
`kind` in the array.

### How a number is computed

`calculateDerivedStats(character, ruleset)` (`src/ruleset/derived.ts`) returns
`{ values, categoryScores, attributes }`. **The order is load-bearing:**

1. `stage: 'base'` collections seed absolute attribute values, in declaration order
2. character attribute overrides — **absolute assignments, not deltas**
3. `stage: 'preBonus'` collections apply deltas (gated by `deltaRoles`) and category scores (gated by `categoryScore`)
4. every collection's `categoryBonuses` grants
5. `stage: 'postBonus'` collections apply deltas and category deltas
6. clamp each resource to its `capAttributeId`

Three consequences are deliberate, and the parity suite pins them:

- **A `preBonus` collection cannot raise a cap unless its `deltaRoles`
  includes `'cap'`.** The old traits declared only `['resource']`, so a
  trait's cap delta was — and still is — simply never applied. (Afterworlds'
  `smarts_20` declares one; a real ruleset relies on the engine ignoring it.)
  Declaring one is not a validation error, because flagging it would make
  `RulesetProvider` throw for a ruleset that has always worked.
- **A `postBonus` collection's category deltas do not retroactively unlock
  category bonuses**, since they land after step 4.
- **Only resources with a `capAttributeId` clamp.** An uncapped resource grows
  without bound.

All three are arguably bugs. Fixing any of them moves real players' numbers and
is a rules change, not a refactor — so if you want different behavior, that is
a conversation, not a patch.

### Category bonuses and score exclusions

A `FacetBonusRule` says "hold `requiredScore` entries in `categoryId` within
this collection and receive `grants`". Score is the count of entries a
character holds in that category, per collection — `categoryScores` in
`DerivedStats` is nested `collectionId -> categoryId -> score`, since two
collections may each declare a category with the same id.

`scoreExclusions` is the declarative form of what used to be `ArchetypeRule`'s
one kind: the named entry in `whenCollectionId` accrues no category score
from entries restricted (via `requires`) to _exactly_ the membership of
`groupId`. It exists because Afterworlds' "Perfect Mutant" works that way;
declare it only if your rules need it.

### Relationship types

A `RelationshipTypeCollection` (`src/ruleset/relationships.ts`) is what
replaces the engine's old hardcoded `RelationshipStanding` enum
(`Ally | Friend | Neutral | Hostile | Enemy`), reused for three unrelated
pairs — character↔character, character↔faction ("standing"), and
faction↔faction. A ruleset now declares as many relationship-type
collections as it needs, one per entity pairing that carries a typed
relationship, in `RulesetDefinition.relationshipTypes`:

```ts
interface RelationshipTypeCollection {
  id: string;
  singular: string;
  plural: string;
  appliesTo: [RelationshipEntityKind, RelationshipEntityKind]; // e.g. ['character', 'faction']
  entries: RelationshipTypeEntry[];
  defaultEntryId?: string;
}

interface RelationshipTypeEntry {
  id: string;
  label: string; // shown from the "forward" (authored) side
  inverseLabel?: string; // required when symmetric is false
  symmetric?: boolean; // default true
  role: 'positive' | 'neutral' | 'negative';
  color?: ColorToken; // overrides the role-based default from ColorPalette.standing
}
```

`RelationshipEntityKind` is `'character' | 'faction' | 'event' | 'quest' |
'location'` — declare a collection for any pairing your game needs a typed
relationship between, not only the three the engine used to hardcode.

**`role` is the generalized form of `POSITIVE_RELATIONSHIP_TYPE`/
`NEGATIVE_RELATIONSHIP_TYPE`.** Those two module-level arrays no longer
exist; downstream code (`isPositiveRelationship`, `isNegativeRelationship`,
faction stats, the influence report, the relationship graph's layout
weighting) dispatches on `entry.role`, never on a literal id or label — the
same "role, not identity" discipline attributes use.

**`symmetric`/`inverseLabel` are how a relationship-type collection
expresses hierarchy or composition**, not only mutual standing. A symmetric
entry (the default, and every entry in the bundled example ruleset) reads
the same from both sides and is stored mirrored on both entities, exactly
like the old standing always was. Set `symmetric: false` and supply
`inverseLabel` for a directional relationship — e.g. a faction-faction entry
`{ id: 'vassal', label: 'Vassal of', inverseLabel: 'Suzerain of', symmetric: false, role: 'neutral' }`
lets one faction be declared a vassal of another, rendering "Vassal of" on
the authored side and "Suzerain of" on the reciprocal side, which is what
"Faction C is an alliance of Faction A and Faction B"-style relationships
need that plain mutual standing cannot express.

Accessors mirror the facet ones: `findRelationshipCollection`/
`findRelationshipEntry` resolve within one collection you already have;
`findRelationshipCollectionForPair`/`findRelationshipEntryForPair` resolve
by entity pairing, since stored data records only a bare
`relationshipTypeId`, never which collection it came from.
`relationshipLabel(entry, direction)` resolves the label for a given side,
and `resolveRelationshipColor(entry, colors)` (or `roleColor(role, colors)`
when only a role is available, as in the relationship graph) resolves the
color, falling back to `ColorPalette.standing`'s role-keyed defaults when an
entry sets no `color` of its own.

**Storage topology differs by pairing**, and that is the engine's concern,
not something a ruleset author needs to manage: faction-faction
relationships are independent top-level records, so the engine mirrors a
write onto both sides (flipping `direction` when the entry is directional);
character-faction and character-character relationships are already
embedded on the character, so no mirroring is needed; and a brand-new
pairing like character-event needs no dedicated sync code at all — the
reverse side is discovered by scanning, the same technique
`FactionListScreen` already uses for faction membership.

If your ruleset upgrades from an app version that still shipped
`RelationshipStanding`, give each entry that replaces one of its five values
a `legacyValue` (the old member name, e.g. `'Ally'`) and set the owning
collection's `legacyField` to `'characterStanding'`,
`'characterFactionStanding'`, or `'factionStanding'` — `rulesetFieldMigration.ts`
uses this to rewrite stored data on load, the same `legacyField` pattern
`FacetCollection` already uses for the pre-#51 fields.

### Terminology

`terminology` maps a `TermKey` to what your game calls one of the engine's
own core nouns — `character`, `faction`, `quest`, `resource`,
`questSponsor`, `map.label`. Anything you omit uses the neutral default, so
`terminology: {}` is a complete, valid choice — the example ruleset does
exactly that so the fallback path is exercised by a running app.
`location`/`event` are not yet in `TermKey`; they're always
"Location"/"Event".

Every other noun — what used to be `archetype`, `trait`, `traitCategory`,
`quality`, `modification`, `recipe` — is no longer a `TermKey` at all. It is
a `FacetCollection`'s own `singular`/`plural` (and, for a scored collection,
`categorySingular`/`categoryPlural`), declared once where the collection
itself is declared rather than as a separate terminology override.

Screens read `TermKey`s through `useLabels()`, and non-component code through
`getLabel(ruleset, key)`. **Never hardcode a domain noun in a screen** — a
different ruleset calls it something else, and a facet collection's noun
comes from `collection.singular`/`.plural` directly.

Terminology overrides are _content_, and so is a collection's `singular`/
`plural`. Renaming an engine field must not drag either along with it —
that discipline is what let Junktown's app keep saying "Species" and "Perks"
through the Phase 1 renames, and it is exactly as true for the facet names
now.

### Theming

`branding.colors` (`ColorPaletteOverrides`) reskins the engine's default dark
blue-purple palette. It's a deep-partial of `ColorPalette` — override only
the tokens you care about:

```ts
export const myFlavorRuleset: RulesetDefinition = {
  // ...
  branding: {
    appName: 'My Flavor',
    colors: {
      primary: '#1A120B', // main background
      accent: { primary: '#C0642C' }, // nested groups merge independently —
    }, // accent.secondary/success/... keep their defaults
  },
};
```

See `src/styles/theme.ts`'s `ColorPalette` for the full shape (backgrounds,
text, accent, status, standing, certainty, interactive, border, shadow).

**Screens must read colors through `useTheme()` (or `useCommonStyles()` for
the shared button/card/badge/etc. presets), never the static `colors` /
`commonStyles` exports**, and must resolve them at _render_ time, not module
load. A consumer's `configureLore({ ruleset })` call runs after this
package's whole module graph — including every module-scope
`StyleSheet.create()` — has already been evaluated (ES import order), so a
color baked into a style object at import time can never reflect a ruleset's
override. The pattern:

```tsx
import { useTheme } from 'lore'; // or '@/styles/theme' inside this repo

function MyScreen() {
  const { colors } = useTheme();
  const styles = useMemo(
    () => StyleSheet.create({ card: { backgroundColor: colors.surface } }),
    [colors]
  );
  // ...
}
```

The static `colors`/`commonStyles`/`shadows`/`componentStyles` exports still
exist and still work — they just always show the engine's default palette,
regardless of `branding.colors`. They're for code that hasn't been migrated
to the hooks yet, not a second valid way to read a ruleset-aware color.

`getActiveColors()` mirrors `getLabel()` for non-component code that needs a
ruleset's resolved palette outside a render (rare — most color usage is in
screens).

### Feature flags

Three booleans — `quests`, `discord`, `map` — gate **route registration** in
`src/navigation/AppNavigator.tsx`. Turning one off hides the screens; the
data stays, and turning it back on restores everything intact.

The four reporting/analytics screens (`characterStats`, `factionStats`,
`influenceReport`, `relationshipGraph`) aren't feature flags — see "Reports"
above for how a ruleset opts into them via `RulesetDefinition.reports`.

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

A good first test for a new flavor mirrors Junktown Intelligence's: it
validates, it round-trips through JSON, and the handful of numbers your players
would notice if they changed are pinned. That last part matters more than it
sounds — once your flavor is a separate app, **the engine's own suite cannot
catch a change that moves your numbers.** Yours is the only thing that will.

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
