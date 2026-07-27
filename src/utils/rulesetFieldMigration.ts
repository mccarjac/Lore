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
import { activeRuleset } from '@/activeRuleset';
import { roleOf } from '@/ruleset/attributes';
import type { RulesetDefinition } from '@/ruleset/types';

/**
 * resourceId -> its cap attribute id, read off the ruleset. Defaults to the
 * Afterworlds ruleset, matching the convention in `derived.ts` and
 * `factionStats.ts`: pure utils take the ruleset as a parameter rather than
 * reaching for a provider.
 */
const capLookupFor =
  (ruleset: RulesetDefinition): CapLookup =>
  (resourceId: string) =>
    ruleset.attributes.find(
      d => d.id === resourceId && roleOf(d) === 'resource'
    )?.capAttributeId;

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

/** old field name -> current field name, applied to a stored quest. */
const QUEST_RENAMES: Record<string, string> = {
  junktownOffice: 'sponsor', // #7
};

/** old field name -> current field name, applied to quest preferences. */
const PREFERENCE_RENAMES: Record<string, string> = {
  species: 'archetypeIds', // #3
  tags: 'traitCategoryIds', // #4
  perkIds: 'traitIds', // #4
  distinctionIds: 'qualityIds', // #5
};

/**
 * Modification modifiers are the one part of these migrations that reshapes
 * *values* rather than renaming keys, and they have now been through two
 * shapes. Both must still be readable, because #21 shipped the middle one:
 *
 *   pre-#5   statModifiers:     { health, limit, healthCap, limitCap, tagModifiers }
 *   post-#5  resourceModifiers: { values: {...}, caps: {...}, categoryModifiers }
 *   post-#22 modifier:          { attributeDeltas: {...}, categoryDeltas }
 *
 * The #22 target is flat because a cap is simply another attribute. That
 * makes the cap mapping the non-obvious part: a cap entry keyed by a
 * *resource* id becomes a delta keyed by that resource's `capAttributeId`
 * (`caps.health` -> `attributeDeltas.healthCap`), which is ruleset knowledge,
 * hence the `capAttributeIdFor` lookup.
 */
type CapLookup = (resourceId: string) => string | undefined;

const buildModifier = (
  values: LooseRecord,
  caps: LooseRecord,
  categoryDeltas: unknown,
  capAttributeIdFor: CapLookup
): LooseRecord => {
  const attributeDeltas: LooseRecord = { ...values };

  Object.entries(caps).forEach(([resourceId, delta]) => {
    // Fall back to the resource's own id rather than dropping the delta: a
    // ruleset that declares no cap attribute would otherwise lose data
    // silently, which is worse than an entry the validator can flag.
    attributeDeltas[capAttributeIdFor(resourceId) ?? resourceId] = delta;
  });

  const modifier: LooseRecord = {};
  if (Object.keys(attributeDeltas).length > 0) {
    modifier.attributeDeltas = attributeDeltas;
  }
  if (categoryDeltas !== undefined) modifier.categoryDeltas = categoryDeltas;
  return modifier;
};

const normalizeModification = (
  entry: LooseRecord,
  capAttributeIdFor: CapLookup
): LooseRecord | null => {
  const flat = entry.statModifiers as LooseRecord | undefined;
  const nested = entry.resourceModifiers as LooseRecord | undefined;
  if (flat === undefined && nested === undefined) return null;

  const { statModifiers, resourceModifiers, ...rest } = entry;
  void statModifiers;
  void resourceModifiers;

  // An already-current entry keeps its modifier; stale predecessors alongside
  // it are simply dropped.
  if (rest.modifier !== undefined) return rest;

  if (nested !== undefined) {
    return {
      ...rest,
      modifier: buildModifier(
        (nested.values as LooseRecord) ?? {},
        (nested.caps as LooseRecord) ?? {},
        nested.categoryModifiers,
        capAttributeIdFor
      ),
    };
  }

  const legacy = flat as LooseRecord;
  const values: LooseRecord = {};
  const caps: LooseRecord = {};
  if (legacy.health !== undefined) values.health = legacy.health;
  if (legacy.limit !== undefined) values.limit = legacy.limit;
  if (legacy.healthCap !== undefined) caps.health = legacy.healthCap;
  if (legacy.limitCap !== undefined) caps.limit = legacy.limitCap;

  return {
    ...rest,
    modifier: buildModifier(
      values,
      caps,
      legacy.tagModifiers,
      capAttributeIdFor
    ),
  };
};

/** Returns null when no entry in the list needed reshaping. */
const normalizeModifications = (
  value: unknown,
  capAttributeIdFor: CapLookup
): LooseRecord[] | null => {
  if (!Array.isArray(value)) return null;

  let changed = false;
  const normalized = (value as LooseRecord[]).map(entry => {
    const next = normalizeModification(entry, capAttributeIdFor);
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
  character: GameCharacter,
  ruleset: RulesetDefinition = activeRuleset
): GameCharacter => {
  const source = character as unknown as LooseRecord;
  const renamed = applyRenames(source, CHARACTER_RENAMES);
  const base = renamed ?? source;

  // Reshape modification entries after the key rename, so this sees the
  // list under its current name whichever vintage the record came from.
  const remodified = normalizeModifications(
    base.modifications,
    capLookupFor(ruleset)
  );

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
  const renamed = applyRenames(quest as unknown as LooseRecord, QUEST_RENAMES);
  const base = (renamed ?? quest) as unknown as GameQuest;

  const desirable = normalizePreferences(
    base.desirable as LooseRecord | undefined
  );
  const undesirable = normalizePreferences(
    base.undesirable as LooseRecord | undefined
  );

  if (!renamed && !desirable.changed && !undesirable.changed) return quest;

  return {
    ...base,
    desirable: desirable.value,
    undesirable: undesirable.value,
  } as GameQuest;
};

/** Array form; returns the original array when every entry was current. */
export const normalizeCharactersRulesetFields = (
  characters: GameCharacter[],
  ruleset: RulesetDefinition = activeRuleset
): GameCharacter[] => {
  let changed = false;
  const normalized = characters.map(character => {
    const next = normalizeCharacterRulesetFields(character, ruleset);
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
  dataset: T,
  ruleset: RulesetDefinition = activeRuleset
): T => {
  const characters = dataset.characters
    ? normalizeCharactersRulesetFields(dataset.characters, ruleset)
    : dataset.characters;
  const quests = dataset.quests
    ? normalizeQuestsRulesetFields(dataset.quests)
    : dataset.quests;

  if (characters === dataset.characters && quests === dataset.quests) {
    return dataset;
  }
  return { ...dataset, characters, quests };
};
