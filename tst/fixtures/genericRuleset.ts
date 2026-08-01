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
 * - `quests`, `discord` and `map` disabled — the flags that gate navigation
 * - no `map` at all, so `resolveAsset` returns undefined
 * - facet noun overrides live on each `FacetCollection` itself
 *   (`singular`/`plural`), not in `terminology` — since #51 that map covers
 *   only the engine's own core nouns
 */
import { num, flag, type AttributeDefinition } from '@/ruleset/attributes';
import type { FacetCollection } from '@/ruleset/facets';
import type { RelationshipTypeCollection } from '@/ruleset/relationships';
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

const lineages: FacetCollection = {
  id: 'lineages',
  singular: 'Lineage',
  plural: 'Lineages',
  selection: 'single',
  defaultEntryId: 'scholar',
  legacyField: 'archetypeId',
  groups: [{ id: 'mortal', label: 'Mortal' }],
  contributes: { stage: 'base' },
  entries: [
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
};

const talents: FacetCollection = {
  id: 'talents',
  singular: 'Talent',
  plural: 'Talents',
  categorySingular: 'Discipline',
  categoryPlural: 'Disciplines',
  selection: 'multi',
  legacyField: 'traitIds',
  categories: [
    { id: 'lore', label: 'Lore', color: '#112233' },
    { id: 'might', label: 'Might', color: '#445566' },
    // Deliberately colorless — the screen must cycle a palette rather than
    // return undefined.
    { id: 'guile', label: 'Guile' },
  ],
  contributes: { deltaRoles: ['resource'], categoryScore: true },
  categoryBonuses: [],
  entries: [
    {
      id: 'well_read',
      label: 'Well Read',
      description: 'Knows the old books.',
      categoryId: 'lore',
      modifier: { attributeDeltas: { focus: 1 } },
    },
    {
      id: 'strong_back',
      label: 'Strong Back',
      description: 'Carries more than seems wise.',
      categoryId: 'might',
      requires: { lineages: ['wanderer'] },
    },
  ],
};

const virtues: FacetCollection = {
  id: 'virtues',
  singular: 'Virtue',
  plural: 'Virtues',
  selection: 'multi',
  maxSelections: 1,
  legacyField: 'qualityIds',
  entries: [
    { id: 'patient', label: 'Patient', description: 'Waits things out.' },
  ],
};

const augments: FacetCollection = {
  id: 'augments',
  singular: 'Augment',
  plural: 'Augments',
  selection: 'multi',
  authored: true,
  legacyField: 'modifications',
  contributes: { stage: 'postBonus', deltaRoles: ['resource', 'cap'] },
  entries: [],
};

const rapport: RelationshipTypeCollection = {
  id: 'rapport',
  singular: 'Rapport',
  plural: 'Rapports',
  appliesTo: ['character', 'character'],
  defaultEntryId: 'wary',
  entries: [
    { id: 'kindred', label: 'Kindred', role: 'positive' },
    { id: 'wary', label: 'Wary', role: 'neutral' },
    { id: 'feuding', label: 'Feuding', role: 'negative' },
  ],
};

const allegiance: RelationshipTypeCollection = {
  id: 'allegiance',
  singular: 'Allegiance',
  plural: 'Allegiances',
  appliesTo: ['character', 'faction'],
  defaultEntryId: 'unsworn',
  entries: [
    { id: 'sworn', label: 'Sworn', role: 'positive' },
    { id: 'unsworn', label: 'Unsworn', role: 'neutral' },
    { id: 'outcast', label: 'Outcast', role: 'negative' },
  ],
};

// Exercises a directional entry (`symmetric: false`), the generalized form of
// the old faction-faction "standing" needed for hierarchy/composition
// relationships, alongside two ordinary symmetric ones.
const accord: RelationshipTypeCollection = {
  id: 'accord',
  singular: 'Accord',
  plural: 'Accords',
  appliesTo: ['faction', 'faction'],
  defaultEntryId: 'ceasefire',
  entries: [
    { id: 'concordat', label: 'Concordat', role: 'positive' },
    { id: 'ceasefire', label: 'Ceasefire', role: 'neutral' },
    { id: 'blood_feud', label: 'Blood Feud', role: 'negative' },
    {
      id: 'vassalage',
      label: 'Vassal of',
      inverseLabel: 'Suzerain of',
      symmetric: false,
      role: 'neutral',
    },
  ],
};

export const genericRuleset: RulesetDefinition = {
  id: 'fixture',
  name: 'Fixture Ruleset',
  version: '1.0.0',
  terminology: { 'map.label': 'Realm Map' },
  attributes,
  facets: [lineages, talents, virtues, augments],
  relationshipTypes: [rapport, allegiance, accord],
  features: {
    quests: false,
    discord: false,
    map: false,
    influenceReport: false,
    relationshipGraph: true,
    characterStats: false,
    factionStats: false,
  },
  branding: { appName: 'Fixture' },
};
