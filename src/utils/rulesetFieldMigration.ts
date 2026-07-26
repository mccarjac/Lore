/**
 * Shape normalization for the Phase 1 ruleset field renames (issues #3-#7).
 *
 * Stored data, JSON backups, and GitHub-synced `data.json` files written
 * before the renames use the old field names. These helpers accept either
 * shape and return the current one, so a read path never has to care which
 * vintage it is looking at.
 *
 * Pure and I/O-free by design: `characterStorage.migrateRulesetFields()`
 * rewrites local storage with them, while `exportImport` and
 * `gitIntegration` apply them to data that arrives from outside. Keeping one
 * implementation means an import and a migration can never disagree.
 *
 * Every helper is idempotent — passing already-migrated data returns it
 * unchanged (and returns the *same object reference* when nothing needed
 * rewriting, which is what lets callers skip a pointless write).
 */
import type { GameCharacter, GameQuest } from '@models/types';

/** The pre-#3 character shape, as it may still exist on disk. */
type LegacyCharacter = Omit<GameCharacter, 'archetypeId'> &
  Partial<Pick<GameCharacter, 'archetypeId'>> & {
    species?: string;
  };

/** The pre-#3 quest preference shape. */
type LegacyPreferences = {
  species?: string[];
  archetypeIds?: string[];
  [key: string]: unknown;
};

/** Fallback archetype for a character stored without one. */
export const UNKNOWN_ARCHETYPE_ID = 'Unknown';

/**
 * Returns the normalized character, or the original reference when it was
 * already current. Callers rely on referential equality to detect "nothing
 * changed" without a deep compare.
 */
export const normalizeCharacterRulesetFields = (
  character: GameCharacter
): GameCharacter => {
  const legacy = character as LegacyCharacter;

  // An already-migrated record keeps its archetypeId even if a stale
  // `species` is still hanging around, so re-running can never regress it.
  const needsArchetype = legacy.archetypeId === undefined;
  if (!needsArchetype && legacy.species === undefined) return character;

  const { species, ...rest } = legacy;
  return {
    ...rest,
    archetypeId: legacy.archetypeId ?? species ?? UNKNOWN_ARCHETYPE_ID,
  } as GameCharacter;
};

const normalizePreferences = (
  preferences: LegacyPreferences | undefined
): { value: LegacyPreferences | undefined; changed: boolean } => {
  if (!preferences) return { value: preferences, changed: false };

  const hasLegacy = preferences.species !== undefined;
  if (!hasLegacy) return { value: preferences, changed: false };

  const { species, ...rest } = preferences;
  return {
    value: {
      ...rest,
      archetypeIds: preferences.archetypeIds ?? species,
    },
    changed: true,
  };
};

/**
 * Returns the normalized quest, or the original reference when it was
 * already current.
 */
export const normalizeQuestRulesetFields = (quest: GameQuest): GameQuest => {
  const desirable = normalizePreferences(
    quest.desirable as LegacyPreferences | undefined
  );
  const undesirable = normalizePreferences(
    quest.undesirable as LegacyPreferences | undefined
  );

  if (!desirable.changed && !undesirable.changed) return quest;

  return {
    ...quest,
    desirable: desirable.value,
    undesirable: undesirable.value,
  } as GameQuest;
};

/** Array form; returns the original array when every entry was current. */
export const normalizeCharactersRulesetFields = (
  characters: GameCharacter[]
): GameCharacter[] => {
  let changed = false;
  const normalized = characters.map(character => {
    const next = normalizeCharacterRulesetFields(character);
    if (next !== character) changed = true;
    return next;
  });
  return changed ? normalized : characters;
};

/** Array form; returns the original array when every entry was current. */
export const normalizeQuestsRulesetFields = (
  quests: GameQuest[]
): GameQuest[] => {
  let changed = false;
  const normalized = quests.map(quest => {
    const next = normalizeQuestRulesetFields(quest);
    if (next !== quest) changed = true;
    return next;
  });
  return changed ? normalized : quests;
};

/** The character/quest-bearing subset of a dataset, whatever else it carries. */
type RulesetFieldBearingDataset = {
  characters?: GameCharacter[];
  quests?: GameQuest[];
};

/**
 * Normalizes the character and quest collections of a whole dataset.
 *
 * This has to run on *every* side of a GitHub sync comparison, not just on
 * the data being written. `computeSyncPlan(base, local, remote)` diffs three
 * datasets field by field, so a remote or base snapshot still using the old
 * names against a freshly-migrated local one would report every character as
 * modified — a spurious conflict on each record the first time a user syncs
 * after upgrading.
 */
export const normalizeDatasetRulesetFields = <
  T extends RulesetFieldBearingDataset,
>(
  dataset: T
): T => {
  const characters = dataset.characters
    ? normalizeCharactersRulesetFields(dataset.characters)
    : dataset.characters;
  const quests = dataset.quests
    ? normalizeQuestsRulesetFields(dataset.quests)
    : dataset.quests;

  if (characters === dataset.characters && quests === dataset.quests) {
    return dataset;
  }
  return { ...dataset, characters, quests };
};
