import { validateRuleset } from '@/ruleset/validate';
import { afterworldsRuleset } from '@/ruleset/defaultRuleset';
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
  groups: [{ id: 'organic', label: 'Organic' }],
  archetypes: [
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
  traitCategories: [{ id: 'strength', label: 'Strength' }],
  traits: [
    {
      id: 'trait_1',
      name: 'Brawler',
      description: '',
      categoryId: 'strength',
      allowedArchetypeIds: ['human'],
      recipeIds: ['recipe_1'],
      modifier: {
        attributeDeltas: { health: 1, healthCap: 1 },
        categoryDeltas: { strength: 1 },
      },
    },
  ],
  qualities: [
    {
      id: 'quality_1',
      name: 'Stoic',
      description: '',
      allowedArchetypeIds: ['human'],
    },
  ],
  recipes: [
    {
      id: 'recipe_1',
      name: 'Bandage',
      description: '',
      materials: ['Cloth'],
    },
  ],
  categoryBonuses: [
    {
      categoryId: 'strength',
      requiredScore: 3,
      grants: { attributeDeltas: { health: 1 } },
    },
  ],
  archetypeRules: [
    {
      archetypeId: 'human',
      kind: 'excludeCategoryScoreFromGroupRestrictedTraits',
      groupId: 'organic',
    },
  ],
  features: {
    quests: true,
    recipes: true,
    discord: true,
    map: true,
    gitSync: true,
    modifications: true,
    influenceReport: true,
    relationshipGraph: true,
  },
  limits: { maxQualities: 3 },
  map: { imageKey: 'map' },
  branding: { appName: 'Fixture App' },
});

describe('validateRuleset', () => {
  it('accepts a well-formed fixture ruleset', () => {
    const result = validateRuleset(baseRuleset());
    expect(result).toEqual({ valid: true, issues: [] });
  });

  it('accepts the real afterworlds ruleset', () => {
    const result = validateRuleset(afterworldsRuleset);
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
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

  it('flags duplicate ids within a collection', () => {
    const ruleset = baseRuleset();
    ruleset.traitCategories = [
      ...ruleset.traitCategories,
      { id: 'strength', label: 'Strength Again' },
    ];
    const result = validateRuleset(ruleset);
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({
      path: 'traitCategories[1].id',
      message: "Duplicate id 'strength' in traitCategories",
    });
  });

  it('flags a trait with an unresolvable categoryId', () => {
    const ruleset = baseRuleset();
    ruleset.traits[0].categoryId = 'nonexistent';
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'traits[0].categoryId',
      message: "Unknown traitCategory id 'nonexistent'",
    });
  });

  it('flags a trait/quality with an unresolvable allowedArchetypeId', () => {
    const ruleset = baseRuleset();
    ruleset.traits[0].allowedArchetypeIds = ['nonexistent'];
    ruleset.qualities[0].allowedArchetypeIds = ['nonexistent'];
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'traits[0].allowedArchetypeIds[0]',
      message: "Unknown archetype id 'nonexistent'",
    });
    expect(result.issues).toContainEqual({
      path: 'qualities[0].allowedArchetypeIds[0]',
      message: "Unknown archetype id 'nonexistent'",
    });
  });

  it('flags a trait with an unresolvable recipeId', () => {
    const ruleset = baseRuleset();
    ruleset.traits[0].recipeIds = ['nonexistent'];
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'traits[0].recipeIds[0]',
      message: "Unknown recipe id 'nonexistent'",
    });
  });

  it('flags modifier keys that resolve to nothing', () => {
    const ruleset = baseRuleset();
    ruleset.traits[0].modifier = {
      attributeDeltas: { nonexistent: 1 },
      categoryDeltas: { nonexistent: 1 },
    };
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'traits[0].modifier.attributeDeltas.nonexistent',
      message: "Unknown attribute id 'nonexistent'",
    });
    expect(result.issues).toContainEqual({
      path: 'traits[0].modifier.categoryDeltas.nonexistent',
      message: "Unknown traitCategory id 'nonexistent'",
    });
  });

  it('flags a delta targeting a non-numeric attribute', () => {
    const ruleset = baseRuleset();
    ruleset.traits[0].modifier = { attributeDeltas: { homeworld: 1 } };
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'traits[0].modifier.attributeDeltas.homeworld',
      message:
        "Attribute 'homeworld' is 'text'; only 'number' attributes accept deltas",
    });
  });

  it('flags an archetype group that does not resolve', () => {
    const ruleset = baseRuleset();
    ruleset.archetypes[0].groups = ['nonexistent'];
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'archetypes[0].groups[0]',
      message: "Unknown group id 'nonexistent'",
    });
  });

  it('flags a missing value for a declared resource or cap', () => {
    const ruleset = baseRuleset();
    delete ruleset.archetypes[0].attributes.stamina;
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'archetypes[0].attributes.stamina',
      message: "Missing required attribute 'stamina'",
    });
  });

  it('flags an undeclared attribute id on an archetype', () => {
    const ruleset = baseRuleset();
    ruleset.archetypes[0].attributes.nonexistent = {
      type: 'number',
      value: 1,
    };
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'archetypes[0].attributes.nonexistent',
      message:
        "Unknown attribute id 'nonexistent' (not declared in ruleset.attributes)",
    });
  });

  it('flags a value whose type contradicts its declaration', () => {
    const ruleset = baseRuleset();
    ruleset.archetypes[0].attributes.health = { type: 'text', value: 'lots' };
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'archetypes[0].attributes.health',
      message: "Attribute 'health' is declared as 'number' but holds 'text'",
    });
  });

  it('flags a ref attribute pointing at a nonexistent id', () => {
    const ruleset = baseRuleset();
    ruleset.archetypes[0].attributes.patron = {
      type: 'ref',
      value: 'nonexistent',
    };
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'archetypes[0].attributes.patron',
      message:
        "Attribute 'patron' references unknown archetypes id 'nonexistent'",
    });
  });

  it('accepts a ref attribute that resolves', () => {
    const ruleset = baseRuleset();
    ruleset.archetypes[0].attributes.patron = { type: 'ref', value: 'human' };
    expect(validateRuleset(ruleset).valid).toBe(true);
  });

  it('flags a number outside its declared bounds', () => {
    const ruleset = baseRuleset();
    ruleset.attributes[0] = { ...ruleset.attributes[0], min: 0, max: 10 };
    ruleset.archetypes[0].attributes.health = { type: 'number', value: 99 };
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'archetypes[0].attributes.health',
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
    ruleset.categoryBonuses[0].categoryId = 'nonexistent';
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'categoryBonuses[0].categoryId',
      message: "Unknown traitCategory id 'nonexistent'",
    });
  });

  it('flags a non-positive-integer requiredScore', () => {
    const ruleset = baseRuleset();
    ruleset.categoryBonuses[0].requiredScore = 0;
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'categoryBonuses[0].requiredScore',
      message: 'requiredScore must be a positive integer',
    });
  });

  it('flags a category bonus grant key that does not resolve', () => {
    const ruleset = baseRuleset();
    ruleset.categoryBonuses[0].grants = {
      attributeDeltas: { nonexistent: 1 },
    };
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'categoryBonuses[0].grants.attributeDeltas.nonexistent',
      message: "Unknown attribute id 'nonexistent'",
    });
  });

  it('flags an archetypeRule with unresolvable ids', () => {
    const ruleset = baseRuleset();
    ruleset.archetypeRules = [
      {
        archetypeId: 'nonexistent',
        kind: 'excludeCategoryScoreFromGroupRestrictedTraits',
        groupId: 'nonexistent',
      },
    ];
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'archetypeRules[0].archetypeId',
      message: "Unknown archetype id 'nonexistent'",
    });
    expect(result.issues).toContainEqual({
      path: 'archetypeRules[0].groupId',
      message: "Unknown group id 'nonexistent'",
    });
  });

  it('flags a defaultArchetypeId that resolves to nothing', () => {
    const ruleset = baseRuleset();
    ruleset.defaultArchetypeId = 'nonexistent';
    const result = validateRuleset(ruleset);
    expect(result.issues).toContainEqual({
      path: 'defaultArchetypeId',
      message: "Unknown archetype id 'nonexistent'",
    });
  });

  it('accepts an omitted defaultArchetypeId', () => {
    const ruleset = baseRuleset();
    delete ruleset.defaultArchetypeId;
    expect(validateRuleset(ruleset).valid).toBe(true);
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
    (ruleset.archetypes as Array<Record<string, unknown>>)[0].weird =
      new Weird();
    const result = validateRuleset(ruleset as unknown as RulesetDefinition);
    expect(result.issues).toContainEqual({
      path: 'archetypes[0].weird',
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
    ['traitCategories', 'strength'],
    ['groups', 'organic'],
    ['recipes', 'recipe_1'],
  ] as const)('resolves a %s ref', (collection, validId) => {
    const ruleset = baseRuleset();
    ruleset.attributes.push({
      id: 'pointer',
      label: 'Pointer',
      type: 'ref',
      refCollection: collection,
    });

    ruleset.archetypes[0].attributes.pointer = {
      type: 'ref',
      value: validId,
    };
    expect(validateRuleset(ruleset).valid).toBe(true);

    ruleset.archetypes[0].attributes.pointer = {
      type: 'ref',
      value: 'nonexistent',
    };
    expect(validateRuleset(ruleset).issues).toContainEqual({
      path: 'archetypes[0].attributes.pointer',
      message: `Attribute 'pointer' references unknown ${collection} id 'nonexistent'`,
    });
  });
});
