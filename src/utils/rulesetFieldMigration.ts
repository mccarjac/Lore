/**
 * Shape normalization for the ruleset field renames (issues #3-#7) and the
 * facet generalization (#51).
 *
 * Stored data, JSON backups, and GitHub-synced `data.json` files written
 * before these changes use older field shapes. These helpers accept any
 * vintage and return the current one, so a read path never has to care which
 * it is looking at:
 *
 *   pre-#3/#7  species/perkIds/distinctionIds/cyberware, junktownOffice, ...
 *   post-#7    archetypeId/traitIds/qualityIds/modifications, sponsor
 *   post-#51   facets: { [collectionId]: FacetValue[] }
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
import { getActiveRuleset } from '@/activeRuleset';
import { roleOf } from '@/ruleset/attributes';
import type { FacetCollection } from '@/ruleset/facets';
import type { RulesetDefinition } from '@/ruleset/types';

/**
 * resourceId -> its cap attribute id, read off the ruleset. The ruleset is a
 * parameter, defaulting to the active one, matching the convention in
 * `derived.ts` and `factionStats.ts`: pure utils take the ruleset rather than
 * reaching for a provider they cannot see.
 */
const capLookupFor =
  (ruleset: RulesetDefinition): CapLookup =>
  (resourceId: string) =>
    ruleset.attributes.find(
      d => d.id === resourceId && roleOf(d) === 'resource'
    )?.capAttributeId;

/** The facet collection this ruleset declared for a given legacy field, if any. */
const collectionIdFor = (
  ruleset: RulesetDefinition,
  legacyField: NonNullable<FacetCollection['legacyField']>
): string | undefined =>
  ruleset.facets.find(c => c.legacyField === legacyField)?.id;

/** A loosely-typed record, which is all a legacy-shape object can be. */
type LooseRecord = Record<string, unknown>;

/** old field name -> current (pre-#51) field name, applied to a stored character. */
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

/** old field name -> pre-#51 field name, applied to quest preferences. */
const PREFERENCE_RENAMES: Record<string, string> = {
  species: 'archetypeIds', // #3
  tags: 'traitCategoryIds', // #4
  perkIds: 'traitIds', // #4
  distinctionIds: 'qualityIds', // #5
};

/**
 * Modification modifiers went through two shapes before landing on the flat
 * `Modifier` used since #22, and both must still be readable, because #21
 * shipped the middle one:
 *
 *   pre-#5   statModifiers:     { health, limit, healthCap, limitCap, tagModifiers }
 *   post-#5  resourceModifiers: { values: {...}, caps: {...}, categoryModifiers }
 *   post-#22 modifier:          { attributeDeltas: {...}, categoryDeltas }
 *
 * The #22 target is flat because a cap is simply another attribute. That
 * makes the cap mapping the non-obvious part: a cap entry keyed by a
 * *resource* id becomes a delta keyed by that resource's `capAttributeId`
 * (`caps.health` -> `attributeDeltas.healthCap`), which is ruleset knowledge,
 * hence the `capAttributeIdFor` lookup. `categoryDeltas` at this stage is
 * still flat (categoryId -> delta); nesting it under a collection id is a
 * separate, later step — see `nestModifierCategoryDeltas` — since which
 * collection "owns" those category ids is facet-schema knowledge, not
 * something this reshape needs to know.
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
 * A flat `categoryId -> delta` map is the pre-#51 shape; the current
 * `Modifier.categoryDeltas` is nested one level deeper, `collectionId ->
 * categoryId -> delta`, since category ids are now scoped per facet
 * collection. Detected by whether the values are numbers or objects.
 */
const isNestedCategoryDeltas = (value: LooseRecord): boolean =>
  Object.values(value).every(v => typeof v === 'object' && v !== null);

const nestModifierCategoryDeltas = (
  modifier: LooseRecord | undefined,
  traitCollectionId: string | undefined
): { value: LooseRecord | undefined; changed: boolean } => {
  if (!modifier || modifier.categoryDeltas === undefined) {
    return { value: modifier, changed: false };
  }
  const categoryDeltas = modifier.categoryDeltas as LooseRecord;
  if (
    Object.keys(categoryDeltas).length === 0 ||
    isNestedCategoryDeltas(categoryDeltas)
  ) {
    return { value: modifier, changed: false };
  }
  // Falls back to a synthetic 'legacy' bucket if this ruleset declares no
  // trait-like collection to nest under, rather than dropping the data.
  const key = traitCollectionId ?? 'legacy';
  return {
    value: { ...modifier, categoryDeltas: { [key]: categoryDeltas } },
    changed: true,
  };
};

const nestModificationsCategoryDeltas = (
  modifications: unknown,
  traitCollectionId: string | undefined
): LooseRecord[] | undefined => {
  if (!Array.isArray(modifications)) {
    return modifications as LooseRecord[] | undefined;
  }
  return (modifications as LooseRecord[]).map(entry => {
    const nested = nestModifierCategoryDeltas(
      entry.modifier as LooseRecord | undefined,
      traitCollectionId
    );
    return nested.changed ? { ...entry, modifier: nested.value } : entry;
  });
};

/**
 * Folds the four pre-#51 character fields (`archetypeId`/`traitIds`/
 * `qualityIds`/`modifications`) into `facets`, driven by which collection
 * each ruleset declared `legacyField` for — not by naming convention, so a
 * ruleset that renamed its collection id still migrates correctly. A
 * collection that already has an entry under `facets` wins over the legacy
 * field, mirroring `applyRenames`' "current name always wins".
 *
 * Only reshapes; never invents data. A character with no `archetypeId` at
 * all simply gets no entry for that collection — a `selection: 'single'`
 * collection may legitimately be unset since #51, unlike the old required
 * `archetypeId: string`.
 */
const foldCharacterFacets = (
  base: LooseRecord,
  ruleset: RulesetDefinition
): { value: LooseRecord; changed: boolean } => {
  const hasLegacyField =
    base.archetypeId !== undefined ||
    base.traitIds !== undefined ||
    base.qualityIds !== undefined ||
    base.modifications !== undefined;
  if (!hasLegacyField) return { value: base, changed: false };

  const archetypeCollectionId = collectionIdFor(ruleset, 'archetypeId');
  const traitCollectionId = collectionIdFor(ruleset, 'traitIds');
  const qualityCollectionId = collectionIdFor(ruleset, 'qualityIds');
  const modificationCollectionId = collectionIdFor(ruleset, 'modifications');

  const facets: LooseRecord = {
    ...((base.facets as LooseRecord | undefined) ?? {}),
  };

  const foldInto = (collectionId: string | undefined, values: unknown) => {
    if (!collectionId || values === undefined) return;
    if (facets[collectionId] !== undefined) return;
    facets[collectionId] = values;
  };

  if (typeof base.archetypeId === 'string') {
    foldInto(
      archetypeCollectionId,
      base.archetypeId.length > 0 ? [base.archetypeId] : []
    );
  }
  if (Array.isArray(base.traitIds)) {
    foldInto(traitCollectionId, base.traitIds);
  }
  if (Array.isArray(base.qualityIds)) {
    foldInto(qualityCollectionId, base.qualityIds);
  }
  if (base.modifications !== undefined) {
    foldInto(
      modificationCollectionId,
      nestModificationsCategoryDeltas(base.modifications, traitCollectionId)
    );
  }

  const { archetypeId, traitIds, qualityIds, modifications, ...rest } = base;
  void archetypeId;
  void traitIds;
  void qualityIds;
  void modifications;

  return { value: { ...rest, facets }, changed: true };
};

/**
 * Returns the normalized character, or the original reference when it was
 * already current. Callers rely on referential equality to detect "nothing
 * changed" without a deep compare.
 */
export const normalizeCharacterRulesetFields = (
  character: GameCharacter,
  ruleset: RulesetDefinition = getActiveRuleset()
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
  const withReshapedModifications = remodified
    ? { ...base, modifications: remodified }
    : base;

  const folded = foldCharacterFacets(withReshapedModifications, ruleset);

  if (!renamed && !remodified && !folded.changed) return character;

  return folded.value as unknown as GameCharacter;
};

/**
 * Folds the pre-#51 `QuestAttributePreferences` shape (`archetypeIds`/
 * `traitIds`/`qualityIds`/`traitCategoryIds`) into `QuestFacetPreferences`
 * (`entries`/`categories`, each keyed by collection id), driven by the same
 * `legacyField` lookup as the character side.
 */
const foldPreferences = (
  preferences: LooseRecord,
  ruleset: RulesetDefinition
): { value: LooseRecord; changed: boolean } => {
  const hasLegacyField =
    preferences.archetypeIds !== undefined ||
    preferences.traitIds !== undefined ||
    preferences.qualityIds !== undefined ||
    preferences.traitCategoryIds !== undefined;
  if (!hasLegacyField) return { value: preferences, changed: false };

  const archetypeCollectionId = collectionIdFor(ruleset, 'archetypeId');
  const traitCollectionId = collectionIdFor(ruleset, 'traitIds');
  const qualityCollectionId = collectionIdFor(ruleset, 'qualityIds');

  const entries: LooseRecord = {
    ...((preferences.entries as LooseRecord | undefined) ?? {}),
  };
  const categories: LooseRecord = {
    ...((preferences.categories as LooseRecord | undefined) ?? {}),
  };

  const foldEntries = (collectionId: string | undefined, values: unknown) => {
    if (!collectionId || values === undefined || entries[collectionId]) return;
    entries[collectionId] = values;
  };
  const foldCategories = (
    collectionId: string | undefined,
    values: unknown
  ) => {
    if (!collectionId || values === undefined || categories[collectionId])
      return;
    categories[collectionId] = values;
  };

  if (Array.isArray(preferences.archetypeIds)) {
    foldEntries(archetypeCollectionId, preferences.archetypeIds);
  }
  if (Array.isArray(preferences.traitIds)) {
    foldEntries(traitCollectionId, preferences.traitIds);
  }
  if (Array.isArray(preferences.qualityIds)) {
    foldEntries(qualityCollectionId, preferences.qualityIds);
  }
  if (Array.isArray(preferences.traitCategoryIds)) {
    foldCategories(traitCollectionId, preferences.traitCategoryIds);
  }

  const { archetypeIds, traitIds, qualityIds, traitCategoryIds, ...rest } =
    preferences;
  void archetypeIds;
  void traitIds;
  void qualityIds;
  void traitCategoryIds;

  const result: LooseRecord = { ...rest };
  if (Object.keys(entries).length > 0) result.entries = entries;
  if (Object.keys(categories).length > 0) result.categories = categories;

  return { value: result, changed: true };
};

const normalizeAndFoldPreferences = (
  preferences: LooseRecord | undefined,
  ruleset: RulesetDefinition
): { value: LooseRecord | undefined; changed: boolean } => {
  if (!preferences) return { value: preferences, changed: false };

  const renamed = applyRenames(preferences, PREFERENCE_RENAMES);
  const base = renamed ?? preferences;
  const folded = foldPreferences(base, ruleset);

  if (!renamed && !folded.changed)
    return { value: preferences, changed: false };
  return { value: folded.value, changed: true };
};

/**
 * Returns the normalized quest, or the original reference when it was
 * already current.
 */
export const normalizeQuestRulesetFields = (
  quest: GameQuest,
  ruleset: RulesetDefinition = getActiveRuleset()
): GameQuest => {
  const renamed = applyRenames(quest as unknown as LooseRecord, QUEST_RENAMES);
  const base = (renamed ?? quest) as unknown as GameQuest;

  const desirable = normalizeAndFoldPreferences(
    base.desirable as LooseRecord | undefined,
    ruleset
  );
  const undesirable = normalizeAndFoldPreferences(
    base.undesirable as LooseRecord | undefined,
    ruleset
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
  ruleset: RulesetDefinition = getActiveRuleset()
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
  quests: GameQuest[],
  ruleset: RulesetDefinition = getActiveRuleset()
): GameQuest[] => {
  let changed = false;
  const normalized = quests.map(quest => {
    const next = normalizeQuestRulesetFields(quest, ruleset);
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
 * datasets field by field, so a remote or base snapshot still using an older
 * shape against a freshly-migrated local one would report every character as
 * modified — a spurious conflict on each record the first time a user syncs
 * after upgrading.
 */
export const normalizeDatasetRulesetFields = <
  T extends RulesetFieldBearingDataset,
>(
  dataset: T,
  ruleset: RulesetDefinition = getActiveRuleset()
): T => {
  const characters = dataset.characters
    ? normalizeCharactersRulesetFields(dataset.characters, ruleset)
    : dataset.characters;
  const quests = dataset.quests
    ? normalizeQuestsRulesetFields(dataset.quests, ruleset)
    : dataset.quests;

  if (characters === dataset.characters && quests === dataset.quests) {
    return dataset;
  }
  return { ...dataset, characters, quests };
};
