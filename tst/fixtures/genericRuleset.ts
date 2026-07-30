/**
 * A deliberately non-Afterworlds ruleset, for tests that need to prove a
 * screen reads the provider rather than the bundled data.
 *
 * Every value here is chosen to be *wrong* for Afterworlds, so a screen that
 * still reaches for `AVAILABLE_PERKS` or `SPECIES_BASE_STATS` fails visibly
 * instead of coincidentally passing:
 *
 * - three resources, not the health/limit pair — catches a hardcoded quartet
 * - three trait categories, two colored and one not — exercises the palette
 *   fallback that a twelve-entry Record could never reach
 * - `quests`, `discord`, `map` and `recipes` disabled — the flags that gate
 *   navigation
 * - no `map` at all, so `resolveAsset` returns undefined
 */
import { num, flag, type AttributeDefinition } from '@/ruleset/attributes';
import type { RulesetDefinition } from '@/ruleset/types';

const attributes: AttributeDefinition[] = [
  {
    id: 'vigor',
    label: 'Vigor',
    type: 'number',
    role: 'resource',
    capAttributeId: 'vigorCap',
  },
  {
    id: 'focus',
    label: 'Focus',
    type: 'number',
    role: 'resource',
    capAttributeId: 'focusCap',
  },
  // A third resource with no cap — the engine only clamps resources that
  // declare one, and the form still owes it an input.
  { id: 'luck', label: 'Luck', type: 'number', role: 'resource' },
  { id: 'vigorCap', label: 'Vigor Cap', type: 'number', role: 'cap' },
  { id: 'focusCap', label: 'Focus Cap', type: 'number', role: 'cap' },
  // Capability flags must NOT get a numeric input in the modification editor.
  { id: 'canFly', label: 'Can Fly', type: 'flag', role: 'capability' },
];

export const genericRuleset: RulesetDefinition = {
  id: 'fixture',
  name: 'Fixture Ruleset',
  version: '1.0.0',
  terminology: {
    'archetype.singular': 'Lineage',
    'archetype.plural': 'Lineages',
    'trait.singular': 'Talent',
    'trait.plural': 'Talents',
    'traitCategory.singular': 'Discipline',
    'traitCategory.plural': 'Disciplines',
    'quality.singular': 'Virtue',
    'quality.plural': 'Virtues',
    'modification.singular': 'Augment',
    'modification.plural': 'Augments',
    'map.label': 'Realm Map',
  },
  attributes,
  groups: [{ id: 'mortal', label: 'Mortal' }],
  archetypes: [
    {
      id: 'wanderer',
      label: 'Wanderer',
      groups: ['mortal'],
      attributes: {
        vigor: num(3),
        focus: num(2),
        luck: num(1),
        vigorCap: num(8),
        focusCap: num(6),
        canFly: flag(false),
      },
    },
    {
      id: 'scholar',
      label: 'Scholar',
      groups: ['mortal'],
      attributes: {
        vigor: num(1),
        focus: num(4),
        luck: num(2),
        vigorCap: num(5),
        focusCap: num(10),
        canFly: flag(false),
      },
    },
  ],
  defaultArchetypeId: 'scholar',
  traitCategories: [
    { id: 'lore', label: 'Lore', color: '#112233' },
    { id: 'might', label: 'Might', color: '#445566' },
    // Deliberately colorless — the screen must cycle a palette rather than
    // return undefined.
    { id: 'guile', label: 'Guile' },
  ],
  traits: [
    {
      id: 'well_read',
      name: 'Well Read',
      description: 'Knows the old books.',
      categoryId: 'lore',
      modifier: { attributeDeltas: { focus: 1 } },
    },
    {
      id: 'strong_back',
      name: 'Strong Back',
      description: 'Carries more than seems wise.',
      categoryId: 'might',
      allowedArchetypeIds: ['wanderer'],
    },
  ],
  qualities: [
    { id: 'patient', name: 'Patient', description: 'Waits things out.' },
  ],
  categoryBonuses: [],
  features: {
    quests: false,
    recipes: false,
    discord: false,
    map: false,
    modifications: true,
    influenceReport: false,
    relationshipGraph: true,
    characterStats: false,
    factionStats: false,
  },
  limits: { maxQualities: 1 },
  branding: { appName: 'Fixture' },
};
