# Faction statistics and relationships

Two related features: per-faction analysis of what its members can do, and a
relationship graph between factions that feeds a combined-force view.

Nouns here are the engine's — **archetype**, **trait**, **trait category**,
**quality**. A ruleset renames them for display (Junktown Intelligence, for
instance, shows Species / Perk / Tag / Distinction), so the screens look them
up through `useLabels()` rather than hardcoding.

## Faction Statistics screen

Reached from the drawer. For the selected faction it shows:

- **Trait-category analysis** — how often each category appears across members'
  traits, as color-coded bars. A member with three traits in one category
  counts three times, so this reads as specialization, not headcount.
  Category colors come from the ruleset's `TraitCategory.color`, falling back
  to `src/styles/chartPalette.ts`.
- **Common traits** — the five most frequent traits among members, with the
  percentage of members holding each.
- **Common qualities** — the same, for qualities.
- **Archetype distribution** — the mix of archetypes in the faction.
- **Relationships** — allied and enemy factions, tappable to navigate.
- **Combined force analysis** — member count and merged category counts across
  the faction and its direct allies, plus the resulting strength multiplier.

Only characters whose faction standing resolves to a **positive** role count
as members — see [ruleset-authoring.md](./ruleset-authoring.md#relationship-types).
Retired characters and retired factions are excluded.

## Relationships

Edit a faction (**Factions** → select → edit) and use **Faction
Relationships** → **+ Add Relationship**. The available standings — and which
of them are positive/neutral/negative — are declared by the active ruleset's
`character`-`faction` and `faction`-`faction` `RelationshipTypeCollection`s
(the generalized form of the old fixed **Ally**/**Friend**/**Neutral**/
**Hostile**/**Enemy** enum); only positive-role standings feed combined-force
analysis.

**Relationships are bidirectional.** Adding, changing or removing one keeps the
reciprocal relationship on the other faction in sync, and renaming a faction
updates every reference to it — on characters and on other factions'
relationship lists. See `createFaction` / `updateFaction` in
`src/utils/characterStorage.ts`; anything new that touches relationships must
preserve that.

## Data

```typescript
interface FactionRelationship {
  factionName: string; // factions are name-keyed — StoredFaction has no id
  relationshipTypeId: string; // resolves into a ruleset RelationshipTypeCollection entry
  description?: string;
  direction?: 'forward' | 'inverse'; // only set for a directional (symmetric: false) entry
}

interface FactionStats {
  factionName: string;
  totalMembers: number;
  presentMembers: number;

  // Trait-category analysis, keyed by ruleset trait-category id rather than a
  // closed enum — a ruleset may declare any number of categories. The field
  // names are pre-generalization and have not been renamed, since they are
  // internal to this module's callers.
  perkTagCounts: Record<string, number>;
  topPerkTags: { tag: string; count: number; percentage: number }[];
  commonPerks: { name: string; count: number; percentage: number }[];
  commonDistinctions: { name: string; count: number; percentage: number }[];

  archetypeDistribution: Record<string, number>;

  relationships: FactionRelationship[];
  alliedFactions: string[];
  enemyFactions: string[];

  combinedMemberCount?: number;
  combinedPerkTags?: Record<string, number>;
}
```

Computation lives in `src/utils/factionStats.ts` — pure, taking the ruleset as
a parameter (it uses `getLabel`, not `useLabels`, since it is not a component).
Faction records, relationships included, are stored under
`gameCharacterManager_factions`; a faction stored before relationships existed
reads back with an empty list.

Combined analysis covers **direct allies only** — no recursive expansion into
allies of allies.

## Troubleshooting

**No statistics at all** — the faction has no members with a positive-role
standing, they are all retired, or the faction itself is retired.

**Combined analysis matches the direct numbers** — no positive-role faction
relationships, or the allied factions have no members of their own.

**Category counts look wrong** — counts are cumulative across every trait a
member holds, and each trait contributes to exactly one category
(`Trait.categoryId`). A trait whose `categoryId` is not in the ruleset's
`traitCategories` contributes nothing.

## Related

- Faction influence analysis — `src/utils/influenceAnalysis.ts`
- Relationship graph screen — `src/utils/relationshipGraph.ts`
