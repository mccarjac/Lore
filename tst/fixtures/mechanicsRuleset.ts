/**
 * A neutral ruleset for testing the **engine's computation**, as distinct from
 * `genericRuleset.ts`, which tests that a **screen reads the provider**.
 *
 * They cannot be one fixture. `genericRuleset` deliberately has empty
 * `categoryBonuses` and no `scoreExclusions`, and several screen tests depend
 * on its exact shape — adding mechanics to it would move numbers in the
 * stats screens for reasons unrelated to what they assert.
 *
 * So this one carries exactly what `derived.ts`'s six-step pipeline needs to
 * be exercised without Afterworlds:
 *
 * - two capped resources (`grit`, `spark`) plus one uncapped (`fate`), since
 *   only resources declaring a `capAttributeId` clamp at step 5
 * - category bonuses at two different thresholds (step 3), across **two**
 *   separately-scored collections (`knacks` and `bonds`) — the direct proof
 *   that a ruleset may declare more scored collections than the engine used
 *   to hardcode (#51), not just more categories within one
 * - a `knacks` entry declaring a **cap** delta (`overclock`), which the
 *   engine must ignore — `knacks` only applies `role: 'resource'` deltas.
 *   Afterworlds' `smarts_20` is the real-world case; this proves the rule
 *   holds generally.
 * - a `scoreExclusions` carve-out whose group membership exactly matches one
 *   `knacks` entry's `requires`, which is the only way the exclusion fires
 * - `rigs`, an `authored: true`, `postBonus` collection (the old
 *   "modifications"), to exercise steps 4 and the "may raise a cap, unlike a
 *   `preBonus` entry" rule
 * - `charms`, a `selection: 'catalog'` collection (the old "recipes"), never
 *   held directly
 *
 * Five facet-bearing collections plus one catalog — one more than the four
 * the engine used to hardcode. Every id here is disjoint from
 * `genericRuleset` and from the engine's example ruleset — asserted in
 * `genericRuleset.test.ts`.
 */
import { num, flag, type AttributeDefinition } from '@/ruleset/attributes';
import type { FacetCollection } from '@/ruleset/facets';
import type { RelationshipTypeCollection } from '@/ruleset/relationships';
import type { RulesetDefinition } from '@/ruleset/types';

const attributes: AttributeDefinition[] = [
  {
    id: 'grit',
    label: 'Grit',
    type: 'number',
    role: 'resource',
    capAttributeId: 'gritCap',
  },
  {
    id: 'spark',
    label: 'Spark',
    type: 'number',
    role: 'resource',
    capAttributeId: 'sparkCap',
  },
  // Uncapped on purpose: step 5 must leave this one alone however high it goes.
  { id: 'fate', label: 'Fate', type: 'number', role: 'resource' },
  { id: 'gritCap', label: 'Grit Cap', type: 'number', role: 'cap' },
  { id: 'sparkCap', label: 'Spark Cap', type: 'number', role: 'cap' },
  { id: 'attuned', label: 'Attuned', type: 'flag', role: 'capability' },
];

const baseAttributes = {
  grit: num(2),
  spark: num(2),
  fate: num(1),
  gritCap: num(6),
  sparkCap: num(6),
  attuned: flag(false),
};

// `kin` membership is exactly [tinker, revenant] — `kin_secret` below is
// restricted to precisely that set, which is what arms the carve-out.
const callings: FacetCollection = {
  id: 'callings',
  singular: 'Calling',
  plural: 'Callings',
  selection: 'single',
  defaultEntryId: 'tinker',
  legacyField: 'archetypeId',
  groups: [
    { id: 'kin', label: 'Kin' },
    { id: 'construct', label: 'Construct' },
  ],
  contributes: { stage: 'base' },
  entries: [
    {
      id: 'tinker',
      label: 'Tinker',
      groups: ['kin'],
      attributes: { ...baseAttributes },
    },
    {
      id: 'sentinel',
      label: 'Sentinel',
      groups: ['construct'],
      attributes: { ...baseAttributes, grit: num(3), attuned: flag(true) },
    },
    {
      id: 'revenant',
      label: 'Revenant',
      groups: ['kin'],
      attributes: { ...baseAttributes },
    },
  ],
};

const knacks: FacetCollection = {
  id: 'knacks',
  singular: 'Knack',
  plural: 'Knacks',
  selection: 'multi',
  legacyField: 'traitIds',
  categories: [
    { id: 'forge', label: 'Forge', color: '#8E44AD' },
    { id: 'wit', label: 'Wit', color: '#16A085' },
  ],
  contributes: { deltaRoles: ['resource'], categoryScore: true },
  categoryBonuses: [
    {
      categoryId: 'forge',
      requiredScore: 2,
      grants: { attributeDeltas: { grit: 1 } },
    },
    {
      categoryId: 'wit',
      requiredScore: 3,
      grants: { attributeDeltas: { spark: 2 } },
    },
  ],
  scoreExclusions: [
    {
      whenCollectionId: 'callings',
      whenEntryId: 'revenant',
      groupId: 'kin',
    },
  ],
  entries: [
    {
      id: 'hammer_hand',
      label: 'Hammer Hand',
      description: 'Hits things until they work.',
      categoryId: 'forge',
      modifier: { attributeDeltas: { grit: 1 } },
    },
    {
      id: 'quick_read',
      label: 'Quick Read',
      description: 'Skims and retains.',
      categoryId: 'wit',
      modifier: { attributeDeltas: { spark: 1 } },
    },
    {
      // Restricted to exactly the `kin` group's membership. Carries a delta
      // as well, so the carve-out can be shown to suppress the *category
      // score* without suppressing the attribute change.
      id: 'kin_secret',
      label: 'Kin Secret',
      description: 'Passed down, never written.',
      categoryId: 'forge',
      requires: { callings: ['tinker', 'revenant'] },
      modifier: { attributeDeltas: { fate: 1 } },
    },
    {
      id: 'steady_hand',
      label: 'Steady Hand',
      description: 'Does not shake.',
      categoryId: 'wit',
    },
    {
      // Declares a cap delta the engine must NOT apply — `knacks` is
      // `deltaRoles: ['resource']` only.
      id: 'overclock',
      label: 'Overclock',
      description: 'Claims to raise the ceiling. It does not.',
      categoryId: 'wit',
      modifier: { attributeDeltas: { sparkCap: 2 } },
    },
  ],
};

// A second scored collection, entirely independent of `knacks` — proof a
// ruleset may declare more scored collections than the engine used to
// hardcode, not just more categories within the one it named.
const bonds: FacetCollection = {
  id: 'bonds',
  singular: 'Bond',
  plural: 'Bonds',
  selection: 'multi',
  categories: [
    { id: 'duty', label: 'Duty' },
    { id: 'kinship', label: 'Kinship' },
  ],
  contributes: { deltaRoles: ['resource'], categoryScore: true },
  categoryBonuses: [
    {
      categoryId: 'duty',
      requiredScore: 1,
      grants: { attributeDeltas: { fate: 1 } },
    },
  ],
  entries: [
    {
      id: 'oath_kept',
      label: 'Oath Kept',
      description: 'A debt honored.',
      categoryId: 'duty',
    },
    {
      id: 'old_friend',
      label: 'Old Friend',
      description: 'Someone who remembers who you were.',
      categoryId: 'kinship',
      modifier: { attributeDeltas: { grit: 1 } },
    },
  ],
};

const temperaments: FacetCollection = {
  id: 'temperaments',
  singular: 'Temperament',
  plural: 'Temperaments',
  selection: 'multi',
  maxSelections: 4,
  legacyField: 'qualityIds',
  entries: [
    { id: 'steadfast', label: 'Steadfast', description: 'Does not budge.' },
    {
      id: 'reckless',
      label: 'Reckless',
      description: 'Budges far too easily.',
      requires: { callings: ['revenant'] },
    },
  ],
};

const rigs: FacetCollection = {
  id: 'rigs',
  singular: 'Rig',
  plural: 'Rigs',
  selection: 'multi',
  authored: true,
  legacyField: 'modifications',
  contributes: { stage: 'postBonus', deltaRoles: ['resource', 'cap'] },
  entries: [],
};

const charms: FacetCollection = {
  id: 'charms',
  singular: 'Charm',
  plural: 'Charms',
  selection: 'catalog',
  entries: [
    {
      id: 'ward_charm',
      label: 'Ward Charm',
      description: 'Keeps the worst of it off.',
      materials: ['Salt', 'Iron Filing'],
    },
  ],
};

const clanTie: RelationshipTypeCollection = {
  id: 'clan_tie',
  singular: 'Clan Tie',
  plural: 'Clan Ties',
  appliesTo: ['character', 'character'],
  defaultEntryId: 'clan_neutral',
  entries: [
    { id: 'clan_ally', label: 'Clan Ally', role: 'positive' },
    { id: 'clan_neutral', label: 'Clan Neutral', role: 'neutral' },
    { id: 'clan_foe', label: 'Clan Foe', role: 'negative' },
  ],
};

const oath: RelationshipTypeCollection = {
  id: 'oath',
  singular: 'Oath',
  plural: 'Oaths',
  appliesTo: ['character', 'faction'],
  defaultEntryId: 'oath_free',
  entries: [
    { id: 'oath_sworn', label: 'Oath Sworn', role: 'positive' },
    { id: 'oath_free', label: 'Oath Free', role: 'neutral' },
    { id: 'oath_broken', label: 'Oath Broken', role: 'negative' },
  ],
};

// Exercises a directional (`symmetric: false`) entry alongside ordinary
// symmetric ones, so engine-level tests (bidirectional faction sync,
// role-based polarity) can prove both storage topologies against one fixture.
const pact: RelationshipTypeCollection = {
  id: 'pact',
  singular: 'Pact',
  plural: 'Pacts',
  appliesTo: ['faction', 'faction'],
  defaultEntryId: 'pact_rival',
  entries: [
    { id: 'pact_allied', label: 'Allied', role: 'positive' },
    { id: 'pact_rival', label: 'Rival', role: 'negative' },
    {
      id: 'pact_vassal',
      label: 'Vassal of',
      inverseLabel: 'Suzerain of',
      symmetric: false,
      role: 'neutral',
    },
  ],
};

export const mechanicsRuleset: RulesetDefinition = {
  id: 'mechanics',
  name: 'Mechanics Fixture',
  version: '1.0.0',
  terminology: {},
  attributes,
  facets: [callings, knacks, bonds, temperaments, rigs, charms],
  relationshipTypes: [clanTie, oath, pact],
  features: {
    quests: true,
    discord: false,
    map: false,
    influenceReport: true,
    relationshipGraph: false,
    characterStats: false,
    factionStats: false,
  },
  branding: { appName: 'Mechanics Fixture' },
};
