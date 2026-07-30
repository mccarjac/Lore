import { APP_NAME } from '@/branding';
import { flag, num, text, type AttributeDefinition } from './attributes';
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
 * - **It overrides no terminology at all.** Every noun therefore comes from
 *   `DEFAULT_TERMINOLOGY` — "Archetype", "Trait", "Category", "Quality",
 *   "Modification", "Sponsor", "Map". That makes "the app boots with generic
 *   labels" literally checkable, and it is the only place the `useLabels` /
 *   `getLabel` fallback path is exercised in a running app rather than only
 *   under test.
 * - **`map` is off and absent.** The map is the one feature needing a bundled
 *   binary, and images belong to the ruleset that uses them. Shipping a
 *   placeholder PNG in the engine would put an asset in every fork's way for
 *   no benefit. Every other feature is on, so the engine's screens are all
 *   reachable out of the box.
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

export const exampleRuleset: RulesetDefinition = {
  id: 'example',
  name: 'Lore Example',
  version: '1.0.0',
  // Intentionally empty — see the note above.
  terminology: {},
  attributes,
  groups: [{ id: 'folk', label: 'Folk' }],
  archetypes: [
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
  defaultArchetypeId: 'drifter',
  traitCategories: [
    { id: 'body', label: 'Body', color: '#C0392B' },
    { id: 'mind', label: 'Mind', color: '#2980B9' },
  ],
  traits: [
    {
      id: 'tough',
      name: 'Tough',
      description: 'Shrugs off what would stop most people.',
      categoryId: 'body',
      modifier: { attributeDeltas: { stamina: 1 } },
    },
    {
      id: 'studied',
      name: 'Studied',
      description: 'Has read about this exact situation.',
      categoryId: 'mind',
      modifier: { attributeDeltas: { resolve: 1 } },
    },
    {
      id: 'warden_kit',
      name: "Warden's Kit",
      description: 'Carries the tools of the post.',
      categoryId: 'body',
      allowedArchetypeIds: ['warden'],
      recipeIds: ['field_kit'],
    },
  ],
  qualities: [
    { id: 'curious', name: 'Curious', description: 'Asks the next question.' },
    {
      id: 'stubborn',
      name: 'Stubborn',
      description: 'Asks the same question again.',
    },
  ],
  recipes: [
    {
      id: 'field_kit',
      name: 'Field Kit',
      description: 'Enough to get someone back on their feet.',
      materials: ['Bandage', 'Splint'],
    },
  ],
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
  features: {
    quests: true,
    recipes: true,
    discord: true,
    map: false,
    modifications: true,
    influenceReport: false,
    relationshipGraph: false,
    characterStats: false,
    factionStats: false,
  },
  limits: { maxQualities: 2 },
  branding: { appName: APP_NAME },
};
