import { validateRuleset } from '@/ruleset/validate';
import type { RulesetDefinition } from '@/ruleset/types';

const baseRuleset = (): RulesetDefinition => ({
  id: 'fixture',
  name: 'Fixture Ruleset',
  version: '1.0.0',
  terminology: {},
  attributes: [
    {
      id: 'health',
      label: 'Health',
      type: 'number',
      role: 'resource',
      capAttributeId: 'healthCap',
    },
    { id: 'healthCap', label: 'Health Cap', type: 'number', role: 'cap' },
    { id: 'stamina', label: 'Stamina', type: 'number', role: 'resource' },
    { id: 'flight', label: 'Can Fly', type: 'flag', role: 'capability' },
    { id: 'homeworld', label: 'Homeworld', type: 'text' },
    {
      id: 'patron',
      label: 'Patron',
      type: 'ref',
      refCollection: 'archetypes',
    },
  ],
  facets: [
    {
      id: 'archetypes',
      singular: 'Archetype',
      plural: 'Archetypes',
      selection: 'single',
      defaultEntryId: 'human',
      groups: [{ id: 'organic', label: 'Organic' }],
      contributes: { stage: 'base' },
      entries: [
        {
          id: 'human',
          label: 'Human',
          groups: ['organic'],
          attributes: {
            health: { type: 'number', value: 2 },
            healthCap: { type: 'number', value: 5 },
            stamina: { type: 'number', value: 1 },
            flight: { type: 'flag', value: false },
          },
        },
      ],
    },
    {
      id: 'traits',
      singular: 'Trait',
      plural: 'Traits',
      selection: 'multi',
      categories: [{ id: 'strength', label: 'Strength' }],
      contributes: { deltaRoles: ['resource'], categoryScore: true },
      categoryBonuses: [
        {
          categoryId: 'strength',
          requiredScore: 3,
          grants: { attributeDeltas: { health: 1 } },
        },
      ],
      scoreExclusions: [
        {
          whenCollectionId: 'archetypes',
          whenEntryId: 'human',
          groupId: 'organic',
        },
      ],
      entries: [
        {
          id: 'trait_1',
          label: 'Brawler',
          description: '',
          categoryId: 'strength',
          requires: { archetypes: ['human'] },
          links: { recipes: ['recipe_1'] },
          modifier: {
            attributeDeltas: { health: 1, healthCap: 1 },
            categoryDeltas: { traits: { strength: 1 } },
          },
        },
      ],
    },
    {
      id: 'qualities',
      singular: 'Quality',
      plural: 'Qualities',
      selection: 'multi',
      maxSelections: 3,
      entries: [
        {
          id: 'quality_1',
          label: 'Stoic',
          description: '',
          requires: { archetypes: ['human'] },
        },
      ],
    },
    {
      id: 'recipes',
      singular: 'Recipe',
      plural: 'Recipes',
      selection: 'catalog',
      entries: [
        {
          id: 'recipe_1',
          label: 'Bandage',
          description: '',
          materials: ['Cloth'],
        },
      ],
    },
  ],
  features: {
    quests: true,
    discord: true,
    map: true,
    influenceReport: true,
    relationshipGraph: true,
    characterStats: true,
    factionStats: true,
  },
  map: { imageKey: 'map' },
  branding: { appName: 'Fixture App' },
});

/** Convenience accessors into `baseRuleset()`'s facet collections. */
const archetypes = (ruleset: RulesetDefinition) => ruleset.facets[0];
const traits = (ruleset: RulesetDefinition) => ruleset.facets[1];
const qualities = (ruleset: RulesetDefinition) => ruleset.facets[2];

describe('validateRuleset', () => {
  it('accepts a well-formed fixture ruleset', () => {
    const result = validateRuleset(baseRuleset());
    expect(result).toEqual({ valid: true, issues: [] });
  });

  it('requires non-empty id/name/version', () => {
    const ruleset = { ...baseRuleset(), id: '', name: '', version: '' };
    const result = validateRuleset(ruleset);
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        { path: 'id', message: expect.any(String) },
        { path: 'name', message: expect.any(String) },
        { path: 'version', message: expect.any(String) },
      ])
    );
  });

  it('flags duplicate category ids within a collection', () => {
    const ruleset = baseRuleset();
    traits(ruleset).categories = [
      ...(traits(ruleset).categories ?? []),
      { id: 'strength', label: 'Strength Again' },
    ];
    const result = validateRuleset(ruleset);
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({
      path: 'facets[1].categories[1].id',
      message: "Duplicate id 'strength' in facets[1].categories",
    });
  });

  it('flags duplicate facet collection ids', () => {
    const ruleset = baseRuleset();
    ruleset.facets = [...ruleset.facets, { ...qualities(ruleset) }];
    const result = validateRuleset(ruleset);
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({
      path: 'facets[4].id',
      message: "Duplicate id 'qualities' in facets",
    });
  });

  it('flags an entry with an unresolvable categoryId', () => {
    const ruleset = baseRuleset();
    traits(ruleset).entries[0].categoryId = 'nonexistent';
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'facets[1].entries[0].categoryId',
      message: "Unknown category id 'nonexistent' in facet collection 'traits'",
    });
  });

  it('flags an entry with an unresolvable requires id', () => {
    const ruleset = baseRuleset();
    traits(ruleset).entries[0].requires = { archetypes: ['nonexistent'] };
    qualities(ruleset).entries[0].requires = { archetypes: ['nonexistent'] };
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'facets[1].entries[0].requires.archetypes[0]',
      message:
        "Unknown entry id 'nonexistent' in facet collection 'archetypes'",
    });
    expect(result.issues).toContainEqual({
      path: 'facets[2].entries[0].requires.archetypes[0]',
      message:
        "Unknown entry id 'nonexistent' in facet collection 'archetypes'",
    });
  });

  it('flags an entry with an unresolvable links id', () => {
    const ruleset = baseRuleset();
    traits(ruleset).entries[0].links = { recipes: ['nonexistent'] };
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'facets[1].entries[0].links.recipes[0]',
      message: "Unknown entry id 'nonexistent' in facet collection 'recipes'",
    });
  });

  it('flags modifier keys that resolve to nothing', () => {
    const ruleset = baseRuleset();
    traits(ruleset).entries[0].modifier = {
      attributeDeltas: { nonexistent: 1 },
      categoryDeltas: { traits: { nonexistent: 1 } },
    };
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'facets[1].entries[0].modifier.attributeDeltas.nonexistent',
      message: "Unknown attribute id 'nonexistent'",
    });
    expect(result.issues).toContainEqual({
      path: 'facets[1].entries[0].modifier.categoryDeltas.traits.nonexistent',
      message: "Unknown category id 'nonexistent' in facet collection 'traits'",
    });
  });

  it('flags a categoryDeltas key naming an unknown facet collection', () => {
    const ruleset = baseRuleset();
    traits(ruleset).entries[0].modifier = {
      categoryDeltas: { nonexistent: { strength: 1 } },
    };
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'facets[1].entries[0].modifier.categoryDeltas.nonexistent',
      message: "Unknown facet collection id 'nonexistent'",
    });
  });

  it('flags a delta targeting a non-numeric attribute', () => {
    const ruleset = baseRuleset();
    traits(ruleset).entries[0].modifier = {
      attributeDeltas: { homeworld: 1 },
    };
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'facets[1].entries[0].modifier.attributeDeltas.homeworld',
      message:
        "Attribute 'homeworld' is 'text'; only 'number' attributes accept deltas",
    });
  });

  it('flags an entry group that does not resolve', () => {
    const ruleset = baseRuleset();
    archetypes(ruleset).entries[0].groups = ['nonexistent'];
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'facets[0].entries[0].groups[0]',
      message:
        "Unknown group id 'nonexistent' in facet collection 'archetypes'",
    });
  });

  it('flags a missing value for a declared resource or cap on a base entry', () => {
    const ruleset = baseRuleset();
    delete archetypes(ruleset).entries[0].attributes!.stamina;
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'facets[0].entries[0].attributes.stamina',
      message: "Missing required attribute 'stamina'",
    });
  });

  it('flags an undeclared attribute id on a base entry', () => {
    const ruleset = baseRuleset();
    archetypes(ruleset).entries[0].attributes!.nonexistent = {
      type: 'number',
      value: 1,
    };
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'facets[0].entries[0].attributes.nonexistent',
      message:
        "Unknown attribute id 'nonexistent' (not declared in ruleset.attributes)",
    });
  });

  it('flags a value whose type contradicts its declaration', () => {
    const ruleset = baseRuleset();
    archetypes(ruleset).entries[0].attributes!.health = {
      type: 'text',
      value: 'lots',
    };
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'facets[0].entries[0].attributes.health',
      message: "Attribute 'health' is declared as 'number' but holds 'text'",
    });
  });

  it('flags a ref attribute pointing at a nonexistent id', () => {
    const ruleset = baseRuleset();
    archetypes(ruleset).entries[0].attributes!.patron = {
      type: 'ref',
      value: 'nonexistent',
    };
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'facets[0].entries[0].attributes.patron',
      message:
        "Attribute 'patron' references unknown archetypes id 'nonexistent'",
    });
  });

  it('accepts a ref attribute that resolves', () => {
    const ruleset = baseRuleset();
    archetypes(ruleset).entries[0].attributes!.patron = {
      type: 'ref',
      value: 'human',
    };
    expect(validateRuleset(ruleset).valid).toBe(true);
  });

  it('flags a number outside its declared bounds', () => {
    const ruleset = baseRuleset();
    ruleset.attributes[0] = { ...ruleset.attributes[0], min: 0, max: 10 };
    archetypes(ruleset).entries[0].attributes!.health = {
      type: 'number',
      value: 99,
    };
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'facets[0].entries[0].attributes.health',
      message: "Attribute 'health' is 99, above its maximum of 10",
    });
  });

  it('flags a capAttributeId that does not point at a cap-role attribute', () => {
    const ruleset = baseRuleset();
    ruleset.attributes[0] = {
      ...ruleset.attributes[0],
      capAttributeId: 'stamina',
    };
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'attributes[0].capAttributeId',
      message:
        "Attribute 'stamina' has role 'resource'; a cap must have role 'cap'",
    });
  });

  it('flags a category bonus with an unresolvable categoryId', () => {
    const ruleset = baseRuleset();
    traits(ruleset).categoryBonuses![0].categoryId = 'nonexistent';
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'facets[1].categoryBonuses[0].categoryId',
      message: "Unknown category id 'nonexistent' in facet collection 'traits'",
    });
  });

  it('flags a non-positive-integer requiredScore', () => {
    const ruleset = baseRuleset();
    traits(ruleset).categoryBonuses![0].requiredScore = 0;
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'facets[1].categoryBonuses[0].requiredScore',
      message: 'requiredScore must be a positive integer',
    });
  });

  it('flags a category bonus grant key that does not resolve', () => {
    const ruleset = baseRuleset();
    traits(ruleset).categoryBonuses![0].grants = {
      attributeDeltas: { nonexistent: 1 },
    };
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'facets[1].categoryBonuses[0].grants.attributeDeltas.nonexistent',
      message: "Unknown attribute id 'nonexistent'",
    });
  });

  it('flags a scoreExclusion with unresolvable ids', () => {
    const ruleset = baseRuleset();
    traits(ruleset).scoreExclusions = [
      {
        whenCollectionId: 'archetypes',
        whenEntryId: 'nonexistent',
        groupId: 'nonexistent',
      },
    ];
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'facets[1].scoreExclusions[0].whenEntryId',
      message:
        "Unknown entry id 'nonexistent' in facet collection 'archetypes'",
    });
    expect(result.issues).toContainEqual({
      path: 'facets[1].scoreExclusions[0].groupId',
      message:
        "Unknown group id 'nonexistent' in facet collection 'archetypes'",
    });
  });

  it('flags a scoreExclusion naming an unknown whenCollectionId', () => {
    const ruleset = baseRuleset();
    traits(ruleset).scoreExclusions = [
      {
        whenCollectionId: 'nonexistent',
        whenEntryId: 'x',
        groupId: 'strength',
      },
    ];
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'facets[1].scoreExclusions[0].whenCollectionId',
      message: "Unknown facet collection id 'nonexistent'",
    });
  });

  it('flags a defaultEntryId that resolves to nothing', () => {
    const ruleset = baseRuleset();
    archetypes(ruleset).defaultEntryId = 'nonexistent';
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'facets[0].defaultEntryId',
      message:
        "Unknown entry id 'nonexistent' in facet collection 'archetypes'",
    });
  });

  it('accepts an omitted defaultEntryId', () => {
    const ruleset = baseRuleset();
    delete archetypes(ruleset).defaultEntryId;
    expect(validateRuleset(ruleset).valid).toBe(true);
  });

  it('flags an authored collection that declares catalog entries', () => {
    const ruleset = baseRuleset();
    ruleset.facets.push({
      id: 'modifications',
      singular: 'Modification',
      plural: 'Modifications',
      selection: 'multi',
      authored: true,
      entries: [{ id: 'stray', label: 'Stray' }],
    });
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'facets[4].entries',
      message: 'an authored collection must declare no catalog entries',
    });
  });

  it('flags a catalog collection that declares contributes', () => {
    const ruleset = baseRuleset();
    ruleset.facets[3] = {
      ...ruleset.facets[3],
      contributes: { deltaRoles: ['resource'] },
    };
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'facets[3].contributes',
      message:
        'a catalog collection is never held by a character, so it cannot contribute to derived stats',
    });
  });

  it('flags a missing feature flag rather than gating the feature off', () => {
    const ruleset = baseRuleset();
    delete (ruleset.features as Partial<typeof ruleset.features>).quests;
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'features.quests',
      message: 'features.quests must be a boolean',
    });
  });

  it('flags an empty map.imageKey when map is present', () => {
    const ruleset = baseRuleset();
    ruleset.map = { imageKey: '' };
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'map.imageKey',
      message: 'imageKey must be non-empty when map is present',
    });
  });

  it('flags empty branding asset keys when present', () => {
    const ruleset = baseRuleset();
    ruleset.branding = { appName: 'Fixture', iconKey: '', splashKey: '' };
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'branding.iconKey',
      message: 'iconKey must be non-empty when present',
    });
    expect(result.issues).toContainEqual({
      path: 'branding.splashKey',
      message: 'splashKey must be non-empty when present',
    });
  });

  it('flags a non-serializable value anywhere in the ruleset', () => {
    const ruleset = baseRuleset() as unknown as Record<string, unknown>;
    (ruleset.branding as Record<string, unknown>).onSave = () => undefined;
    const result = validateRuleset(ruleset as unknown as RulesetDefinition);
    expect(result.issues).toContainEqual({
      path: 'branding.onSave',
      message: expect.stringContaining('JSON-serializable'),
    });
  });

  it('flags a class instance embedded in the ruleset as non-serializable', () => {
    class Weird {
      value = 1;
    }
    const ruleset = baseRuleset() as unknown as Record<string, unknown>;
    (
      (ruleset.facets as Array<Record<string, unknown>>)[0].entries as Array<
        Record<string, unknown>
      >
    )[0].weird = new Weird();
    const result = validateRuleset(ruleset as unknown as RulesetDefinition);
    expect(result.issues).toContainEqual({
      path: 'facets[0].entries[0].weird',
      message: expect.stringContaining('JSON-serializable'),
    });
  });
});

describe('attribute declaration checks', () => {
  it('flags an attribute with an empty id or label', () => {
    const ruleset = baseRuleset();
    ruleset.attributes.push({ id: '', label: '', type: 'text' });
    const result = validateRuleset(ruleset);

    const index = ruleset.attributes.length - 1;
    expect(result.issues).toContainEqual({
      path: `attributes[${index}].id`,
      message: 'id must be non-empty',
    });
    expect(result.issues).toContainEqual({
      path: `attributes[${index}].label`,
      message: 'label must be non-empty',
    });
  });

  it('flags a capAttributeId on a non-resource attribute', () => {
    const ruleset = baseRuleset();
    ruleset.attributes.push({
      id: 'mood',
      label: 'Mood',
      type: 'number',
      role: 'freeform',
      capAttributeId: 'healthCap',
    });
    const result = validateRuleset(ruleset);

    expect(result.issues).toContainEqual({
      path: `attributes[${ruleset.attributes.length - 1}].capAttributeId`,
      message:
        "Only attributes with role 'resource' may declare a capAttributeId",
    });
  });

  it('flags a capAttributeId pointing at an attribute that does not exist', () => {
    const ruleset = baseRuleset();
    ruleset.attributes[0] = {
      ...ruleset.attributes[0],
      capAttributeId: 'nonexistent',
    };
    const result = validateRuleset(ruleset);

    expect(result.issues).toContainEqual({
      path: 'attributes[0].capAttributeId',
      message: "Unknown attribute id 'nonexistent'",
    });
  });

  it('flags refCollection on a non-ref attribute', () => {
    const ruleset = baseRuleset();
    ruleset.attributes[1] = {
      ...ruleset.attributes[1],
      refCollection: 'archetypes',
    };
    const result = validateRuleset(ruleset);

    expect(result.issues).toContainEqual({
      path: 'attributes[1].refCollection',
      message: "refCollection is only meaningful for type 'ref'",
    });
  });

  it('flags min/max on a non-number attribute', () => {
    const ruleset = baseRuleset();
    ruleset.attributes[4] = { ...ruleset.attributes[4], min: 0, max: 3 };
    const result = validateRuleset(ruleset);

    expect(result.issues).toContainEqual({
      path: 'attributes[4].min/max',
      message: "min/max are only meaningful for type 'number'",
    });
  });
});

describe('ref resolution across every collection', () => {
  it.each([
    ['traits', 'trait_1'],
    ['qualities', 'quality_1'],
    ['archetypes', 'human'],
    ['recipes', 'recipe_1'],
  ] as const)('resolves a %s ref', (collectionId, validId) => {
    const ruleset = baseRuleset();
    ruleset.attributes.push({
      id: 'pointer',
      label: 'Pointer',
      type: 'ref',
      refCollection: collectionId,
    });

    archetypes(ruleset).entries[0].attributes!.pointer = {
      type: 'ref',
      value: validId,
    };
    expect(validateRuleset(ruleset).valid).toBe(true);

    archetypes(ruleset).entries[0].attributes!.pointer = {
      type: 'ref',
      value: 'nonexistent',
    };
    expect(validateRuleset(ruleset).issues).toContainEqual({
      path: 'facets[0].entries[0].attributes.pointer',
      message: `Attribute 'pointer' references unknown ${collectionId} id 'nonexistent'`,
    });
  });

  it('resolves a group ref', () => {
    const ruleset = baseRuleset();
    ruleset.attributes.push({
      id: 'pointer',
      label: 'Pointer',
      type: 'ref',
      refCollection: 'groups',
    });

    // `groups` is not a facet collection id itself; `resolveRef` only knows
    // entry ids per collection, so a `groups`-typed ref has nothing to
    // resolve against and is always reported unknown. This is a deliberate
    // scope boundary: groups are validated structurally (via `entry.groups`)
    // rather than through the generic `ref` mechanism.
    archetypes(ruleset).entries[0].attributes!.pointer = {
      type: 'ref',
      value: 'organic',
    };
    expect(validateRuleset(ruleset).issues).toContainEqual({
      path: 'facets[0].entries[0].attributes.pointer',
      message: "Attribute 'pointer' references unknown groups id 'organic'",
    });
  });
});
