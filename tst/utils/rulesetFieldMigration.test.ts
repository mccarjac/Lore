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
import { QuestStatus, type GameCharacter, type GameQuest } from '@models/types';

const TS = '2026-01-01T00:00:00.000Z';

const legacyCharacter = (extra: Record<string, unknown> = {}): GameCharacter =>
  ({
    id: 'c1',
    name: 'Legacy',
    species: 'Mutant',
    perkIds: ['agility_1'],
    distinctionIds: [],
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
    distinctionIds: [],
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
        desirable: { species: ['Human'], distinctionIds: ['d1'] },
      } as unknown as Partial<GameQuest>)
    );

    expect(result.desirable?.distinctionIds).toEqual(['d1']);
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
