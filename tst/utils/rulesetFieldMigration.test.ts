/**
 * Unit tests for the pure shape normalizers behind the ruleset field renames
 * (#3-#7) and the facet generalization (#51). The storage-level
 * `migrateRulesetFields()` is covered in `migrateRulesetFields.test.ts`; this
 * file pins the normalization rules themselves, including the
 * referential-equality contract that lets callers skip a write when nothing
 * changed.
 */
import {
  normalizeCharacterRulesetFields as normalizeCharacterWith,
  normalizeCharactersRulesetFields as normalizeCharactersWith,
  normalizeQuestRulesetFields as normalizeQuestWith,
  normalizeQuestsRulesetFields as normalizeQuestsWith,
} from '@utils/rulesetFieldMigration';
import { mechanicsRuleset } from '../fixtures/mechanicsRuleset';
import type { RulesetDefinition } from '@/ruleset/types';
import { QuestStatus, type GameCharacter, type GameQuest } from '@models/types';

/**
 * Every record in this file is legacy data of the vintage that actually
 * shipped — `species: 'Mutant'`, `statModifiers: { healthCap: 1 }` — because
 * that is what the normalizers exist to read. The *records* are historic; the
 * ruleset they are read against need not be, and pinning a flavor here would
 * make this suite one of the files that has to move when a flavor is
 * extracted. All the normalizers ask of a ruleset is `attributes` (for the
 * resource -> cap lookup) and `facets[].legacyField` (for which collection
 * each old field folds into), so a local fixture declaring both is the whole
 * requirement.
 *
 * That the cap reshape is a ruleset rule rather than a property of these
 * particular ids is proved separately, against `mechanicsRuleset`, at the
 * bottom of this file.
 */
const legacyShapedRuleset: RulesetDefinition = {
  ...mechanicsRuleset,
  id: 'legacy-shaped',
  attributes: [
    {
      id: 'health',
      label: 'Health',
      type: 'number',
      role: 'resource',
      capAttributeId: 'healthCap',
    },
    {
      id: 'limit',
      label: 'Limit',
      type: 'number',
      role: 'resource',
      capAttributeId: 'limitCap',
    },
    { id: 'healthCap', label: 'Health Cap', type: 'number', role: 'cap' },
    { id: 'limitCap', label: 'Limit Cap', type: 'number', role: 'cap' },
  ],
  facets: [
    {
      id: 'archetypes',
      singular: 'Archetype',
      plural: 'Archetypes',
      selection: 'single',
      legacyField: 'archetypeId',
      entries: [],
    },
    {
      id: 'traits',
      singular: 'Trait',
      plural: 'Traits',
      selection: 'multi',
      legacyField: 'traitIds',
      entries: [],
    },
    {
      id: 'qualities',
      singular: 'Quality',
      plural: 'Qualities',
      selection: 'multi',
      legacyField: 'qualityIds',
      entries: [],
    },
    {
      id: 'modifications',
      singular: 'Modification',
      plural: 'Modifications',
      selection: 'multi',
      authored: true,
      legacyField: 'modifications',
      entries: [],
    },
  ],
};

const normalizeCharacterRulesetFields = (
  character: GameCharacter,
  ruleset: RulesetDefinition = legacyShapedRuleset
): GameCharacter => normalizeCharacterWith(character, ruleset);

const normalizeCharactersRulesetFields = (
  characters: GameCharacter[],
  ruleset: RulesetDefinition = legacyShapedRuleset
): GameCharacter[] => normalizeCharactersWith(characters, ruleset);

const normalizeQuestRulesetFields = (
  quest: GameQuest,
  ruleset: RulesetDefinition = legacyShapedRuleset
): GameQuest => normalizeQuestWith(quest, ruleset);

const normalizeQuestsRulesetFields = (
  quests: GameQuest[],
  ruleset: RulesetDefinition = legacyShapedRuleset
): GameQuest[] => normalizeQuestsWith(quests, ruleset);

const TS = '2026-01-01T00:00:00.000Z';

const legacyCharacter = (extra: Record<string, unknown> = {}): GameCharacter =>
  ({
    id: 'c1',
    name: 'Legacy',
    species: 'Mutant',
    perkIds: ['agility_1'],
    qualityIds: [],
    factions: [],
    relationships: [],
    createdAt: TS,
    updatedAt: TS,
    ...extra,
  }) as unknown as GameCharacter;

/** Already fully current: post-#51 `facets`, no legacy top-level fields. */
const currentCharacter = (extra: Partial<GameCharacter> = {}): GameCharacter =>
  ({
    id: 'c1',
    name: 'Current',
    facets: { archetypes: ['Mutant'], traits: ['agility_1'], qualities: [] },
    factions: [],
    relationships: [],
    createdAt: TS,
    updatedAt: TS,
    ...extra,
  }) as GameCharacter;

const quest = (extra: Partial<GameQuest> = {}): GameQuest => ({
  id: 'q1',
  name: 'Quest',
  status: QuestStatus.NotStarted,
  createdAt: TS,
  updatedAt: TS,
  ...extra,
});

describe('normalizeCharacterRulesetFields', () => {
  it('folds species into facets.archetypes and drops every legacy key', () => {
    const result = normalizeCharacterRulesetFields(legacyCharacter());

    expect(result.facets?.archetypes).toEqual(['Mutant']);
    expect('species' in result).toBe(false);
    expect('archetypeId' in result).toBe(false);
  });

  it('preserves every unrelated field', () => {
    const result = normalizeCharacterRulesetFields(
      legacyCharacter({ notes: 'keep me', occupation: 'Scavenger' })
    );

    expect(result.notes).toBe('keep me');
    expect(result.occupation).toBe('Scavenger');
    expect(result.id).toBe('c1');
  });

  it('returns the same reference when already migrated', () => {
    const input = currentCharacter();
    expect(normalizeCharacterRulesetFields(input)).toBe(input);
  });

  it('is idempotent', () => {
    const once = normalizeCharacterRulesetFields(legacyCharacter());
    const twice = normalizeCharacterRulesetFields(once);

    expect(twice).toBe(once);
    expect(twice.facets?.archetypes).toEqual(['Mutant']);
  });

  it('keeps the post-rename archetypeId when a stale species field is also present', () => {
    const result = normalizeCharacterRulesetFields(
      legacyCharacter({ archetypeId: 'Android', species: 'Mutant' })
    );

    expect(result.facets?.archetypes).toEqual(['Android']);
    expect('species' in result).toBe(false);
    expect('archetypeId' in result).toBe(false);
  });

  it('lets an already-populated facets collection win over a legacy field', () => {
    // Mirrors applyRenames' "the current name always wins" — here the
    // *current shape* (facets) wins over a legacy field folding into the
    // same collection.
    const result = normalizeCharacterRulesetFields(
      legacyCharacter({ facets: { archetypes: ['Android'] } })
    );

    expect(result.facets?.archetypes).toEqual(['Android']);
  });

  it('folds perkIds into facets.traits (#4)', () => {
    const result = normalizeCharacterRulesetFields(legacyCharacter());

    expect(result.facets?.traits).toEqual(['agility_1']);
    expect('perkIds' in result).toBe(false);
    expect('traitIds' in result).toBe(false);
  });

  it('leaves the single-selection collection unset when neither field is present', () => {
    // No `UNKNOWN_ARCHETYPE_ID` fallback since #51 — a `single`-selection
    // collection may legitimately have no held entry.
    const orphan = legacyCharacter();
    delete (orphan as unknown as Record<string, unknown>).species;

    const result = normalizeCharacterRulesetFields(orphan);
    expect(result.facets?.archetypes).toBeUndefined();
  });
});

describe('normalizeQuestRulesetFields', () => {
  it('folds desirable/undesirable species into entries.archetypes', () => {
    const result = normalizeQuestRulesetFields(
      quest({
        desirable: { species: ['Human'] },
        undesirable: { species: ['Drone'] },
      } as unknown as Partial<GameQuest>)
    );

    expect(result.desirable?.entries?.archetypes).toEqual(['Human']);
    expect(result.undesirable?.entries?.archetypes).toEqual(['Drone']);
    expect('species' in (result.desirable ?? {})).toBe(false);
    expect('archetypeIds' in (result.desirable ?? {})).toBe(false);
  });

  it('folds tags/perkIds into categories.traits/entries.traits (#4)', () => {
    const result = normalizeQuestRulesetFields(
      quest({
        desirable: { tags: ['Agility'], perkIds: ['agility_1'] },
      } as unknown as Partial<GameQuest>)
    );

    expect(result.desirable?.categories?.traits).toEqual(['Agility']);
    expect(result.desirable?.entries?.traits).toEqual(['agility_1']);
    expect('tags' in (result.desirable ?? {})).toBe(false);
    expect('perkIds' in (result.desirable ?? {})).toBe(false);
    expect('traitCategoryIds' in (result.desirable ?? {})).toBe(false);
  });

  it('folds distinctionIds into entries.qualities (#5)', () => {
    const result = normalizeQuestRulesetFields(
      quest({
        desirable: { species: ['Human'], distinctionIds: ['d1'] },
      } as unknown as Partial<GameQuest>)
    );

    expect(result.desirable?.entries?.qualities).toEqual(['d1']);
  });

  it('rewrites junktownOffice to sponsor (#7)', () => {
    const result = normalizeQuestRulesetFields(
      quest({ junktownOffice: 'Scrap Office' } as unknown as Partial<GameQuest>)
    );

    expect(result.sponsor).toBe('Scrap Office');
    expect('junktownOffice' in result).toBe(false);
  });

  it('keeps sponsor when a stale junktownOffice is also present', () => {
    const result = normalizeQuestRulesetFields(
      quest({
        sponsor: 'New',
        junktownOffice: 'Old',
      } as unknown as Partial<GameQuest>)
    );

    expect(result.sponsor).toBe('New');
    expect('junktownOffice' in result).toBe(false);
  });

  it('returns the same reference when already migrated', () => {
    const input = quest({ desirable: { entries: { archetypes: ['Human'] } } });
    expect(normalizeQuestRulesetFields(input)).toBe(input);
  });

  it('returns the same reference when there are no preferences at all', () => {
    const input = quest();
    expect(normalizeQuestRulesetFields(input)).toBe(input);
  });

  it('is idempotent', () => {
    const once = normalizeQuestRulesetFields(
      quest({
        desirable: { species: ['Human'] },
      } as unknown as Partial<GameQuest>)
    );
    expect(normalizeQuestRulesetFields(once)).toBe(once);
  });
});

describe('array normalizers', () => {
  it('returns the original array when every entry is current', () => {
    const input = [currentCharacter(), currentCharacter({ id: 'c2' })];
    expect(normalizeCharactersRulesetFields(input)).toBe(input);
  });

  it('returns a new array when any entry needed migrating', () => {
    const input = [currentCharacter(), legacyCharacter({ id: 'c2' })];
    const result = normalizeCharactersRulesetFields(input);

    expect(result).not.toBe(input);
    expect(result[0]).toBe(input[0]);
    expect(result[1].facets?.archetypes).toEqual(['Mutant']);
  });

  it('returns the original quest array when every entry is current', () => {
    const input = [quest(), quest({ id: 'q2' })];
    expect(normalizeQuestsRulesetFields(input)).toBe(input);
  });

  it('returns a new quest array when any entry needed migrating', () => {
    const input = [
      quest(),
      quest({
        id: 'q2',
        desirable: { species: ['Human'] },
      } as unknown as Partial<GameQuest>),
    ];
    const result = normalizeQuestsRulesetFields(input);

    expect(result).not.toBe(input);
    expect(result[1].desirable?.entries?.archetypes).toEqual(['Human']);
  });
});

describe('modification modifier reshape (#5, #22, #51)', () => {
  const withModifications = (modifications: unknown[]): GameCharacter =>
    ({
      id: 'c1',
      name: 'Legacy',
      archetypeId: 'Mutant',
      traitIds: [],
      qualityIds: [],
      factions: [],
      relationships: [],
      modifications,
      createdAt: TS,
      updatedAt: TS,
    }) as unknown as GameCharacter;

  it('flattens pre-#5 stat modifiers into attribute deltas', () => {
    const result = normalizeCharacterRulesetFields(
      withModifications([
        {
          name: 'Reinforced Frame',
          description: '',
          statModifiers: { health: 5, limit: 5, healthCap: 3, limitCap: 2 },
        },
      ])
    );

    // The non-obvious part: a cap keyed by a *resource* id lands under that
    // resource's capAttributeId, not under the resource itself.
    expect(result.facets?.modifications?.[0]).toMatchObject({
      modifier: {
        attributeDeltas: { health: 5, limit: 5, healthCap: 3, limitCap: 2 },
      },
    });
    expect(
      'statModifiers' in
        ((result.facets?.modifications?.[0] as unknown as Record<
          string,
          unknown
        >) ?? {})
    ).toBe(false);
  });

  it('flattens the post-#5 nested shape that shipped in #21', () => {
    // Anyone who ran the Phase 1 build has this vintage on disk, so it has to
    // migrate as reliably as the original flat one. Category deltas end up
    // nested under the collection whose `legacyField` is `'traitIds'`.
    const result = normalizeCharacterRulesetFields(
      withModifications([
        {
          name: 'Reinforced Frame',
          description: '',
          resourceModifiers: {
            values: { health: 5 },
            caps: { limit: 2 },
            categoryModifiers: { Agility: 3 },
          },
        },
      ])
    );

    expect(result.facets?.modifications?.[0]).toMatchObject({
      modifier: {
        attributeDeltas: { health: 5, limitCap: 2 },
        categoryDeltas: { traits: { Agility: 3 } },
      },
    });
    expect(
      'resourceModifiers' in
        ((result.facets?.modifications?.[0] as unknown as Record<
          string,
          unknown
        >) ?? {})
    ).toBe(false);
  });

  it('renames tagModifiers to categoryDeltas, nested under the traits collection', () => {
    const result = normalizeCharacterRulesetFields(
      withModifications([
        {
          name: 'Targeting Suite',
          description: '',
          statModifiers: { tagModifiers: { Agility: 3 } },
        },
      ])
    );

    expect(result.facets?.modifications?.[0]).toMatchObject({
      modifier: { categoryDeltas: { traits: { Agility: 3 } } },
    });
  });

  it('maps a lone cap onto its cap attribute', () => {
    const result = normalizeCharacterRulesetFields(
      withModifications([
        { name: 'Plating', description: '', statModifiers: { healthCap: 1 } },
      ])
    );

    expect(result.facets?.modifications?.[0]).toMatchObject({
      modifier: { attributeDeltas: { healthCap: 1 } },
    });
  });

  it('keeps a cap delta under the resource id when no cap attribute exists', () => {
    // Losing the delta silently would be worse than emitting one the
    // validator can flag.
    const rulesetWithoutCaps = {
      ...legacyShapedRuleset,
      attributes: legacyShapedRuleset.attributes.map(a =>
        a.id === 'health' ? { ...a, capAttributeId: undefined } : a
      ),
    };

    const result = normalizeCharacterRulesetFields(
      withModifications([
        { name: 'Plating', description: '', statModifiers: { healthCap: 1 } },
      ]),
      rulesetWithoutCaps
    );

    expect(result.facets?.modifications?.[0]).toMatchObject({
      modifier: { attributeDeltas: { health: 1 } },
    });
  });

  it('handles a nested shape with neither values nor caps', () => {
    const result = normalizeCharacterRulesetFields(
      withModifications([
        {
          name: 'Targeting Suite',
          description: '',
          resourceModifiers: { categoryModifiers: { Agility: 1 } },
        },
      ])
    );

    expect(result.facets?.modifications?.[0]).toMatchObject({
      modifier: { categoryDeltas: { traits: { Agility: 1 } } },
    });
  });

  it('migrates cyberware entries reached through the #5 key rename', () => {
    const legacy = {
      id: 'c1',
      name: 'Legacy',
      species: 'Mutant',
      perkIds: [],
      distinctionIds: [],
      factions: [],
      relationships: [],
      cyberware: [
        { name: 'Frame', description: '', statModifiers: { health: 2 } },
      ],
      createdAt: TS,
      updatedAt: TS,
    } as unknown as GameCharacter;

    const result = normalizeCharacterRulesetFields(legacy);

    expect('cyberware' in result).toBe(false);
    expect('modifications' in result).toBe(false);
    expect(result.facets?.modifications?.[0]).toMatchObject({
      modifier: { attributeDeltas: { health: 2 } },
    });
  });

  it('is idempotent and preserves the reference when already current', () => {
    const current = currentCharacter({
      facets: {
        archetypes: ['Mutant'],
        traits: [],
        qualities: [],
        modifications: [
          {
            name: 'Frame',
            description: '',
            modifier: { attributeDeltas: { health: 2 } },
          },
        ],
      },
    });

    expect(normalizeCharacterRulesetFields(current)).toBe(current);
  });

  it('drops stale predecessors when modifier already exists', () => {
    const result = normalizeCharacterRulesetFields(
      withModifications([
        {
          name: 'Frame',
          description: '',
          modifier: { attributeDeltas: { health: 9 } },
          resourceModifiers: { values: { health: 5 } },
          statModifiers: { health: 2 },
        },
      ])
    );

    expect(result.facets?.modifications?.[0]).toMatchObject({
      modifier: { attributeDeltas: { health: 9 } },
    });
    expect(
      'statModifiers' in
        ((result.facets?.modifications?.[0] as unknown as Record<
          string,
          unknown
        >) ?? {})
    ).toBe(false);
    expect(
      'resourceModifiers' in
        ((result.facets?.modifications?.[0] as unknown as Record<
          string,
          unknown
        >) ?? {})
    ).toBe(false);
  });
});

describe('the cap reshape follows the ruleset, not the legacy ids', () => {
  it("maps a legacy cap key onto the resource's own cap attribute", () => {
    // `mechanicsRuleset` declares grit -> gritCap, with no `health` anywhere,
    // and its authored collection (legacyField 'modifications') is `rigs`.
    const legacy = {
      id: 'c1',
      name: 'Legacy',
      archetypeId: 'tinker',
      traitIds: [],
      qualityIds: [],
      factions: [],
      relationships: [],
      modifications: [
        {
          name: 'Brace',
          description: '',
          resourceModifiers: { caps: { grit: 2 } },
        },
      ],
      createdAt: TS,
      updatedAt: TS,
    } as unknown as GameCharacter;

    const result = normalizeCharacterWith(legacy, mechanicsRuleset);

    expect(result.facets?.rigs?.[0]).toMatchObject({
      modifier: { attributeDeltas: { gritCap: 2 } },
    });
  });
});
