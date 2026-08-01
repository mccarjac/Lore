/**
 * Storage-level tests for `migrateRulesetFields()` (issues #3-#7, #51).
 *
 * The pure normalization rules live in `rulesetFieldMigration.test.ts`; this
 * file covers what the storage wrapper adds — that it writes only when
 * something actually changed, is safe to re-run on every load, and
 * serializes against concurrent character writes via `runExclusive`.
 *
 * No test here calls `configureLore()`, so `migrateRulesetFields()` runs
 * against the default active ruleset — `exampleRuleset` — whose
 * `archetypes`/`traits`/`qualities`/`modifications` collections declare the
 * `legacyField`s these fixtures rely on.
 */
import {
  importDataset,
  migrateRulesetFields,
  updateCharacter,
} from '@/utils/characterStorage';
import { SafeAsyncStorageJSONParser } from '@/utils/safeAsyncStorageJSONParser';
import type { GameCharacter } from '@/models/types';

jest.mock('@/utils/safeAsyncStorageJSONParser');
jest.mock('uuid', () => ({ v4: jest.fn(() => 'mock-uuid-1234') }));

const CHARACTER_KEY = 'gameCharacterManager';
const QUEST_KEY = 'gameCharacterManager_quests';

const TS = '2025-01-01T00:00:00.000Z';
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const legacyCharacter = (id: string, species = 'drifter') => ({
  id,
  name: `Character ${id}`,
  species,
  perkIds: ['tough'],
  qualityIds: [],
  factions: [],
  relationships: [],
  retired: false,
  createdAt: TS,
  updatedAt: TS,
});

const currentCharacter = (id: string, archetypeId = 'drifter') => ({
  id,
  name: `Character ${id}`,
  facets: { archetypes: [archetypeId], traits: ['tough'], qualities: [] },
  factions: [],
  relationships: [],
  retired: false,
  createdAt: TS,
  updatedAt: TS,
});

/** Stateful in-memory store with an async gap, mirroring the concurrency suite. */
const installStatefulStore = (initial: Record<string, unknown>) => {
  const store: Record<string, unknown> = clone(initial);

  (SafeAsyncStorageJSONParser.getItem as jest.Mock).mockImplementation(
    async (key: string) => {
      await delay(1);
      return key in store ? clone(store[key]) : null;
    }
  );
  (SafeAsyncStorageJSONParser.setItem as jest.Mock).mockImplementation(
    async (key: string, value: unknown) => {
      await delay(1);
      store[key] = clone(value);
      return true;
    }
  );

  return store;
};

const datasetOf = (characters: unknown[]) => ({
  characters,
  version: '1.0',
  lastUpdated: TS,
});

const questDatasetOf = (quests: unknown[]) => ({
  quests,
  version: '1.0',
  lastUpdated: TS,
});

describe('migrateRulesetFields', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rewrites legacy characters in storage', async () => {
    const store = installStatefulStore({
      [CHARACTER_KEY]: datasetOf([legacyCharacter('a'), legacyCharacter('b')]),
    });

    await migrateRulesetFields();

    const saved = store[CHARACTER_KEY] as { characters: GameCharacter[] };
    expect(saved.characters.map(c => c.facets?.archetypes)).toEqual([
      ['drifter'],
      ['drifter'],
    ]);
    expect(saved.characters.some(c => 'species' in c)).toBe(false);
  });

  it('rewrites legacy quest preferences in storage', async () => {
    const store = installStatefulStore({
      [QUEST_KEY]: questDatasetOf([
        {
          id: 'q1',
          name: 'Quest',
          status: 'NOTSTARTED',
          desirable: { species: ['drifter'] },
          createdAt: TS,
          updatedAt: TS,
        },
      ]),
    });

    await migrateRulesetFields();

    const saved = store[QUEST_KEY] as {
      quests: { desirable?: { entries?: { archetypes?: string[] } } }[];
    };
    expect(saved.quests[0].desirable?.entries?.archetypes).toEqual(['drifter']);
  });

  it('does not write when data is already migrated', async () => {
    installStatefulStore({
      [CHARACTER_KEY]: datasetOf([currentCharacter('a')]),
      [QUEST_KEY]: questDatasetOf([
        {
          id: 'q1',
          name: 'Quest',
          status: 'NOTSTARTED',
          desirable: { entries: { archetypes: ['drifter'] } },
          createdAt: TS,
          updatedAt: TS,
        },
      ]),
    });

    await migrateRulesetFields();

    expect(
      SafeAsyncStorageJSONParser.setItem as jest.Mock
    ).not.toHaveBeenCalled();
  });

  it('does not write when there is no data at all', async () => {
    installStatefulStore({});

    await migrateRulesetFields();

    expect(
      SafeAsyncStorageJSONParser.setItem as jest.Mock
    ).not.toHaveBeenCalled();
  });

  it('is idempotent — a second run changes nothing and writes nothing', async () => {
    const store = installStatefulStore({
      [CHARACTER_KEY]: datasetOf([legacyCharacter('a')]),
    });

    await migrateRulesetFields();
    const afterFirst = clone(store[CHARACTER_KEY]);

    (SafeAsyncStorageJSONParser.setItem as jest.Mock).mockClear();
    await migrateRulesetFields();

    expect(
      SafeAsyncStorageJSONParser.setItem as jest.Mock
    ).not.toHaveBeenCalled();
    expect(store[CHARACTER_KEY]).toEqual(afterFirst);
  });

  it('leaves unrelated character fields untouched', async () => {
    const store = installStatefulStore({
      [CHARACTER_KEY]: datasetOf([
        { ...legacyCharacter('a'), notes: 'keep', occupation: 'Scavenger' },
      ]),
    });

    await migrateRulesetFields();

    const saved = store[CHARACTER_KEY] as { characters: GameCharacter[] };
    expect(saved.characters[0].notes).toBe('keep');
    expect(saved.characters[0].occupation).toBe('Scavenger');
  });

  it('serializes against a concurrent character write', async () => {
    const store = installStatefulStore({
      [CHARACTER_KEY]: datasetOf([legacyCharacter('a'), legacyCharacter('b')]),
    });

    // Without runExclusive both read the same snapshot and the later write
    // clobbers the earlier one — either the migration or the update is lost.
    await Promise.all([
      migrateRulesetFields(),
      updateCharacter('a', { retired: true }),
    ]);

    const saved = store[CHARACTER_KEY] as { characters: GameCharacter[] };
    const a = saved.characters.find(c => c.id === 'a');

    expect(
      saved.characters.every(c => c.facets?.archetypes?.[0] === 'drifter')
    ).toBe(true);
    expect(saved.characters.some(c => 'species' in c)).toBe(false);
    expect(a?.retired).toBe(true);
  });
});

describe('import back-compat (issues #3-#7, #51)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('importDataset accepts a pre-rename backup', async () => {
    const store = installStatefulStore({});

    const legacyBackup = JSON.stringify({
      characters: [legacyCharacter('a'), legacyCharacter('b', 'artisan')],
      factions: [],
      locations: [],
      events: [],
      quests: [
        {
          id: 'q1',
          name: 'Quest',
          status: 'NOTSTARTED',
          desirable: { species: ['drifter'] },
          createdAt: TS,
          updatedAt: TS,
        },
      ],
      version: '1.0',
      lastUpdated: TS,
    });

    await importDataset(legacyBackup);

    const characters = (store[CHARACTER_KEY] as { characters: GameCharacter[] })
      .characters;
    expect(characters.map(c => c.facets?.archetypes)).toEqual([
      ['drifter'],
      ['artisan'],
    ]);
    expect(characters.some(c => 'species' in c)).toBe(false);

    const quests = (
      store[QUEST_KEY] as {
        quests: { desirable?: { entries?: { archetypes?: string[] } } }[];
      }
    ).quests;
    expect(quests[0].desirable?.entries?.archetypes).toEqual(['drifter']);
  });

  it('importDataset leaves an already-migrated backup unchanged', async () => {
    const store = installStatefulStore({});

    await importDataset(
      JSON.stringify({
        characters: [currentCharacter('a')],
        factions: [],
        locations: [],
        events: [],
        quests: [],
        version: '1.0',
        lastUpdated: TS,
      })
    );

    const characters = (store[CHARACTER_KEY] as { characters: GameCharacter[] })
      .characters;
    expect(characters[0].facets?.archetypes).toEqual(['drifter']);
  });
});
