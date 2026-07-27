/**
 * Unit tests for the pure shape normalizers behind the Phase 1 renames
 * (#3-#7). The storage-level `migrateRulesetFields()` is covered in
 * `characterStorage.test.ts`; this file pins the normalization rules
 * themselves, including the referential-equality contract that lets callers
 * skip a write when nothing changed.
 */
import {
  UNKNOWN_ARCHETYPE_ID,
  normalizeCharacterRulesetFields,
  normalizeCharactersRulesetFields,
  normalizeQuestRulesetFields,
  normalizeQuestsRulesetFields,
} from '@utils/rulesetFieldMigration';
import { afterworldsRuleset } from '@/ruleset/defaultRuleset';
import { QuestStatus, type GameCharacter, type GameQuest } from '@models/types';

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

const currentCharacter = (extra: Partial<GameCharacter> = {}): GameCharacter =>
  ({
    id: 'c1',
    name: 'Current',
    archetypeId: 'Mutant',
    traitIds: ['agility_1'],
    qualityIds: [],
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
  it('rewrites species to archetypeId and drops the old key', () => {
    const result = normalizeCharacterRulesetFields(legacyCharacter());

    expect(result.archetypeId).toBe('Mutant');
    expect('species' in result).toBe(false);
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
    expect(twice.archetypeId).toBe('Mutant');
  });

  it('keeps archetypeId when a stale species field is also present', () => {
    const result = normalizeCharacterRulesetFields(
      legacyCharacter({ archetypeId: 'Android', species: 'Mutant' })
    );

    expect(result.archetypeId).toBe('Android');
    expect('species' in result).toBe(false);
  });

  it('rewrites perkIds to traitIds (#4)', () => {
    const result = normalizeCharacterRulesetFields(legacyCharacter());

    expect(result.traitIds).toEqual(['agility_1']);
    expect('perkIds' in result).toBe(false);
  });

  it('falls back to Unknown when neither field is present', () => {
    const orphan = legacyCharacter();
    delete (orphan as unknown as Record<string, unknown>).species;

    expect(normalizeCharacterRulesetFields(orphan).archetypeId).toBe(
      UNKNOWN_ARCHETYPE_ID
    );
  });
});

describe('normalizeQuestRulesetFields', () => {
  it('rewrites desirable/undesirable species to archetypeIds', () => {
    const result = normalizeQuestRulesetFields(
      quest({
        desirable: { species: ['Human'] },
        undesirable: { species: ['Drone'] },
      } as unknown as Partial<GameQuest>)
    );

    expect(result.desirable?.archetypeIds).toEqual(['Human']);
    expect(result.undesirable?.archetypeIds).toEqual(['Drone']);
    expect('species' in (result.desirable ?? {})).toBe(false);
  });

  it('rewrites tags/perkIds to traitCategoryIds/traitIds (#4)', () => {
    const result = normalizeQuestRulesetFields(
      quest({
        desirable: { tags: ['Agility'], perkIds: ['agility_1'] },
      } as unknown as Partial<GameQuest>)
    );

    expect(result.desirable?.traitCategoryIds).toEqual(['Agility']);
    expect(result.desirable?.traitIds).toEqual(['agility_1']);
    expect('tags' in (result.desirable ?? {})).toBe(false);
    expect('perkIds' in (result.desirable ?? {})).toBe(false);
  });

  it('leaves other preference keys alone', () => {
    const result = normalizeQuestRulesetFields(
      quest({
        desirable: { species: ['Human'], qualityIds: ['d1'] },
      } as unknown as Partial<GameQuest>)
    );

    expect(result.desirable?.qualityIds).toEqual(['d1']);
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
    const input = quest({ desirable: { archetypeIds: ['Human'] } });
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
    expect(result[1].archetypeId).toBe('Mutant');
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
    expect(result[1].desirable?.archetypeIds).toEqual(['Human']);
  });
});

describe('modification modifier reshape (#5 then #22)', () => {
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
    expect(result.modifications?.[0].modifier).toEqual({
      attributeDeltas: { health: 5, limit: 5, healthCap: 3, limitCap: 2 },
    });
    expect('statModifiers' in (result.modifications?.[0] ?? {})).toBe(false);
  });

  it('flattens the post-#5 nested shape that shipped in #21', () => {
    // Anyone who ran the Phase 1 build has this vintage on disk, so it has to
    // migrate as reliably as the original flat one.
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

    expect(result.modifications?.[0].modifier).toEqual({
      attributeDeltas: { health: 5, limitCap: 2 },
      categoryDeltas: { Agility: 3 },
    });
    expect('resourceModifiers' in (result.modifications?.[0] ?? {})).toBe(
      false
    );
  });

  it('renames tagModifiers to categoryDeltas', () => {
    const result = normalizeCharacterRulesetFields(
      withModifications([
        {
          name: 'Targeting Suite',
          description: '',
          statModifiers: { tagModifiers: { Agility: 3 } },
        },
      ])
    );

    expect(result.modifications?.[0].modifier).toEqual({
      categoryDeltas: { Agility: 3 },
    });
  });

  it('maps a lone cap onto its cap attribute', () => {
    const result = normalizeCharacterRulesetFields(
      withModifications([
        { name: 'Plating', description: '', statModifiers: { healthCap: 1 } },
      ])
    );

    expect(result.modifications?.[0].modifier).toEqual({
      attributeDeltas: { healthCap: 1 },
    });
  });

  it('keeps a cap delta under the resource id when no cap attribute exists', () => {
    // Losing the delta silently would be worse than emitting one the
    // validator can flag.
    const rulesetWithoutCaps = {
      ...afterworldsRuleset,
      attributes: afterworldsRuleset.attributes.map(a =>
        a.id === 'health' ? { ...a, capAttributeId: undefined } : a
      ),
    };

    const result = normalizeCharacterRulesetFields(
      withModifications([
        { name: 'Plating', description: '', statModifiers: { healthCap: 1 } },
      ]),
      rulesetWithoutCaps
    );

    expect(result.modifications?.[0].modifier).toEqual({
      attributeDeltas: { health: 1 },
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
    expect(result.modifications?.[0].modifier).toEqual({
      attributeDeltas: { health: 2 },
    });
  });

  it('is idempotent and preserves the reference when already current', () => {
    const current = withModifications([
      {
        name: 'Frame',
        description: '',
        modifier: { attributeDeltas: { health: 2 } },
      },
    ]);

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

    expect(result.modifications?.[0].modifier).toEqual({
      attributeDeltas: { health: 9 },
    });
    expect('statModifiers' in (result.modifications?.[0] ?? {})).toBe(false);
    expect('resourceModifiers' in (result.modifications?.[0] ?? {})).toBe(
      false
    );
  });
});
