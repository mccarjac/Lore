/**
 * A neutral ruleset for testing the **engine's computation**, as distinct from
 * `genericRuleset.ts`, which tests that a **screen reads the provider**.
 *
 * They cannot be one fixture. `genericRuleset` deliberately has
 * `categoryBonuses: []`, no recipes and no `archetypeRules`, and several
 * screen tests depend on its exact shape — adding mechanics to it would move
 * numbers in the stats screens for reasons unrelated to what they assert.
 *
 * So this one carries exactly what `derived.ts`'s five-step pipeline needs to
 * be exercised without Afterworlds:
 *
 * - two capped resources (`grit`, `spark`) plus one uncapped (`fate`), since
 *   only resources declaring a `capAttributeId` clamp at step 5
 * - category bonuses at two different thresholds (step 3)
 * - a trait declaring a **cap** delta (`overclock`), which the engine must
 *   ignore — traits touch `role: 'resource'` only. Afterworlds' `smarts_20`
 *   is the real-world case; this proves the rule holds generally.
 * - an `archetypeRules` carve-out whose group membership exactly matches one
 *   trait's `allowedArchetypeIds`, which is the only way
 *   `excludeCategoryScoreFromGroupRestrictedTraits` fires
 *
 * Every id here is disjoint from `genericRuleset` and from the engine's
 * example ruleset — asserted in `genericRuleset.test.ts`.
 */
import { num, flag, type AttributeDefinition } from '@/ruleset/attributes';
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

export const mechanicsRuleset: RulesetDefinition = {
  id: 'mechanics',
  name: 'Mechanics Fixture',
  version: '1.0.0',
  terminology: {
    'archetype.singular': 'Calling',
    'archetype.plural': 'Callings',
    'trait.singular': 'Knack',
    'trait.plural': 'Knacks',
  },
  attributes,
  // `kin` membership is exactly [tinker, revenant] — `kin_secret` below is
  // restricted to precisely that set, which is what arms the carve-out.
  groups: [
    { id: 'kin', label: 'Kin' },
    { id: 'construct', label: 'Construct' },
  ],
  archetypes: [
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
  defaultArchetypeId: 'tinker',
  traitCategories: [
    { id: 'forge', label: 'Forge', color: '#8E44AD' },
    { id: 'wit', label: 'Wit', color: '#16A085' },
  ],
  traits: [
    {
      id: 'hammer_hand',
      name: 'Hammer Hand',
      description: 'Hits things until they work.',
      categoryId: 'forge',
      modifier: { attributeDeltas: { grit: 1 } },
    },
    {
      id: 'quick_read',
      name: 'Quick Read',
      description: 'Skims and retains.',
      categoryId: 'wit',
      modifier: { attributeDeltas: { spark: 1 } },
    },
    {
      // Restricted to exactly the `kin` group's membership. Carries a delta
      // as well, so the carve-out can be shown to suppress the *category
      // score* without suppressing the attribute change.
      id: 'kin_secret',
      name: 'Kin Secret',
      description: 'Passed down, never written.',
      categoryId: 'forge',
      allowedArchetypeIds: ['tinker', 'revenant'],
      modifier: { attributeDeltas: { fate: 1 } },
    },
    {
      id: 'steady_hand',
      name: 'Steady Hand',
      description: 'Does not shake.',
      categoryId: 'wit',
    },
    {
      // Declares a cap delta the engine must NOT apply — traits are
      // `role: 'resource'` only.
      id: 'overclock',
      name: 'Overclock',
      description: 'Claims to raise the ceiling. It does not.',
      categoryId: 'wit',
      modifier: { attributeDeltas: { sparkCap: 2 } },
    },
  ],
  qualities: [
    { id: 'steadfast', name: 'Steadfast', description: 'Does not budge.' },
    {
      id: 'reckless',
      name: 'Reckless',
      description: 'Budges far too easily.',
      allowedArchetypeIds: ['revenant'],
    },
  ],
  recipes: [
    {
      id: 'ward_charm',
      name: 'Ward Charm',
      description: 'Keeps the worst of it off.',
      materials: ['Salt', 'Iron Filing'],
    },
  ],
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
  archetypeRules: [
    {
      archetypeId: 'revenant',
      kind: 'excludeCategoryScoreFromGroupRestrictedTraits',
      groupId: 'kin',
    },
  ],
  features: {
    quests: true,
    recipes: true,
    discord: false,
    map: false,
    modifications: true,
    influenceReport: true,
    relationshipGraph: false,
    characterStats: false,
    factionStats: false,
  },
  limits: { maxQualities: 4 },
  branding: { appName: 'Mechanics Fixture' },
};
