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

/** A loosely-typed record, which is all a legacy-shape object can be. */
type LooseRecord = Record<string, unknown>;

/** Fallback archetype for a character stored without one. */
export const UNKNOWN_ARCHETYPE_ID = 'Unknown';

/** old field name -> current field name, applied to a stored character. */
const CHARACTER_RENAMES: Record<string, string> = {
  species: 'archetypeId', // #3
  perkIds: 'traitIds', // #4
  distinctionIds: 'qualityIds', // #5
  cyberware: 'modifications', // #5
};

/** old field name -> current field name, applied to quest preferences. */
const PREFERENCE_RENAMES: Record<string, string> = {
  species: 'archetypeIds', // #3
  tags: 'traitCategoryIds', // #4
  perkIds: 'traitIds', // #4
  distinctionIds: 'qualityIds', // #5
};

/**
 * The one part of Phase 1 that reshapes values rather than renaming keys
 * (#5). A modification's flat `StatModifiers` becomes the ruleset's nested
 * `ResourceModifiers`, keyed by resource id instead of a hardcoded
 * health/limit/healthCap/limitCap quartet:
 *
 *   { health, limit }         -> values: { health, limit }
 *   { healthCap, limitCap }   -> caps:   { health, limit }
 *   { tagModifiers }          -> categoryModifiers
 */
const normalizeModification = (entry: LooseRecord): LooseRecord | null => {
  const legacy = entry.statModifiers as LooseRecord | undefined;
  if (legacy === undefined) return null;

  const { statModifiers, ...rest } = entry;
  void statModifiers;

  // An already-migrated entry keeps its resourceModifiers; a stale
  // statModifiers alongside it is simply dropped.
  if (rest.resourceModifiers !== undefined) return rest;

  const values: LooseRecord = {};
  const caps: LooseRecord = {};
  if (legacy.health !== undefined) values.health = legacy.health;
  if (legacy.limit !== undefined) values.limit = legacy.limit;
  if (legacy.healthCap !== undefined) caps.health = legacy.healthCap;
  if (legacy.limitCap !== undefined) caps.limit = legacy.limitCap;

  const resourceModifiers: LooseRecord = {};
  if (Object.keys(values).length > 0) resourceModifiers.values = values;
  if (Object.keys(caps).length > 0) resourceModifiers.caps = caps;
  if (legacy.tagModifiers !== undefined) {
    resourceModifiers.categoryModifiers = legacy.tagModifiers;
  }

  return { ...rest, resourceModifiers };
};

/** Returns null when no entry in the list needed reshaping. */
const normalizeModifications = (value: unknown): LooseRecord[] | null => {
  if (!Array.isArray(value)) return null;

  let changed = false;
  const normalized = (value as LooseRecord[]).map(entry => {
    const next = normalizeModification(entry);
    if (next) changed = true;
    return next ?? entry;
  });
  return changed ? normalized : null;
};

/**
 * Applies a rename table to a plain object.
 *
 * The current name always wins when both are present, so re-running can
 * never regress an already-migrated record, and the old key is always
 * dropped. Returns `null` when nothing needed changing, letting callers
 * preserve the original reference.
 */
const applyRenames = (
  source: LooseRecord,
  renames: Record<string, string>
): LooseRecord | null => {
  const applicable = Object.keys(renames).filter(
    oldKey => source[oldKey] !== undefined
  );
  if (applicable.length === 0) return null;

  const result: LooseRecord = { ...source };
  applicable.forEach(oldKey => {
    const newKey = renames[oldKey];
    if (result[newKey] === undefined) result[newKey] = source[oldKey];
    delete result[oldKey];
  });
  return result;
};

/**
 * Returns the normalized character, or the original reference when it was
 * already current. Callers rely on referential equality to detect "nothing
 * changed" without a deep compare.
 */
export const normalizeCharacterRulesetFields = (
  character: GameCharacter
): GameCharacter => {
  const source = character as unknown as LooseRecord;
  const renamed = applyRenames(source, CHARACTER_RENAMES);
  const base = renamed ?? source;

  // Reshape modification entries after the key rename, so this sees the
  // list under its current name whichever vintage the record came from.
  const remodified = normalizeModifications(base.modifications);

  // A record with neither the old nor the new archetype key still needs one,
  // since `archetypeId` is required.
  const needsArchetypeFallback = base.archetypeId === undefined;
  if (!renamed && !remodified && !needsArchetypeFallback) return character;

  const result = renamed ?? { ...source };
  if (remodified) result.modifications = remodified;
  if (result.archetypeId === undefined) {
    result.archetypeId = UNKNOWN_ARCHETYPE_ID;
  }
  return result as unknown as GameCharacter;
};

const normalizePreferences = (
  preferences: LooseRecord | undefined
): { value: LooseRecord | undefined; changed: boolean } => {
  if (!preferences) return { value: preferences, changed: false };

  const renamed = applyRenames(preferences, PREFERENCE_RENAMES);
  return renamed
    ? { value: renamed, changed: true }
    : { value: preferences, changed: false };
};

/**
 * Returns the normalized quest, or the original reference when it was
 * already current.
 */
export const normalizeQuestRulesetFields = (quest: GameQuest): GameQuest => {
  const desirable = normalizePreferences(
    quest.desirable as LooseRecord | undefined
  );
  const undesirable = normalizePreferences(
    quest.undesirable as LooseRecord | undefined
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
