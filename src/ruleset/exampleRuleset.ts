import { APP_NAME } from '@/branding';
import { flag, num, text, type AttributeDefinition } from './attributes';
import type { FacetCollection } from './facets';
import type { RulesetDefinition } from './types';

/**
 * A small, complete ruleset that demonstrates the schema and boots the app.
 *
 * This is what Lore ships as the engine's default — deliberately generic, so
 * "run the app" means "see the engine", not "see somebody's campaign". A
 * flavor supplies its own and points `src/activeRuleset.ts` at it.
 *
 * Two choices here are load-bearing rather than arbitrary:
 *
 * - **It overrides no terminology at all.** Every engine-core noun therefore
 *   comes from `DEFAULT_TERMINOLOGY` ("Character", "Faction", "Quest",
 *   "Resource", "Sponsor", "Map"), and every facet noun comes from the
 *   collection's own `singular`/`plural` below ("Archetype", "Trait",
 *   "Quality", "Modification"). That makes "the app boots with generic
 *   labels" literally checkable, and it is the only place the `useLabels` /
 *   `getLabel` fallback path is exercised in a running app rather than only
 *   under test.
 * - **`map` is off and absent.** The map is the one feature needing a bundled
 *   binary, and images belong to the ruleset that uses them. Shipping a
 *   placeholder PNG in the engine would put an asset in every fork's way for
 *   no benefit. Every other feature is on, so the engine's screens are all
 *   reachable out of the box.
 *
 * Five facet collections are declared — one more than the four the engine
 * used to hardcode, plus a catalog — proving the point of #51: a ruleset
 * says how many facet kinds its game needs, not the engine.
 */
const attributes: AttributeDefinition[] = [
  {
    id: 'stamina',
    label: 'Stamina',
    type: 'number',
    role: 'resource',
    capAttributeId: 'staminaCap',
  },
  {
    id: 'resolve',
    label: 'Resolve',
    type: 'number',
    role: 'resource',
    capAttributeId: 'resolveCap',
  },
  { id: 'staminaCap', label: 'Stamina Cap', type: 'number', role: 'cap' },
  { id: 'resolveCap', label: 'Resolve Cap', type: 'number', role: 'cap' },
  { id: 'veteran', label: 'Veteran', type: 'flag', role: 'capability' },
  // A freeform, per-character field — the #22 layer a ruleset gets for free.
  { id: 'background', label: 'Background', type: 'text', role: 'freeform' },
];

/** The old `archetypes` collection: single-select, seeds base attributes. */
const archetypes: FacetCollection = {
  id: 'archetypes',
  singular: 'Archetype',
  plural: 'Archetypes',
  selection: 'single',
  defaultEntryId: 'drifter',
  legacyField: 'archetypeId',
  groups: [{ id: 'folk', label: 'Folk' }],
  contributes: { stage: 'base' },
  entries: [
    {
      id: 'drifter',
      label: 'Drifter',
      groups: ['folk'],
      attributes: {
        stamina: num(3),
        resolve: num(2),
        staminaCap: num(8),
        resolveCap: num(6),
        veteran: flag(false),
        background: text(''),
      },
    },
    {
      id: 'artisan',
      label: 'Artisan',
      groups: ['folk'],
      attributes: {
        stamina: num(2),
        resolve: num(3),
        staminaCap: num(6),
        resolveCap: num(8),
        veteran: flag(false),
        background: text(''),
      },
    },
    {
      id: 'warden',
      label: 'Warden',
      groups: ['folk'],
      attributes: {
        stamina: num(4),
        resolve: num(2),
        staminaCap: num(9),
        resolveCap: num(5),
        veteran: flag(true),
        background: text(''),
      },
    },
  ],
};

/**
 * The old `traits` collection: multi-select, categorized, contributes
 * resource deltas and category score, and grants category bonuses.
 * `warden_kit` exercises both `requires` (restricted to the `warden`
 * archetype) and `links` (into the `recipes` catalog below).
 */
const traits: FacetCollection = {
  id: 'traits',
  singular: 'Trait',
  plural: 'Traits',
  selection: 'multi',
  legacyField: 'traitIds',
  categories: [
    { id: 'body', label: 'Body', color: '#C0392B' },
    { id: 'mind', label: 'Mind', color: '#2980B9' },
  ],
  contributes: { deltaRoles: ['resource'], categoryScore: true },
  categoryBonuses: [
    {
      categoryId: 'body',
      requiredScore: 2,
      grants: { attributeDeltas: { stamina: 1 } },
    },
    {
      categoryId: 'mind',
      requiredScore: 2,
      grants: { attributeDeltas: { resolve: 1 } },
    },
  ],
  entries: [
    {
      id: 'tough',
      label: 'Tough',
      description: 'Shrugs off what would stop most people.',
      categoryId: 'body',
      modifier: { attributeDeltas: { stamina: 1 } },
    },
    {
      id: 'studied',
      label: 'Studied',
      description: 'Has read about this exact situation.',
      categoryId: 'mind',
      modifier: { attributeDeltas: { resolve: 1 } },
    },
    {
      id: 'warden_kit',
      label: "Warden's Kit",
      description: 'Carries the tools of the post.',
      categoryId: 'body',
      requires: { archetypes: ['warden'] },
      links: { recipes: ['field_kit'] },
    },
  ],
};

/** The old `qualities` collection: multi-select, purely descriptive. */
const qualities: FacetCollection = {
  id: 'qualities',
  singular: 'Quality',
  plural: 'Qualities',
  selection: 'multi',
  maxSelections: 2,
  legacyField: 'qualityIds',
  entries: [
    { id: 'curious', label: 'Curious', description: 'Asks the next question.' },
    {
      id: 'stubborn',
      label: 'Stubborn',
      description: 'Asks the same question again.',
    },
  ],
};

/**
 * The old `modifications` collection: authored per character rather than
 * picked from a catalog, contributing after category bonuses so a
 * modification's category deltas never retroactively unlock one.
 */
const modifications: FacetCollection = {
  id: 'modifications',
  singular: 'Modification',
  plural: 'Modifications',
  selection: 'multi',
  authored: true,
  legacyField: 'modifications',
  contributes: { stage: 'postBonus', deltaRoles: ['resource', 'cap'] },
  entries: [],
};

/** The old `recipes` collection: a catalog, only ever reached via `links`. */
const recipes: FacetCollection = {
  id: 'recipes',
  singular: 'Recipe',
  plural: 'Recipes',
  selection: 'catalog',
  entries: [
    {
      id: 'field_kit',
      label: 'Field Kit',
      description: 'Enough to get someone back on their feet.',
      materials: ['Bandage', 'Splint'],
    },
  ],
};

export const exampleRuleset: RulesetDefinition = {
  id: 'example',
  name: 'Lore Example',
  version: '1.0.0',
  // Intentionally empty — see the note above.
  terminology: {},
  attributes,
  facets: [archetypes, traits, qualities, modifications, recipes],
  features: {
    quests: true,
    discord: true,
    map: false,
    influenceReport: true,
    relationshipGraph: true,
  },
  branding: { appName: APP_NAME },
};
